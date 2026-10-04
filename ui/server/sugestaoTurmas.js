'use strict';

/* Sugestão de turmas a partir do que a planilha diz sobre o aluno.
 *
 * A virada de chave deste módulo: a planilha traz um PROGRAMA ("Superior em
 * Tecnologia em Gestão de Eventos") e uma CIDADE, enquanto o Moodle nomeia
 * DISCIPLINAS ("2026/2 - Fundamentos de Eventos"). Casar programa com
 * disciplina não funciona. O que casa é o CAMINHO da categoria:
 *
 *   Cursos Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS / 1º Período / 2026.2
 *
 * Ali estão programa, campus, período e semestre na mesma string. Achada a
 * categoria, as turmas dela são o conjunto de matrícula.
 *
 * Divisão de responsabilidades, como no cadastro de alunos: o código pontua e
 * confere, a IA só desempata entre os finalistas e explica a escolha. Nada
 * aqui matricula ninguém — a última palavra é de quem confirma na tela, porque
 * o `uploaduser` não tem desfazer e sobrescreve conta já existente.
 */

const { geminiGenerate, safeParseJSON, cleanJSON } = require('./extractor');

/* Conectivos que aparecem em quase todo caminho e por isso não informam nada.
 * Palavras de domínio ("tecnologia", "eventos") ficam: são elas que decidem. */
const PARADAS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas',
  'o', 'a', 'os', 'as', 'para', 'com',
]);

