'use strict';

/* Cadastro em lote de alunos.
 *
 * Divisão de responsabilidades proposital:
 *   - o Gemini apenas ARRUMA (mapeia colunas bagunçadas, separa nome de
 *     sobrenome, tira pontuação do CPF);
 *   - este módulo DECIDE o que é válido.
 *
 * CPF e e-mail são verificados aqui, em código determinístico e testável. Um
 * modelo pode alucinar um dígito e transformar um cadastro inválido em algo
 * plausível — exatamente o que não pode acontecer. */

const { geminiGenerate, safeParseJSON, cleanJSON } = require('./extractor');
const { planilhaParaTexto } = require('./planilha');

const SENHA_PADRAO  = 'abcd1234';
const CIDADE_PADRAO = 'Fortaleza';

const COLUNAS_CSV = [
  'password', 'username', 'firstname', 'lastname',
  'email', 'city', 'course1', 'type1',
];

const PROMPT_ALUNOS = `Você recebe as linhas de uma planilha de alunos. As colunas variam e podem
estar com nomes errados, fora de ordem ou combinadas. Interprete e devolve SOMENTE JSON válido,
sem markdown e sem explicações.

Schema:
{
  "alunos": [
    {
      "cpf": "somente os dígitos do CPF, sem pontos nem traços",
      "firstname": "primeiro nome",
      "lastname": "sobrenome(s)",
      "email": "e-mail como está na planilha",
      "city": "cidade, ou null se a planilha não trouxer",
      "course1": "código/nome do curso como está na planilha, ou null",
      "type1": 1,
      "observacao": "o que estava ambíguo nesta linha, ou null"
    }
  ]
}

Regras:
- Ignore a linha de cabeçalho. Cada linha restante com dados vira um item.
- NUNCA invente, corrija ou complete um CPF. Copie os dígitos como estão, mesmo que sobrem ou
  faltem. Se a linha não tiver CPF algum, use null e explique em "observacao".
- NUNCA invente um e-mail. Copie como está. Se não houver, use null.
- Quando nome e sobrenome vierem no mesmo campo, separe: o primeiro token é "firstname" e o
  restante é "lastname". Preserve os nomes como escritos, sem reordenar.
- Partículas como "de", "da", "dos", "e" pertencem ao "lastname".
- "city": copie se existir na planilha. Se não existir, use null — não deduza a cidade.
- "course1": copie o que estiver na planilha. Se não houver coluna de curso, use null.
- "type1": use 1 para aluno e 2 para professor/tutor/docente. Na dúvida, use 1.
- Não repita linhas nem crie alunos que não estejam na planilha.

Linhas da planilha:
`;

/* ─── Validação determinística ──────────────────────────────────────────── */

function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

/** Dígitos verificadores do CPF. Pega erro de digitação, não só de tamanho. */
function cpfTemDigitoValido(cpf) {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  for (const [tamanho, posicao] of [[9, 10], [10, 11]]) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(cpf[i]) * (posicao - i);
    const resto = (soma * 10) % 11 % 10;
    if (resto !== Number(cpf[tamanho])) return false;
  }
  return true;
}

/** Formato de e-mail: um arroba, sem espaços, domínio com ponto. */
function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? '').trim());
}

