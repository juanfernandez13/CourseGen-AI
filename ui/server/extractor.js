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
    "titulo": "Título literal exibido na primeira linha do mural (ex: Progressões e Matemática Financeira / Polo)",
    "descricao": "Somente a mensagem pedagógica principal do mural, iniciando em Seja bem-vindo(a)! e terminando antes de Bons estudos!. Preserve integralmente os parágrafos selecionados."
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
- "mural.titulo": extraia LITERALMENTE a primeira linha que funciona como título do mural. Preserve placeholders como "/ Polo"; não substitua "Polo" pelos polos da tabela de tutores.
- "mural.descricao": extraia SOMENTE a mensagem pedagógica principal dentro da seção "DESCRIÇÃO DO MURAL". Quando existirem, comece em "Seja bem-vindo(a)!" e termine ANTES de "Bons estudos!". Dentro desses limites, transcreva integralmente, sem resumir ou parafrasear.
- "mural.descricao": NÃO inclua o título do mural, vocativos anteriores à saudação (ex: "Caro(a) aluno(a),"), encerramentos (ex: "Bons estudos!") nem elementos fixos da interface Moodle como "Livro da disciplina", "PUD", "Biblioteca", "Fórum Tira dúvidas", "PROFESSORES(AS)", nomes de professor/tutor, "AGENDA", "NAVEGAÇÃO" e "ADMINISTRAÇÃO".
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
- "disciplina.polo": extraia apenas um polo/local de oferta explicitamente definido para A DISCIPLINA nos dados gerais. NUNCA use nem concatene os polos da tabela "INFORMAÇÕES DOS(AS) TUTORES(AS) A DISTÂNCIA". Se o documento listar somente polos de tutores ou vários polos nessa tabela, use null.
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

// Medido com a chave de produção em 30/10/2026 (chamadas diretas, em fluxo):
// - 3.5-flash: respondia sempre a pedidos pequenos, mas dava 503 em ~3 de 4
//   pedidos de saída grande (um quiz transcrito), em 3-5s, e ~19s quando passava.
// - 3.5-flash-lite: 2 de 2 saídas grandes (~4,5-5 mil tokens) em 13-15s, sem 503.
// - 3.8-flash: 88s para devolver 149 tokens e mais de 120s no pedido padrão, ou
//   seja, ficava na fila. Como principal ele estourava o prazo de toda extração.
// Por isso: 3.5 primeiro, o lite assume quando o 3.5 segue em 503, e o 3.8 só
// por último. Quem ficar preso em ECONNRESET/504 também cai nessa cadeia.
const DEFAULT_MODEL = 'gemini-3.5-flash';
// Usados quando o modelo principal segue indisponível depois das tentativas.
// Um ID inexistente (404) é pulado, então a lista pode errar sem derrubar nada.
const DEFAULT_FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

// As rotas têm maxDuration de 300s. O orçamento fica abaixo disso para a rota
// ainda devolver um erro legível em vez de a Vercel matar a função e o navegador
// receber um 504 sem corpo.
const DEFAULT_BUDGET_MS = 240000;
// Abaixo disso não vale começar uma tentativa: ela seria cortada no meio.
const MIN_ATTEMPT_MS = 15000;

function modelChain() {
  const lista = (v) => (v || '').split(',').map(s => s.trim()).filter(Boolean);
  const principal = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallbacks = process.env.GEMINI_FALLBACK_MODELS !== undefined
    ? lista(process.env.GEMINI_FALLBACK_MODELS)
    : DEFAULT_FALLBACK_MODELS;
  return [...new Set([principal, ...fallbacks])];
}