function normaliza(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fichas(texto) {
  return new Set(normaliza(texto).split(' ').filter(t => t && !PARADAS.has(t)));
}

/** "2026.2" aparece escrito de várias formas nos nomes do IFCE. */
function variantesDeSemestre(semestre) {
  const m = /(\d{4})\s*[./_-]?\s*([12])/.exec(String(semestre ?? ''));
  if (!m) return [];
  const [, ano, periodo] = m;
  return [`${ano}.${periodo}`, `${ano}/${periodo}`, `${ano}${periodo}`, `${ano}-${periodo}`, `${ano}_${periodo}`];
}

function temSemestre(texto, semestre) {
  const alvo = String(texto ?? '').toLowerCase();
  return variantesDeSemestre(semestre).some(v => alvo.includes(v));
}

/* ─── Pontuação determinística ──────────────────────────────────────────── */

/**
 * Nota de 0 a 10 para uma categoria, com os motivos por extenso.
 *
 * Os motivos não são enfeite: é por eles que dá para discordar da sugestão
 * sem abrir o Moodle.
 */
function pontua(consulta, categoria) {
  const alvo = fichas(`${consulta.curso ?? ''} ${consulta.cidade ?? ''}`);
  const caminho = fichas(categoria.caminho);

  const comuns = [...alvo].filter(t => caminho.has(t));
  const cobertura = alvo.size ? comuns.length / alvo.size : 0;

  const fichasCidade = fichas(consulta.cidade);
  const cidadeBate = fichasCidade.size > 0 && [...fichasCidade].every(t => caminho.has(t));
  const semestreBate = consulta.semestre ? temSemestre(categoria.caminho, consulta.semestre) : false;

  const nota = cobertura * 5 + (cidadeBate ? 3 : 0) + (semestreBate ? 2 : 0);

  const motivos = [];
  if (comuns.length) motivos.push(`casa em: ${comuns.join(', ')}`);
  if (cidadeBate) motivos.push(`cidade "${consulta.cidade}" no caminho`);
  if (semestreBate) motivos.push(`semestre ${consulta.semestre} no caminho`);
  if (!motivos.length) motivos.push('nenhum termo em comum');

  return { nota: Number(nota.toFixed(2)), cobertura, cidadeBate, semestreBate, motivos };
}

/**
 * Ordena as categorias da mais para a menos provável.
 *
 * Categorias sem nenhum termo em comum são descartadas: levar ruído para o
 * prompt só aumenta a chance de a IA escolher errado.
 */
function ranqueia(consulta, categorias, limite = 8) {
  return categorias
    .map(categoria => ({ ...categoria, ...pontua(consulta, categoria) }))
    .filter(c => c.nota > 0)
    .sort((a, b) => b.nota - a.nota || a.caminho.localeCompare(b.caminho))
    .slice(0, limite);
}

/* ─── Desempate pela IA ─────────────────────────────────────────────────── */

const PROMPT_TURMAS = `Você recebe os dados de matrícula de um aluno e uma lista de categorias de um
Moodle. Cada categoria é o caminho completo até um conjunto de turmas. Escolha a categoria em que
esse aluno deve ser matriculado. Devolva SOMENTE JSON válido, sem markdown e sem explicações.

Schema:
{
  "categoriaId": "o id da categoria escolhida, exatamente como veio na lista",
  "confianca": "alta" | "media" | "baixa",
  "justificativa": "uma frase dizendo o que decidiu a escolha",
  "alternativa": "id da segunda melhor opção, ou null se não houver dúvida razoável"
}

Regras:
- Escolha SOMENTE entre os ids apresentados. Não invente id.
- O caminho da categoria costuma trazer programa, campus, período e semestre. Todos pesam.
- A cidade do aluno deve bater com o campus. Se nenhuma opção bate, use "confianca": "baixa".
- O semestre pedido tem precedência sobre a semelhança do nome do curso: matricular no semestre
  errado é pior do que num nome parecido.
- Quando duas categorias diferirem só pelo período (1º, 2º...), prefira a de período mais baixo e
  registre a outra em "alternativa" — nada nos dados do aluno diz em que período ele está.
- "confianca": "baixa" é resposta aceitável e útil. Não force certeza que os dados não sustentam.
`;

function montarPromptTurmas(consulta, candidatos) {
  const lista = candidatos
    .map(c => `- id ${c.id} | ${c.caminho} | nota ${c.nota} (${c.motivos.join('; ')})`)
    .join('\n');

  return `${PROMPT_TURMAS}
Aluno:
- curso na planilha: ${consulta.curso ?? '(não informado)'}
- cidade: ${consulta.cidade ?? '(não informada)'}
- semestre pedido: ${consulta.semestre ?? '(não informado)'}

Categorias candidatas:
${lista}
`;
}

/**
 * O que falta na escolha, dito em português.
 *
 * Existe porque uma raiz errada não produz erro nenhum: ela produz uma
 * campeã com nota baixa e ar de resposta. Apontar a categoria "EAD Técnico"
 * para um aluno de curso superior devolvia, confiante, a categoria do campus
 * certo e do curso errado — e sem turma nenhuma dentro.
 */
function alertasDaEscolha(consulta, escolhida) {
  const alertas = [];
  if (!escolhida) return alertas;

  if (consulta.cidade && !escolhida.cidadeBate) {
    alertas.push(`a cidade "${consulta.cidade}" não aparece no caminho da categoria.`);
  }
  if (consulta.semestre && !escolhida.semestreBate) {
    alertas.push(`o semestre ${consulta.semestre} não aparece no caminho da categoria.`);
  }
  if (escolhida.cobertura < 0.5) {
    alertas.push('menos da metade dos termos do curso da planilha casou; a raiz pode estar errada.');
  }
  return alertas;
}

/**
 * Sugere uma categoria. Sem chave do Gemini, devolve o topo determinístico —
 * a tela continua funcionando, só perde o desempate.
 */
async function sugere(consulta, categorias, apiKey) {
  const candidatos = ranqueia(consulta, categorias);
  if (!candidatos.length) return { candidatos, escolhida: null, alertas: [], origem: 'nenhum candidato' };

  if (!apiKey) {
    const escolhida = candidatos[0];
    return {
      candidatos, escolhida, origem: 'pontuação', confianca: null,
      alertas: alertasDaEscolha(consulta, escolhida),
    };
  }

  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const resposta = await geminiGenerate(ai, montarPromptTurmas(consulta, candidatos));
  const dados = safeParseJSON(cleanJSON(resposta.text), 'sugestão de turmas');

  // a IA pode devolver id fora da lista; nesse caso ela não decide nada
  const escolhida = candidatos.find(c => String(c.id) === String(dados?.categoriaId));
  if (!escolhida) {
    return {
      candidatos, escolhida: candidatos[0], origem: 'pontuação (IA devolveu id inválido)',
      alertas: alertasDaEscolha(consulta, candidatos[0]),
    };
  }

  return {
    candidatos,
    escolhida,
    origem: 'IA',
    confianca: dados?.confianca ?? null,
    justificativa: dados?.justificativa ?? null,
    alternativa: candidatos.find(c => String(c.id) === String(dados?.alternativa)) ?? null,
    alertas: alertasDaEscolha(consulta, escolhida),
  };
}

/* ─── Conferência antes do CSV ──────────────────────────────────────────── */

/**
 * O portão determinístico: o que impede um CSV que não matricula ninguém.
 *
 * Nome breve truncado é o caso perigoso — o Moodle não acha o curso e a
 * matrícula falha em silêncio, sem linha de erro na tela de resultado.
 */
function confereTurmas(cursos, semestre) {
  const problemas = [];
  const avisos = [];

  /* Categoria vazia passava como "aprovado, 0 problemas" — o desfecho mais
   * enganoso possível, porque a tela diria que está tudo certo e o lote não
   * matricularia ninguém. Acontece de verdade: categorias-contêiner como
   * "EAD Técnico" não têm turma alguma. */
  if (!cursos || !cursos.length) {
    return {
      ok: false,
      problemas: [{ id: null, mensagem: 'A categoria escolhida não tem turmas; não há o que matricular.' }],
      avisos: [],
    };
  }

  for (const curso of cursos) {
    const rotulo = curso.fullname || curso.id;

    if (!curso.shortname) {
      problemas.push({ id: curso.id, mensagem: `"${rotulo}" está sem nome breve.` });
      continue;
    }
    if (curso.truncado) {
      problemas.push({ id: curso.id, mensagem: `"${rotulo}" tem nome breve truncado; confirme em course/edit.php.` });
      continue;
    }
    if (semestre && !temSemestre(curso.shortname, semestre)) {
      avisos.push({ id: curso.id, mensagem: `"${rotulo}" não traz ${semestre} no nome breve.` });
    }
    if (curso.visivel === false) {
      avisos.push({ id: curso.id, mensagem: `"${rotulo}" está oculta para os alunos.` });
    }
  }

  return { ok: problemas.length === 0, problemas, avisos };
}

module.exports = {
  PARADAS,
  PROMPT_TURMAS,
  normaliza,
  fichas,
  variantesDeSemestre,
  temSemestre,
  pontua,
  ranqueia,
  montarPromptTurmas,
  alertasDaEscolha,
  sugere,
  confereTurmas,
};
