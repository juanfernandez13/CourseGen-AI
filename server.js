require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processMatriz } = require('./parser');
const { generateMBZ } = require('./mbzGenerator');

const GEMINI_KEY = process.env.GEMINI_KEY;

const app = express();
const PORT = 3000;

const DOCX_EXTS   = new Set(['.docx', '.doc']);
const TAREFA_EXTS = new Set(['.docx', '.doc', '.pdf', '.xlsx', '.xls', '.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.zip']);

const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'tarefas') {
      return TAREFA_EXTS.has(ext) ? cb(null, true) : cb(new Error(`Formato não suportado para tarefa: ${ext}`));
    }
    // matriz e quizzes: apenas docx
    DOCX_EXTS.has(ext) ? cb(null, true) : cb(new Error('Apenas arquivos .docx são suportados'));
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});
const uploadFields = upload.fields([
  { name: 'matriz',   maxCount: 1  },
  { name: 'quizzes',  maxCount: 30 },
  { name: 'tarefas',  maxCount: 60 },
]);

app.use(express.static('public'));
app.use(express.json());

// Rota principal: upload + conversão
app.post('/convert', uploadFields, async (req, res) => {
  const matrizFile = req.files?.matriz?.[0];
  if (!matrizFile) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_KEY não configurada no .env' });

  const quizFiles = (req.files?.quizzes || []).sort((a, b) => {
    const na = parseInt((a.originalname.match(/(\d+)/) || [0, 0])[1]);
    const nb = parseInt((b.originalname.match(/(\d+)/) || [0, 0])[1]);
    return na - nb;
  });

  const filePath = matrizFile.path;
  try {
    console.log('📄 Extraindo texto do documento...');
    const fullText = await processMatriz(filePath);
    console.log(`✅ ${fullText.length} caracteres extraídos`);

    console.log('🤖 Processando com Gemini...');
    const matrizData = await extractDataWithGemini(fullText, GEMINI_KEY);
    console.log('✅ Dados extraídos:', JSON.stringify(matrizData, null, 2));

    // Process quiz question files — single Gemini call for all quizzes
    if (quizFiles.length > 0) {
      console.log(`📝 Processando ${quizFiles.length} quiz(zes) em chamada única...`);
      try {
        const allQuizzes = await extractAllQuizzes(quizFiles.map(f => f.path), GEMINI_KEY);
        let quizIdx = 0;
        for (const aula of matrizData.aulas) {
          if (aula.quiz && quizIdx < allQuizzes.length) {
            aula.quiz.questoes = allQuizzes[quizIdx].questoes || [];
            console.log(`  ✅ Quiz ${quizIdx + 1}: ${aula.quiz.questoes.length} questões`);
            quizIdx++;
          }
        }
      } catch (e) {
        console.warn(`  ⚠️ Erro ao processar quizzes: ${e.message}`);
      } finally {
        quizFiles.forEach(f => fs.unlink(f.path, () => {}));
      }
    }

    // Process tarefa attachment files (grouped by tarefa number in filename)
    const tarefaFilesMap = {};
    for (const file of (req.files?.tarefas || [])) {
      const match = file.originalname.match(/tarefa[_-]?(\d+)/i);
      if (match) {
        const num = parseInt(match[1]);
        if (!tarefaFilesMap[num]) tarefaFilesMap[num] = [];
        tarefaFilesMap[num].push({ filePath: file.path, filename: file.originalname });
      }
    }
    let tarefaCounter = 0;
    for (const aula of matrizData.aulas) {
      if (aula.tarefa) {
        tarefaCounter++;
        if (tarefaFilesMap[tarefaCounter]) aula.tarefa.arquivos = tarefaFilesMap[tarefaCounter];
      }
    }

    console.log('📦 Gerando arquivo .mbz...');
    const mbzPath = await generateMBZ(matrizData);
    console.log('✅ Arquivo .mbz gerado:', mbzPath);

    res.download(mbzPath, `curso_${matrizData.disciplina?.codigo || 'moodle'}.mbz`, () => {
      fs.unlink(filePath, () => {});
      fs.unlink(mbzPath, () => {});
      // Cleanup uploaded tarefa files
      for (const files of Object.values(tarefaFilesMap))
        files.forEach(f => fs.unlink(f.filePath, () => {}));
    });
  } catch (error) {
    console.error('❌ Erro:', error.message);
    fs.unlink(filePath, () => {});
    res.status(500).json({ error: error.message });
  }
});