// O SDK joga o JSON de erro da API dentro de err.message; err.status nem sempre vem.
function classifyGeminiError(err) {
  const body = String(err?.message || '');
  const status = Number(err?.status) || Number(body.match(/"code"\s*:\s*(\d{3})/)?.[1]) || 0;
  const has = (...s) => s.some(x => body.includes(x));

  // Estouro de prazo (504, ou a nossa própria interrupção por tempo) é outra
  // coisa que sobrecarga: o pedido é grande ou lento demais, e repeti-lo igual
  // só gasta o orçamento. Por isso não entra em `overloaded`.
  const slow = status === 504 || err?.name === 'AbortError' || err?.name === 'TimeoutError'
    || has('DEADLINE_EXCEEDED', 'operation was aborted');
  const overloaded = !slow && (status === 503 || status === 500
    || has('UNAVAILABLE', 'overloaded', 'INTERNAL'));
  const rateLimited = status === 429 || has('RESOURCE_EXHAUSTED');
  const notFound = status === 404 || has('NOT_FOUND');

  // Conexão derrubada no meio da resposta (undici: "TypeError: terminated",
  // causa ECONNRESET). Em produção foi o que matou a extração de um quiz depois
  // de ~60s, e como não era 503/504/429 o erro subia sem nenhuma repetição.
  // Só conta como rede o que tem cara de rede: um TypeError nosso não entra.
  const REDE = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN',
    'UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT'];
  const codigo = err?.cause?.code || err?.code;
  const network = !slow && (REDE.includes(codigo) || has(...REDE)
    || (err?.name === 'TypeError' && /^(terminated|fetch failed)$/i.test(String(err?.message).trim())));

  let retryAfterMs = 0;
  try {
    const info = JSON.parse(body)?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
    const secs = parseInt(info?.retryDelay);
    if (!isNaN(secs)) retryAfterMs = secs * 1000;
  } catch (_) {}

  return { overloaded, slow, network, rateLimited, notFound, retryAfterMs, status };
}

/**
 * Chama o Gemini tolerando indisponibilidade.
 *
 * 503 é sobrecarga do modelo, não erro nosso: esperar 30s fixos e repetir no
 * mesmo modelo (como era antes) costuma bater na mesma fila. Aqui: poucas
 * tentativas com backoff exponencial + jitter e, esgotadas, passa para o
 * próximo modelo da cadeia. Cota (429) também troca de modelo, porque a cota é
 * por modelo.
 *
 * Tudo isso divide um orçamento de tempo (`deadlineAt`, ou `budgetMs` a partir de
 * agora). Cada tentativa é interrompida quando o orçamento acaba, e sem tempo
 * para outra tentativa a função desiste com o último erro. Assim a rota responde
 * antes do `maxDuration` da Vercel. Estouro de prazo (504 ou interrupção nossa)
 * não é repetido no mesmo modelo: o pedido lento continua lento.
 *
 * `opts` existe para teste: { models, maxAttempts, sleep, random, now }. Também
 * aceita `deadlineAt` (compartilhar um orçamento entre várias chamadas) e
 * `attemptTimeoutMs` (teto por tentativa; sem ele vale o que resta do orçamento).
 */
