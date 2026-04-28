'use strict';
const { jsonrepair } = require('jsonrepair');
const { processMatriz } = require('./parser');

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
Copie EXATAMENTE como está escrito na matriz, palavra por palavra, preservando todos os parágrafos (separe com \n\n).
Se o texto original tem 10 parágrafos, o JSON deve ter os mesmos 10 parágrafos completos.
Esta regra se aplica a: aulas[].descricao, forum.descricao, tarefa.descricao, encontros[].descricao, apresentacao, mural.descricao, ementa, e qualquer outro campo de texto.

Regras:
- "aulas": extraia CADA aula/semana/tópico do cronograma como um item separado.
- "mural.descricao": transcreva INTEGRALMENTE o conteúdo da seção '6. DESCRIÇÃO DO MURAL' (ou seção numerada equivalente). Separe parágrafos com \n\n. Nunca resuma.
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

// Chama Gemini com retry automático em caso de rate limit (429)
async function geminiGenerate(ai, prompt, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      return response;
    } catch (err) {
      const body = err.message || '';
      // Tenta extrair retryDelay do JSON de erro embutido na mensagem
      let waitMs = 60000; // padrão: 1 min
      try {
        const parsed = JSON.parse(body);
        const retryInfo = parsed?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
          const secs = parseInt(retryInfo.retryDelay);
          if (!isNaN(secs)) waitMs = secs * 1000 + 2000; // +2s de margem
        }
      } catch (_) {}

      const isRetryable = body.includes('429') || body.includes('RESOURCE_EXHAUSTED') || body.includes('quota')
                       || body.includes('503') || body.includes('UNAVAILABLE');
      if (!isRetryable || attempt === maxRetries) throw err;

      if (body.includes('503') || body.includes('UNAVAILABLE')) waitMs = 30000; // 503 → espera 30s
      const waitSec = Math.ceil(waitMs / 1000);
      console.warn(`  ⏳ Gemini indisponível (${body.includes('503') || body.includes('UNAVAILABLE') ? '503' : '429'}). Aguardando ${waitSec}s (tentativa ${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
}

async function extractDataWithGemini(fullText, apiKey) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  async function ask(prompt) {
    const response = await geminiGenerate(ai, prompt);
    return cleanJSON(response.text);
  }

  // Gemini 2.5 Flash suporta até ~1M tokens.
  // Um DOCX de até ~300k chars cabe em uma única chamada.
  const MAX_SINGLE = 300000;

  if (fullText.length <= MAX_SINGLE) {
    console.log('  → Chamada única (texto completo)');
    const json = await ask(PROMPT_SCHEMA + fullText);
    return safeParseJSON(json, 'matriz');
  }

  // Texto muito grande: divide em 2 partes e mescla
  console.log(`  → Texto grande (${fullText.length} chars), dividindo em 2 partes...`);
  const mid = fullText.lastIndexOf('\n', Math.floor(fullText.length / 2));
  const part1 = fullText.substring(0, mid);
  const part2 = fullText.substring(mid);

  console.log('  → Parte 1: cabeçalho, ementa, primeiras aulas...');
  const json1 = await ask(PROMPT_SCHEMA + part1 + '\n\n[NOTA: Este é o início do documento. Extraia o máximo possível. Aulas incompletas podem ter dados parciais.]');

  console.log('  → Parte 2: demais aulas, avaliações, bibliografia...');
  const json2 = await ask(`
Continue a extração da Matriz DE do IFCE. Esta é a segunda parte do documento.
Retorne SOMENTE JSON com os dados desta parte, sem repetir o que já foi extraído.
Use o mesmo schema, mas complete ou adicione apenas:
- Aulas que aparecem nesta parte (adicione ao array "aulas")
- Livro de notas (se presente aqui)
- Bibliografia (se presente aqui)

Segunda parte do documento:
${part2}`);

  const data1 = safeParseJSON(json1, 'matriz-parte1');
  const data2 = safeParseJSON(json2, 'matriz-parte2');
  return mergeMatrizData(data1, data2);
}

async function extractAllQuizzes(filePaths, apiKey) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const texts = await Promise.all(filePaths.map(fp => processMatriz(fp)));
  const combined = texts.map((t, i) => `=== QUIZ ${i + 1} ===\n${t}`).join('\n\n');

  const response = await geminiGenerate(ai, PROMPT_QUIZ_BATCH + combined);
  const json = cleanJSON(response.text);
  const parsed = safeParseJSON(json, 'quizzes-batch');
  return parsed.quizzes || [];
}

function mergeMatrizData(a, b) {
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

function cleanJSON(text) {
  // Remove markdown code fences
  let s = text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();

  // Extract only the JSON object/array (drop any leading/trailing prose)
  const start = s.search(/[{[]/);
  const end   = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Escape unescaped double-quotes inside string values.
  // Strategy: rebuild the string char-by-char tracking whether we're inside a JSON string.
  s = escapeInnerQuotes(s);

  return s;
}

function escapeInnerQuotes(s) {
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
      // We're inside a string. Check if this " is a legitimate closing quote:
      // a closing " is followed (after optional whitespace) by : , } ] or end.
      let j = i + 1;
      while (j < s.length && (s[j] === ' ' || s[j] === '\t' || s[j] === '\r' || s[j] === '\n')) j++;
      const next = s[j];
      if (next === ':' || next === ',' || next === '}' || next === ']' || j >= s.length) {
        // Legitimate closing quote
        inString = false;
        out += ch;
      } else {
        // Unescaped inner quote — escape it
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

function safeParseJSON(json, label) {
  try {
    return JSON.parse(json);
  } catch (e) {
    // Tenta reparar automaticamente (aspas não-escapadas, vírgulas extras, etc.)
    try {
      const repaired = jsonrepair(json);
      console.warn(`  ⚠️ JSON (${label}) reparado automaticamente`);
      return JSON.parse(repaired);
    } catch (repairErr) {
      console.warn(`  ⚠️ jsonrepair também falhou (${label}): ${repairErr.message}`);
    }

    const pos = parseInt((e.message.match(/position (\d+)/) || [])[1]) || 0;
    const snippet = json.slice(Math.max(0, pos - 80), pos + 80);
    console.error(`❌ JSON inválido (${label}) na posição ${pos}:\n...${snippet}...`);
    throw e;
  }
}

module.exports = { PROMPT_SCHEMA, PROMPT_QUIZ_BATCH, cleanJSON, safeParseJSON, geminiGenerate, extractDataWithGemini, extractAllQuizzes, mergeMatrizData };
