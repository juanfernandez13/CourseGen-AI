import { jsonrepair } from 'jsonrepair';
import { processMatriz } from './parser.client';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_URL = (apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

const PROMPT_SCHEMA = `
Analise esta Matriz DE do IFCE e extraia TODOS os dados estruturados.
Retorne SOMENTE JSON válido, sem markdown, sem explicações.

Siga EXATAMENTE este schema:
{
  "disciplina": {
    "nome": "Nome completo da disciplina",
    "codigo": "Código (ex: MAT001)",
    "carga_horaria": "ex: 60h",
    "curso": "Nome do curso",
    "semestre": "ex: 2025.1",
    "turma": "ex: TM20251",
    "polo": "Nome do polo/local de oferta (ex: Polo Fortaleza)"
  },
  "professor": {
    "nome": "Nome completo",
    "email": "email@ifce.edu.br",
    "titulacao": "Doutor(a) / Mestre(a) / etc",
    "tutor": "Nome do(a) tutor(a) ou null"
  },
  "ementa": "Texto completo da ementa",
  "mural": {
    "descricao": "Transcreva INTEGRALMENTE o texto da seção '6. DESCRIÇÃO DO MURAL' (ou equivalente) do documento. Preserve todos os parágrafos separando-os com \\n\\n. Não resuma nem omita partes."
  },
  "aulas": [
    {
      "numero": 1,
      "titulo": "Título completo da aula (ex: Aula 1 – Elementos fundamentais da Geometria)",
      "descricao": "Transcreva INTEGRALMENTE o texto de apresentação da aula como está no documento. Preserve todos os parágrafos separando-os com \\n\\n. Não resuma, não parafraseie, não crie texto novo.",
      "data_inicio": "DD/MM/YYYY ou null",
      "data_fim": "DD/MM/YYYY ou null",
      "forum": {
        "titulo": "[Aula N] [Fórum N] Título do tema [nota]",
        "nota": 5,
        "descricao": "Transcreva INTEGRALMENTE a proposta/enunciado do fórum como está no documento. Inclua todas as orientações. Não resuma.",
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      },
      "quiz": {
        "titulo": "[Aula N] [Questionário N] Título [nota]",
        "nota": 5,
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      },
      "chat": {
        "titulo": "Título do tema do chat",
        "nota": 6.5,
        "descricao": "Transcreva INTEGRALMENTE o enunciado/proposta do chat como está no documento. Não resuma.",
        "nota_titulo": "[Aula N] [Chat N] Título [nota]",
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      },
      "wiki": {
        "titulo": "Título do tema da wiki",
        "nota": 10,
        "descricao": "Transcreva INTEGRALMENTE o enunciado/proposta da wiki como está no documento. Não resuma.",
        "nota_titulo": "[Aula N] [Wiki N] Título [nota]",
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      },
      "glossario": {
        "titulo": "[Aula N] [Glossário N] Título [nota]",
        "nota": 5,
        "descricao": "Transcreva INTEGRALMENTE o enunciado/proposta do glossário como está no documento. Não resuma.",
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      },
      "tarefa": {
        "titulo": "[Aula N] [Tarefa N] Título [nota]",
        "nota": 10,
        "descricao": "Transcreva INTEGRALMENTE o enunciado da tarefa como está no documento. Não resuma.",
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      }
    }
  ],
  "apresentacao": "Transcreva INTEGRALMENTE o texto de apresentação/boas-vindas da disciplina escrito pelo professor (geralmente no início do documento, antes das aulas). Preserve parágrafos separando-os com \\n\\n. Não resuma nem omita partes.",
  "encontros": [
    {
      "numero": 1,
      "titulo": "1º Encontro VIRTUAL (NOITE 19h às 21h - quarta-feira) - 18/03/2026",
      "descricao": "Transcreva INTEGRALMENTE a descrição das atividades do encontro como está no documento. Não resuma.",
      "data": "DD/MM/YYYY ou null",
      "turnos": 1,
      "avaliacao": "sem_nota",
      "peso": 0,
      "nota_titulo": "[Encontro 1] [Avaliação 0] [Peso 0]",
      "falta_titulo": "[Encontro 1] [Faltas] [1]"
    }
  ],
  "avaliacao_final": {
    "titulo": "[Disciplina] [Avaliação Final]",
    "descricao": "Avaliação final da disciplina.",
    "data": "DD/MM/YYYY ou null"
  },
  "frequencia": {
    "percentual_minimo": 75,
    "observacoes": "ex: mínimo de 75% de presença exigido"
  },
  "livro_de_notas": {
    "categorias": [
      { "nome": "Atividades a distância", "peso": 40 },
      { "nome": "Atividades presenciais", "peso": 60 }
    ]
  },
  "bibliografia": {
    "basica": ["Autor. Título. Edição. Cidade: Editora, Ano."],
    "complementar": ["..."]
  }
}

⚠️⚠️⚠️ REGRA FUNDAMENTAL — TRANSCRIÇÃO LITERAL ⚠️⚠️⚠️
TODOS os campos de texto (descricao, apresentacao, ementa, enunciado, etc.) devem ser TRANSCRITOS LITERALMENTE do documento original.
NUNCA resuma, parafraseie, encurte, reescreva ou omita partes do texto.
Copie EXATAMENTE como está escrito na matriz, palavra por palavra, preservando todos os parágrafos (separe com \\n\\n).
Se o texto original tem 10 parágrafos, o JSON deve ter os mesmos 10 parágrafos completos.
Esta regra se aplica a: aulas[].descricao, forum.descricao, tarefa.descricao, encontros[].descricao, apresentacao, mural.descricao, ementa, e qualquer outro campo de texto.

Regras:
- "aulas": extraia CADA aula/semana/tópico do cronograma como um item separado.
- "mural.descricao": transcreva INTEGRALMENTE o conteúdo da seção '6. DESCRIÇÃO DO MURAL' (ou seção numerada equivalente). Separe parágrafos com \\n\\n. Nunca resuma.
- "forum": inclua SOMENTE se existir explicitamente na matriz um fórum de discussão para aquela aula (campo de atividade EaD específico). Se não existir, use null. Extraia as datas de início e fim do período de participação.
- "forum.descricao": transcreva INTEGRALMENTE o enunciado/proposta do fórum como está na matriz. Inclua todas as orientações de participação. Nunca resuma.
- "quiz": inclua quando houver questionário/avaliação online com prazo definido. Senão, use null.
- "chat": inclua quando houver atividade de chat/sala de bate-papo para aquela aula. O campo "nota_titulo" segue o padrão "[Aula N] [Chat N] Título [nota]". O campo "descricao" deve conter o enunciado/proposta do chat transcrito integralmente. Extraia as datas de início e fim do período. Use null se não houver chat.
- "wiki": inclua quando houver atividade wiki (texto colaborativo) para aquela aula. O campo "nota_titulo" segue o padrão "[Aula N] [Wiki N] Título [nota]". Transcreva integralmente a proposta da wiki. Use null se não houver wiki.
- "glossario": inclua quando houver atividade de glossário para aquela aula. O título segue o padrão "[Aula N] [Glossário N] Título [nota]". Transcreva integralmente a proposta do glossário. Use null se não houver glossário.
- "tarefa": inclua quando houver tarefa/trabalho com entrega (envio de arquivo). Senão, use null.
- "tarefa.descricao": transcreva INTEGRALMENTE o enunciado da tarefa como está na matriz. Nunca resuma.
- "aulas[].descricao": transcreva INTEGRALMENTE o texto de apresentação da aula como está na matriz. Nunca resuma nem crie texto que não existe no documento.
- "apresentacao": transcreva INTEGRALMENTE o texto de apresentação/boas-vindas da disciplina. Nunca resuma.
- "encontros[].descricao": transcreva INTEGRALMENTE a descrição das atividades do encontro. Nunca resuma.
- "disciplina.polo": extraia o polo ou local de oferta da disciplina (ex: "Polo Fortaleza"). Use null se não encontrar.
- "professor.tutor": extraia o nome do(a) tutor(a) se estiver no documento. Use null se não encontrar.
- "encontros": extraia a seção "DESCRIÇÃO DO(S) ENCONTRO(S) PRESENCIAL(IS) OU VIRTUAL(IS)" (geralmente seção 9). Cada encontro vira um item com: numero, titulo (completo com data), descricao (atividades), data (DD/MM/YYYY do encontro), turnos (1 ou 2, quantidade de turnos), avaliacao ("sem_nota" ou "nota_media"), peso (0 a 100, percentual), nota_titulo (campo "Nota -" da configuração), falta_titulo (campo "Falta -" da configuração). Use [] se não houver seção de encontros.
- "avaliacao_final": extraia a avaliação final (AF). O título deve ser literalmente "[Disciplina] [Avaliação Final]". Sempre retorne este campo.
- "frequencia": extraia o percentual mínimo de frequência exigido (geralmente 75% no IFCE).
- Datas das aulas (data_inicio/data_fim): procure em QUALQUER lugar textual do documento — não apenas no cronograma/calendário, que pode estar como imagem e não aparecer no texto extraído. As datas costumam aparecer em pelo menos um destes locais:
  • no título ou subtítulo da aula (ex: "Aula 1 — 10/04 a 19/04/2026")
  • no início ou fim da descrição/apresentação da aula
  • em tabelas, listas ou parágrafos referenciando a aula pelo número
  • junto à descrição de fórum, quiz, tarefa, chat, wiki ou glossário daquela aula
  Aceite intervalos escritos em qualquer formato (ex: "10/04 a 19/04/2026", "de 10/04/2026 até 19/04/2026", "10 de abril a 19 de abril de 2026", "10 a 19 de abril/2026") e normalize SEMPRE para "DD/MM/YYYY". Se o ano não estiver explícito no intervalo, herde do contexto da disciplina (semestre/cronograma). Só retorne null se realmente nenhuma data textual existir para aquela aula.
- Datas de atividades (forum/quiz/tarefa/chat/wiki/glossario): se a atividade não tiver datas próprias, herde data_inicio/data_fim da aula a que pertence.
- "livro_de_notas": extraia os pesos das categorias do sistema de avaliação. Use 40/60 como padrão IFCE se não especificado.
- Notas: extraia os pontos de cada atividade. Use 10 como padrão.
- IMPORTANTE: nos valores string do JSON, nunca use aspas duplas. Se precisar enfatizar uma palavra, use asteriscos (*palavra*) ou escreva sem marcação. Aspas duplas dentro de strings quebram o JSON.
- FORMATO DE NOTA EM TÍTULOS: nos campos de título que terminam com a nota entre colchetes (ex: "titulo" e "nota_titulo" de forum/quiz/chat/wiki/glossario/tarefa), o número da nota dentro de "[...]" deve usar VÍRGULA como separador decimal (ex: "[6,5]", "[10]", "[2,5]"). Em todos os demais campos numéricos do JSON ("nota", "pontuacao", "peso", etc.), use ponto como separador decimal padrão JSON (ex: "nota": 6.5). Resumo: número JSON usa ponto; número exibido em título entre colchetes usa vírgula.

Matriz DE:
`;

const PROMPT_QUIZ_BATCH = `Analise os documentos de questões abaixo e extraia CADA UM em JSON.
Retorne SOMENTE JSON válido, sem markdown, sem explicações.

Schema de retorno:
{
  "quizzes": [
    {
      "questoes": [
        { "tipo": "multipla_escolha", "numero": 1, "enunciado": "texto da questão", "pontuacao": 2.0,
          "itens": [{"texto":"alternativa A","isCorrect":false,"feedback":"comentário do arquivo para esta alternativa, se houver"},{"texto":"alternativa B","isCorrect":true,"feedback":"comentário do arquivo para esta alternativa, se houver"}] },
        { "tipo": "associativa", "numero": 2, "enunciado": "texto da questão", "pontuacao": 1.0,
          "itens": [{"texto":"afirmação 1","resposta":"V"},{"texto":"afirmação 2","resposta":"F"}] },
        { "tipo": "dissertativa", "numero": 3, "enunciado": "texto da questão", "pontuacao": 3.0, "feedback": "gabarito opcional" }
      ]
    }
  ]
}

Regras:
- Retorne um item em "quizzes" para CADA documento marcado com === QUIZ N ===, na mesma ordem.
- "multipla_escolha": itens com "texto" e "isCorrect" (boolean). Apenas 1 correto. Se o documento trouxer um comentário/feedback específico para a alternativa (ex: "Feedback específico", explicação do erro/acerto após a opção), transcreva-o LITERALMENTE no campo "feedback" do item. Se não houver feedback no arquivo para aquela alternativa, omita o campo "feedback" (não invente texto).
- "associativa": itens com "texto" e "resposta" ("V" ou "F").
- "dissertativa": sem itens, pode ter "feedback".
- Preserve fórmulas matemáticas com Unicode (ex: x², √2, aₙ).
- Não inclua caracteres que quebrem JSON.

Documentos:
`;

async function geminiGenerate(apiKey: string, prompt: string, maxRetries = 5): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(GEMINI_URL(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`${res.status} ${res.statusText}: ${body}`);
        // attach status for retry detection
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      const data = await res.json();
      const text: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
      if (!text) throw new Error('Resposta vazia do Gemini');
      return text;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status;
      const isRetryable =
        status === 429 || status === 503 ||
        msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('quota') || msg.includes('503') || msg.includes('UNAVAILABLE');
      if (!isRetryable || attempt === maxRetries) throw err;

      let waitMs = 60000;
      try {
        const jsonStart = msg.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(msg.slice(jsonStart));
          const retryInfo = parsed?.error?.details?.find(
            (d: { '@type'?: string }) => d['@type']?.includes('RetryInfo'),
          );
          if (retryInfo?.retryDelay) {
            const secs = parseInt(retryInfo.retryDelay);
            if (!isNaN(secs)) waitMs = secs * 1000 + 2000;
          }
        }
      } catch { /* ignore */ }
      if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE')) waitMs = 30000;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini: falha após retries');
}