async function geminiGenerate(ai, prompt, opts = {}) {
  const models = opts.models || modelChain();
  const maxAttempts = opts.maxAttempts || 3;
  const sleep = opts.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const random = opts.random || Math.random;
  const now = opts.now || Date.now;
  const deadlineAt = opts.deadlineAt ?? now() + (opts.budgetMs || DEFAULT_BUDGET_MS);
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const left = deadlineAt - now();
      if (left < MIN_ATTEMPT_MS) {
        console.warn('  ⏳ Orçamento de tempo esgotado; desistindo.');
        throw lastError || new Error('DEADLINE_EXCEEDED: o tempo para falar com o Gemini acabou.');
      }
      const timeoutMs = Math.min(left, opts.attemptTimeoutMs || left);
      try {
        // Em fluxo (stream) e não numa resposta só: sem streaming o Gemini não
        // manda um byte até terminar de gerar, e uma geração longa fica minutos
        // numa conexão muda, que acaba derrubada (ECONNRESET). Com chunks
        // chegando a conexão fica viva. O retorno continua sendo { text }.
        const stream = await ai.models.generateContentStream({
          model,
          contents: prompt,
          config: { abortSignal: AbortSignal.timeout(timeoutMs) },
        });
        let text = '';
        for await (const chunk of stream) text += chunk.text ?? '';
        return { text };
      } catch (err) {
        const c = classifyGeminiError(err);
        lastError = c.slow && !c.status
          ? new Error(`DEADLINE_EXCEEDED: ${model} não respondeu em ${Math.round(timeoutMs / 1000)}s.`)
          : err;
        // Modelo inexistente ou fora da conta: não adianta repetir, tenta o próximo.
        if (c.notFound) { console.warn(`  ⚠ Modelo ${model} indisponível para esta chave (404).`); break; }
        if (c.slow) {
          console.warn(`  ⏳ ${model} estourou o prazo (${c.status || `${Math.round(timeoutMs / 1000)}s`}); passando para o próximo modelo.`);
          break;
        }
        if (!c.overloaded && !c.rateLimited && !c.network) throw err;

        const rotulo = c.status || (c.network ? 'conexão caiu' : 'indisponível');
        const ultima = attempt === maxAttempts;
        // Cota estourada: a espera sugerida costuma ser longa; melhor outro modelo.
        if (ultima || (c.rateLimited && c.retryAfterMs > 20000)) {
          console.warn(`  ⏳ ${model} ${rotulo}; passando para o próximo modelo.`);
          break;
        }
        const backoff = Math.min(3000 * 2 ** (attempt - 1), 20000);
        const waitMs = Math.max(c.retryAfterMs, backoff) + Math.floor(random() * 1000);
        // Dormir comeria o que resta para a próxima tentativa: desiste já.
        if (deadlineAt - now() - waitMs < MIN_ATTEMPT_MS) {
          console.warn(`  ⏳ ${model} ${rotulo} e sem tempo para esperar; desistindo.`);
          throw lastError;
        }
        console.warn(`  ⏳ ${model} ${rotulo}. Aguardando ${Math.ceil(waitMs / 1000)}s (tentativa ${attempt}/${maxAttempts})...`);
        await sleep(waitMs);
      }
    }
  }
  throw lastError;
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

// Poucas chamadas ao mesmo tempo: a cota gratuita limita pedidos por minuto, e
// abrir uma por arquivo de uma vez trocaria o 503 por 429.
const QUIZ_CONCURRENCY = 4;
// Um questionário cabe em bem menos que isso; passar daqui é o modelo travado.
const QUIZ_ATTEMPT_TIMEOUT_MS = 90000;

async function mapWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i], i); } catch (err) { failed = true; throw err; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Uma chamada por arquivo, e não uma só com todos: a saída é a transcrição
 * literal de cada questão, então ela crescia com o número de arquivos e uma
 * chamada longa é a que mais leva 503/504. Por arquivo o pedido fica curto, o
 * resultado continua alinhado a `filePaths` e uma repetição custa pouco.
 *
 * `deps` existe para teste: { ai, readText, gemini }.
 */
async function extractAllQuizzes(filePaths, apiKey, deps = {}) {
  const ai = deps.ai || new (require('@google/genai').GoogleGenAI)({ apiKey });
  const readText = deps.readText || processMatriz;
  const gemini = deps.gemini || {};
  const now = gemini.now || Date.now;
  // Um orçamento só para o lote todo: com 4 de cada vez, muitos arquivos não
  // podem somar tempo além do que a rota aguenta.
  const deadlineAt = gemini.deadlineAt ?? now() + DEFAULT_BUDGET_MS;

  return mapWithLimit(filePaths, QUIZ_CONCURRENCY, async (filePath, i) => {
    const text = await readText(filePath);
    const response = await geminiGenerate(ai, `${PROMPT_QUIZ_BATCH}=== QUIZ 1 ===\n${text}`, {
      attemptTimeoutMs: QUIZ_ATTEMPT_TIMEOUT_MS,
      ...gemini,
      deadlineAt,
    });
    const parsed = safeParseJSON(cleanJSON(response.text), `quiz-${i + 1}`);
    return parsed.quizzes?.[0] || { questoes: [] };
  });
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

module.exports = { PROMPT_SCHEMA, PROMPT_QUIZ_BATCH, cleanJSON, safeParseJSON, modelChain, geminiGenerate, extractDataWithGemini, extractAllQuizzes, mergeMatrizData };