// Rota de preview: retorna JSON sem gerar .mbz
app.post('/preview', uploadFields, async (req, res) => {
  const matrizFile = req.files?.matriz?.[0];
  if (!matrizFile) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_KEY não configurada no .env' });

  try {
    const fullText = await processMatriz(matrizFile.path);
    const matrizData = await extractDataWithGemini(fullText, GEMINI_KEY);
    fs.unlink(matrizFile.path, () => {});
    res.json({ success: true, data: matrizData });
  } catch (error) {
    fs.unlink(matrizFile.path, () => {});
    res.status(500).json({ error: error.message });
  }
});

// ─── Extração com Gemini ──────────────────────────────────────────────────────


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
      "descricao": "Texto de apresentação da aula para o aluno (2-5 frases). Se não houver, crie a partir dos conteúdos.",
      "data_inicio": "DD/MM/YYYY ou null",
      "data_fim": "DD/MM/YYYY ou null",
      "forum": {
        "titulo": "[Aula N] [Fórum N] Título do tema [nota]",
        "nota": 5,
        "descricao": "Proposta/enunciado do fórum para o aluno.",
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      },
      "quiz": {
        "titulo": "[Aula N] [Questionário N] Título [nota]",
        "nota": 5,
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      },
      "tarefa": {
        "titulo": "[Aula N] [Tarefa N] Título [nota]",
        "nota": 10,
        "descricao": "Enunciado da tarefa.",
        "data_inicio": "DD/MM/YYYY ou null",
        "data_fim": "DD/MM/YYYY ou null"
      }
    }
  ],
  "apresentacao": "Texto completo de apresentação/boas-vindas da disciplina escrito pelo professor (geralmente no início do documento, antes das aulas). Preserve parágrafos separando-os com \\n\\n.",
  "encontros": [
    {
      "numero": 1,
      "titulo": "1º Encontro VIRTUAL (NOITE 19h às 21h - quarta-feira) - 18/03/2026",
      "descricao": "Descrição completa das atividades do encontro.",
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

Regras:
- "aulas": extraia CADA aula/semana/tópico do cronograma como um item separado.
- "mural.descricao": transcreva INTEGRALMENTE o conteúdo da seção '6. DESCRIÇÃO DO MURAL' (ou seção numerada equivalente). Separe parágrafos com \n\n. Nunca resuma.
- "forum": inclua SOMENTE se existir explicitamente na matriz um fórum de discussão para aquela aula (campo de atividade EaD específico). Se não existir, use null. Extraia as datas de início e fim do período de participação.
- "quiz": inclua quando houver questionário/avaliação online com prazo definido. Senão, use null.
- "tarefa": inclua quando houver tarefa/trabalho com entrega (envio de arquivo). Senão, use null.
- "disciplina.polo": extraia o polo ou local de oferta da disciplina (ex: "Polo Fortaleza"). Use null se não encontrar.
- "professor.tutor": extraia o nome do(a) tutor(a) se estiver no documento. Use null se não encontrar.
- "encontros": extraia a seção "DESCRIÇÃO DO(S) ENCONTRO(S) PRESENCIAL(IS) OU VIRTUAL(IS)" (geralmente seção 9). Cada encontro vira um item com: numero, titulo (completo com data), descricao (atividades), data (DD/MM/YYYY do encontro), turnos (1 ou 2, quantidade de turnos), avaliacao ("sem_nota" ou "nota_media"), peso (0 a 100, percentual), nota_titulo (campo "Nota -" da configuração), falta_titulo (campo "Falta -" da configuração). Use [] se não houver seção de encontros.
- "avaliacao_final": extraia a avaliação final (AF). O título deve ser literalmente "[Disciplina] [Avaliação Final]". Sempre retorne este campo.
- "frequencia": extraia o percentual mínimo de frequência exigido (geralmente 75% no IFCE).
- Datas: extraia do cronograma/calendário. Use null se não encontrar.
- "livro_de_notas": extraia os pesos das categorias do sistema de avaliação. Use 40/60 como padrão IFCE se não especificado.
- Notas: extraia os pontos de cada atividade. Use 10 como padrão.

Matriz DE:
`;

// Chama Gemini com retry automático em caso de rate limit (429)
async function geminiGenerate(ai, prompt, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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

      const is429 = body.includes('429') || body.includes('RESOURCE_EXHAUSTED') || body.includes('quota');
      if (!is429 || attempt === maxRetries) throw err;

      const waitSec = Math.ceil(waitMs / 1000);
      console.warn(`  ⏳ Rate limit atingido. Aguardando ${waitSec}s antes de tentar novamente (tentativa ${attempt}/${maxRetries})...`);
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


const PROMPT_QUIZ_BATCH = `Analise os documentos de questões abaixo e extraia CADA UM em JSON.
Retorne SOMENTE JSON válido, sem markdown, sem explicações.

Schema de retorno:
{
  "quizzes": [
    {
      "questoes": [
        { "tipo": "multipla_escolha", "numero": 1, "enunciado": "texto da questão", "pontuacao": 2.0,
          "itens": [{"texto":"alternativa A","isCorrect":false},{"texto":"alternativa B","isCorrect":true}] },
        { "tipo": "associativa", "numero": 2, "enunciado": "texto da questão", "pontuacao": 1.0,
          "itens": [{"texto":"afirmação 1","resposta":"V"},{"texto":"afirmação 2","resposta":"F"}] },
        { "tipo": "dissertativa", "numero": 3, "enunciado": "texto da questão", "pontuacao": 3.0, "feedback": "gabarito opcional" }
      ]
    }
  ]
}

Regras:
- Retorne um item em "quizzes" para CADA documento marcado com === QUIZ N ===, na mesma ordem.
- "multipla_escolha": itens com "texto" e "isCorrect" (boolean). Apenas 1 correto.
- "associativa": itens com "texto" e "resposta" ("V" ou "F").
- "dissertativa": sem itens, pode ter "feedback".
- Preserve fórmulas matemáticas com Unicode (ex: x², √2, aₙ).
- Não inclua caracteres que quebrem JSON.

Documentos:
`;

async function extractAllQuizzes(filePaths, apiKey) {
  const { GoogleGenAI } = require('@google/genai');
  const { processMatriz } = require('./parser');
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

  return s;
}

function safeParseJSON(json, label) {
  try {
    return JSON.parse(json);
  } catch (e) {
    const pos = parseInt((e.message.match(/position (\d+)/) || [])[1]) || 0;
    const snippet = json.slice(Math.max(0, pos - 80), pos + 80);
    console.error(`❌ JSON inválido (${label}) na posição ${pos}:\n...${snippet}...`);
    throw e;
  }
}

// Cria pasta de uploads se não existir
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.listen(PORT, () => {
  console.log(`\n🎓 Matriz DE → Moodle converter`);
  console.log(`🌐 Acesse: http://localhost:${PORT}\n`);

  // Modo CLI: processa matriz.docx automaticamente se existir na pasta do projeto
  const cliFile = path.resolve('matriz.docx');
  if (fs.existsSync(cliFile)) {
    console.log('📂 matriz.docx detectada — iniciando conversão automática...');
    if (!GEMINI_KEY) {
      console.error('❌ GEMINI_KEY não configurada no .env');
      return;
    }
    (async () => {
      try {
        const fullText = await processMatriz(cliFile);
        console.log(`✅ ${fullText.length} caracteres extraídos`);
        const matrizData = await extractDataWithGemini(fullText, GEMINI_KEY);

        // Load quiz question files from quizzes/ folder
        const quizzesDir = path.resolve('quizzes');
        const quizQuestoes = {}; // { 1: [...questoes], 2: [...questoes] }
        if (fs.existsSync(quizzesDir)) {
          const quizFilenames = fs.readdirSync(quizzesDir)
            .filter(f => /^quiz[_-]?(\d+)\.(docx|doc)$/i.test(f))
            .sort((a, b) => parseInt(a.match(/(\d+)/)[1]) - parseInt(b.match(/(\d+)/)[1]));
          console.log(`📂 Pasta quizzes/ encontrada — ${quizFilenames.length} arquivo(s): ${quizFilenames.join(', ') || 'nenhum'}`);
          if (quizFilenames.length > 0) {
            console.log(`📝 Processando ${quizFilenames.length} quiz(zes) em chamada única...`);
            try {
              const quizPaths = quizFilenames.map(f => path.join(quizzesDir, f));
              const allQuizzes = await extractAllQuizzes(quizPaths, GEMINI_KEY);
              quizFilenames.forEach((file, i) => {
                const num = parseInt(file.match(/(\d+)/)[1]);
                quizQuestoes[num] = allQuizzes[i]?.questoes || [];
                console.log(`  ✅ Quiz ${num} (${file}): ${quizQuestoes[num].length} questões`);
              });
            } catch (e) {
              console.warn(`  ⚠️ Erro ao processar quizzes: ${e.message}`);
            }
          }
        } else {
          console.log('ℹ️  Pasta quizzes/ não encontrada — sem questões externas');
        }

        // Attach questions to quizzes in order (quiz_1 → 1st aula with quiz, etc.)
        let quizCounter = 0;
        for (const aula of matrizData.aulas) {
          if (aula.quiz) {
            quizCounter++;
            if (quizQuestoes[quizCounter]) {
              aula.quiz.questoes = quizQuestoes[quizCounter];
            }
          }
        }

        // Load tarefa attachment files from tarefas/ folder
        const tarefasDir = path.resolve('tarefas');
        const tarefaFilesMap = {};
        if (fs.existsSync(tarefasDir)) {
          const tarefaFiles = fs.readdirSync(tarefasDir)
            .filter(f => /tarefa[_-]?(\d+)\./i.test(f));
          console.log(`📂 Pasta tarefas/ encontrada — ${tarefaFiles.length} arquivo(s): ${tarefaFiles.join(', ') || 'nenhum'}`);
          tarefaFiles.forEach(f => {
            const num = parseInt(f.match(/(\d+)/)[1]);
            if (!tarefaFilesMap[num]) tarefaFilesMap[num] = [];
            tarefaFilesMap[num].push({ filePath: path.join(tarefasDir, f), filename: f });
          });
        } else {
          console.log('ℹ️  Pasta tarefas/ não encontrada — sem arquivos de tarefa');
        }
        let tarefaCounter = 0;
        for (const aula of matrizData.aulas) {
          if (aula.tarefa) {
            tarefaCounter++;
            if (tarefaFilesMap[tarefaCounter]) {
              aula.tarefa.arquivos = tarefaFilesMap[tarefaCounter];
              console.log(`  📎 Tarefa ${tarefaCounter}: ${tarefaFilesMap[tarefaCounter].map(f => f.filename).join(', ')}`);
            }
          }
        }

        const mbzPath = await generateMBZ(matrizData);
        const dest = path.resolve(`curso_${matrizData.disciplina?.codigo || 'moodle'}.mbz`);
        fs.copyFileSync(mbzPath, dest);
        fs.unlinkSync(mbzPath);
        console.log(`\n✅ Arquivo gerado: ${dest}`);
        process.exit(0);
      } catch (err) {
        console.error('❌ Erro na conversão automática:', err.message);
        process.exit(1);
      }
    })();
  }
});