function cleanJSON(text: string): string {
  let s = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  const start = s.search(/[{[]/);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  s = s.replace(/,\s*([}\]])/g, '$1');
  s = escapeInnerQuotes(s);
  return s;
}

function escapeInnerQuotes(s: string): string {
  let out = '';
  let inString = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\' && inString) {
      out += ch + (s[i + 1] || '');
      i += 2;
      continue;
    }
    if (ch === '"') {
      if (!inString) {
        inString = true;
        out += ch;
        i++;
        continue;
      }
      let j = i + 1;
      while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\r' || s[j] === '\n')) j++;
      const next = s[j];
      if (next === ':' || next === ',' || next === '}' || next === ']' || j >= s.length) {
        inString = false;
        out += ch;
      } else {
        out += '\\"';
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function safeParseJSON<T = unknown>(json: string, label: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (e) {
    try {
      const repaired = jsonrepair(json);
      console.warn(`  ⚠️ JSON (${label}) reparado automaticamente`);
      return JSON.parse(repaired) as T;
    } catch (repairErr) {
      const m = repairErr instanceof Error ? repairErr.message : String(repairErr);
      console.warn(`  ⚠️ jsonrepair também falhou (${label}): ${m}`);
    }
    const errMsg = e instanceof Error ? e.message : String(e);
    const pos = parseInt((errMsg.match(/position (\d+)/) || [])[1]) || 0;
    const snippet = json.slice(Math.max(0, pos - 80), pos + 80);
    console.error(`❌ JSON inválido (${label}) na posição ${pos}:\n...${snippet}...`);
    throw e;
  }
}

type MatrizData = {
  disciplina?: Record<string, unknown>;
  professor?: Record<string, unknown>;
  ementa?: string;
  aulas?: Array<Record<string, unknown>>;
  livro_de_notas?: { categorias?: Array<Record<string, unknown>> };
  bibliografia?: { basica?: string[]; complementar?: string[] };
  [k: string]: unknown;
};

export async function extractDataWithGemini(fullText: string, apiKey: string): Promise<MatrizData> {
  const ask = async (prompt: string) => cleanJSON(await geminiGenerate(apiKey, prompt));

  const MAX_SINGLE = 300000;
  if (fullText.length <= MAX_SINGLE) {
    const json = await ask(PROMPT_SCHEMA + fullText);
    return safeParseJSON<MatrizData>(json, 'matriz');
  }

  const mid = fullText.lastIndexOf('\n', Math.floor(fullText.length / 2));
  const part1 = fullText.substring(0, mid);
  const part2 = fullText.substring(mid);

  const json1 = await ask(PROMPT_SCHEMA + part1 + '\n\n[NOTA: Este é o início do documento. Extraia o máximo possível. Aulas incompletas podem ter dados parciais.]');
  const json2 = await ask(`
Continue a extração da Matriz DE do IFCE. Esta é a segunda parte do documento.
Retorne SOMENTE JSON com os dados desta parte, sem repetir o que já foi extraído.
Use o mesmo schema, mas complete ou adicione apenas:
- Aulas que aparecem nesta parte (adicione ao array "aulas")
- Livro de notas (se presente aqui)
- Bibliografia (se presente aqui)

Segunda parte do documento:
${part2}`);

  const data1 = safeParseJSON<MatrizData>(json1, 'matriz-parte1');
  const data2 = safeParseJSON<MatrizData>(json2, 'matriz-parte2');
  return mergeMatrizData(data1, data2);
}

export type QuizExtraction = { questoes: Array<Record<string, unknown>> };

export async function extractAllQuizzes(quizFiles: File[], apiKey: string): Promise<QuizExtraction[]> {
  const texts = await Promise.all(quizFiles.map(f => processMatriz(f)));
  const combined = texts.map((t, i) => `=== QUIZ ${i + 1} ===\n${t}`).join('\n\n');

  const raw = await geminiGenerate(apiKey, PROMPT_QUIZ_BATCH + combined);
  const parsed = safeParseJSON<{ quizzes?: QuizExtraction[] }>(cleanJSON(raw), 'quizzes-batch');
  return parsed.quizzes || [];
}

function mergeMatrizData(a: MatrizData, b: MatrizData): MatrizData {
  return {
    disciplina:      a.disciplina      || b.disciplina      || {},
    professor:       a.professor       || b.professor       || {},
    ementa:          a.ementa          || b.ementa          || '',
    aulas:           [...(a.aulas || []), ...(b.aulas || [])],
    livro_de_notas:  a.livro_de_notas  || b.livro_de_notas  || { categorias: [] },
    bibliografia:    {
      basica:        [...(a.bibliografia?.basica        || []), ...(b.bibliografia?.basica        || [])],
      complementar:  [...(a.bibliografia?.complementar  || []), ...(b.bibliografia?.complementar  || [])],
    },
  };
}

export async function extractMatrizFromFile(matrizFile: File, apiKey: string): Promise<MatrizData> {
  const fullText = await processMatriz(matrizFile);
  return extractDataWithGemini(fullText, apiKey);
}