function nomeProprio(texto) {
  return String(texto ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Aplica regras e defaults, devolvendo o registro pronto para o CSV mais a
 * lista de problemas que exigem olho humano.
 *
 * `problemas` marca o que está errado; `avisos` marca o que foi preenchido
 * automaticamente e convém conferir.
 */
function normalizarAluno(bruto) {
  const problemas = [];
  const avisos = [];

  const cpfDigitos = somenteDigitos(bruto?.cpf);
  if (!cpfDigitos) {
    problemas.push({ campo: 'username', mensagem: 'CPF ausente na planilha.' });
  } else if (cpfDigitos.length !== 11) {
    problemas.push({
      campo: 'username',
      mensagem: `CPF com ${cpfDigitos.length} dígitos; precisa de 11.`,
    });
  } else if (!cpfTemDigitoValido(cpfDigitos)) {
    problemas.push({ campo: 'username', mensagem: 'CPF com dígito verificador inválido.' });
  }

  const firstname = nomeProprio(bruto?.firstname);
  const lastname  = nomeProprio(bruto?.lastname);
  if (!firstname) problemas.push({ campo: 'firstname', mensagem: 'Primeiro nome ausente.' });
  if (!lastname)  problemas.push({ campo: 'lastname',  mensagem: 'Sobrenome ausente.' });

  const email = String(bruto?.email ?? '').trim();
  if (!email) {
    problemas.push({ campo: 'email', mensagem: 'E-mail ausente na planilha.' });
  } else if (!emailValido(email)) {
    problemas.push({ campo: 'email', mensagem: 'E-mail em formato inválido.' });
  }

  let city = String(bruto?.city ?? '').trim();
  if (!city) {
    city = CIDADE_PADRAO;
    avisos.push({ campo: 'city', mensagem: `Cidade ausente; preenchida com ${CIDADE_PADRAO}.` });
  }

  const course1 = String(bruto?.course1 ?? '').trim();
  if (!course1) {
    problemas.push({ campo: 'course1', mensagem: 'Curso ausente; informe antes de gerar.' });
  }

  const type1 = bruto?.type1 === 2 || String(bruto?.type1) === '2' ? 2 : 1;

  return {
    password: SENHA_PADRAO,
    username: cpfDigitos,
    firstname,
    lastname,
    email,
    city,
    course1,
    type1,
    problemas,
    avisos,
    observacao: bruto?.observacao ?? null,
  };
}

function normalizarAlunos(brutos) {
  return (Array.isArray(brutos) ? brutos : []).map(normalizarAluno);
}

/* ─── Extração ──────────────────────────────────────────────────────────── */

async function extrairAlunos(rows, apiKey) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const texto = planilhaParaTexto(rows);
  const response = await geminiGenerate(ai, `${PROMPT_ALUNOS}${texto}`);
  const dados = safeParseJSON(cleanJSON(response.text), 'alunos');

  return normalizarAlunos(dados?.alunos);
}

/* ─── CSV ───────────────────────────────────────────────────────────────── */

function csvCell(valor) {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`;
}

/** CSV no formato de importação de usuários do Moodle. */
function montarCsv(alunos) {
  const linhas = [COLUNAS_CSV.map(csvCell).join(',')];
  for (const aluno of alunos || []) {
    linhas.push(COLUNAS_CSV.map(coluna => csvCell(aluno?.[coluna])).join(','));
  }
  return `${linhas.join('\r\n')}\r\n`;
}

/** Nome de arquivo seguro a partir do curso, preservando legibilidade. */
function slugCurso(curso) {
  return String(curso ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'curso';
}

/**
 * Geração múltipla: os mesmos alunos, um CSV por curso.
 *
 * Cada arquivo recebe o seu próprio course1 — o valor que veio na planilha é
 * ignorado, porque quem manda é a lista escolhida na revisão.
 */
function montarCsvPorCurso(alunos, cursos, base = 'alunos') {
  const lista = (Array.isArray(cursos) ? cursos : [])
    .map(curso => String(curso ?? '').trim())
    .filter(Boolean);

  const distintos = [...new Set(lista)];
  if (!distintos.length) return [];

  return distintos.map(curso => ({
    curso,
    filename: `${base}_${slugCurso(curso)}.csv`,
    csv: montarCsv((alunos || []).map(aluno => ({ ...aluno, course1: curso }))),
  }));
}

module.exports = {
  COLUNAS_CSV,
  slugCurso,
  montarCsvPorCurso,
  SENHA_PADRAO,
  CIDADE_PADRAO,
  PROMPT_ALUNOS,
  cpfTemDigitoValido,
  emailValido,
  normalizarAluno,
  normalizarAlunos,
  extrairAlunos,
  montarCsv,
};
