require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processMatriz } = require('./ui/server/parser');
const { generateMBZ } = require('./ui/server/mbzGenerator');
const { extractDataWithGemini, extractAllQuizzes } = require('./ui/server/extractor');

const GEMINI_KEY = process.env.GEMINI_KEY;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

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
        for (const aula of (matrizData.aulas || [])) {
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
    for (const aula of (matrizData.aulas || [])) {
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

// Rota de preview: retorna JSON (com questões de quizzes se enviados)
app.post('/preview', uploadFields, async (req, res) => {
  const matrizFile = req.files?.matriz?.[0];
  if (!matrizFile) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_KEY não configurada no .env' });

  const quizFiles = (req.files?.quizzes || []).sort((a, b) => {
    const na = parseInt((a.originalname.match(/(\d+)/) || [0, 0])[1]);
    const nb = parseInt((b.originalname.match(/(\d+)/) || [0, 0])[1]);
    return na - nb;
  });

  try {
    const fullText = await processMatriz(matrizFile.path);
    const matrizData = await extractDataWithGemini(fullText, GEMINI_KEY);
    fs.unlink(matrizFile.path, () => {});

    // Attach quiz questions if quiz files were uploaded
    if (quizFiles.length > 0) {
      try {
        const allQuizzes = await extractAllQuizzes(quizFiles.map(f => f.path), GEMINI_KEY);
        let quizIdx = 0;
        for (const aula of (matrizData.aulas || [])) {
          if (aula.quiz && quizIdx < allQuizzes.length) {
            aula.quiz.questoes = allQuizzes[quizIdx].questoes || [];
            quizIdx++;
          }
        }
      } catch (e) {
        console.warn(`  ⚠️ Erro ao processar quizzes no preview: ${e.message}`);
      } finally {
        quizFiles.forEach(f => fs.unlink(f.path, () => {}));
      }
    }

    res.json({ success: true, data: matrizData });
  } catch (error) {
    fs.unlink(matrizFile.path, () => {});
    quizFiles.forEach(f => fs.unlink(f.path, () => {}));
    res.status(500).json({ error: error.message });
  }
});

// Rota: gera .mbz a partir de JSON editado + arquivos de quiz/tarefa
app.post('/generate', uploadFields, async (req, res) => {
  if (!req.body.matrizJson) return res.status(400).json({ error: 'matrizJson não enviado.' });

  let matrizData;
  try {
    matrizData = JSON.parse(req.body.matrizJson);
  } catch (e) {
    return res.status(400).json({ error: `JSON inválido: ${e.message}` });
  }

  const quizFiles = (req.files?.quizzes || []).sort((a, b) => {
    const na = parseInt((a.originalname.match(/(\d+)/) || [0, 0])[1]);
    const nb = parseInt((b.originalname.match(/(\d+)/) || [0, 0])[1]);
    return na - nb;
  });

  try {
    // Attach quiz questions
    if (quizFiles.length > 0) {
      console.log(`📝 Processando ${quizFiles.length} quiz(zes)...`);
      try {
        const allQuizzes = await extractAllQuizzes(quizFiles.map(f => f.path), GEMINI_KEY);
        let quizIdx = 0;
        for (const aula of (matrizData.aulas || [])) {
          if (aula.quiz && quizIdx < allQuizzes.length) {
            aula.quiz.questoes = allQuizzes[quizIdx].questoes || [];
            quizIdx++;
          }
        }
      } catch (e) {
        console.warn(`  ⚠️ Erro ao processar quizzes: ${e.message}`);
      } finally {
        quizFiles.forEach(f => fs.unlink(f.path, () => {}));
      }
    }

    // Attach tarefa files
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
    for (const aula of (matrizData.aulas || [])) {
      if (aula.tarefa) {
        tarefaCounter++;
        if (tarefaFilesMap[tarefaCounter]) aula.tarefa.arquivos = tarefaFilesMap[tarefaCounter];
      }
    }

    console.log('📦 Gerando arquivo .mbz...');
    const mbzPath = await generateMBZ(matrizData);
    const filename = `curso_${matrizData.disciplina?.codigo || 'moodle'}.mbz`;

    res.download(mbzPath, filename, () => {
      fs.unlink(mbzPath, () => {});
    });
  } catch (error) {
    console.error('❌ Erro ao gerar MBZ:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    // Garante limpeza dos arquivos de tarefa em qualquer caso
    for (const files of Object.values(tarefaFilesMap ?? {}))
      files.forEach(f => fs.unlink(f.filePath, () => {}));
  }
});

// Cria pasta de uploads se não existir
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.listen(PORT, () => {
  console.log(`\n🎓 Matriz DE → Moodle converter`);
  console.log(`🌐 API: http://localhost:${PORT}\n`);

  // Modo CLI: processa matriz.docx automaticamente se existir na pasta do projeto
  // (desativado quando rodando junto com a UI — use `node cli.js` para modo CLI)
  if (process.env.CLI_MODE !== '1') return;

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
        for (const aula of (matrizData.aulas || [])) {
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
        for (const aula of (matrizData.aulas || [])) {
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
