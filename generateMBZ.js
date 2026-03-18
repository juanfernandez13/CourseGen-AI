#!/usr/bin/env node
/**
 * Pipeline completo local: Matriz DOCX → Gemini → .mbz
 * Uso: node generateMBZ
 *
 * Lê os arquivos da pasta atual:
 *   matriz.docx      — obrigatório
 *   quizzes/         — opcional (quiz_1.docx, quiz_2.docx, ...)
 *   tarefas/         — opcional (tarefa_1.pdf, tarefa_1.docx, ...)
 *
 * Gera: curso_<CODIGO>.mbz na pasta atual
 */
'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');

const { processMatriz } = require('./ui/server/parser');
const { generateMBZ }   = require('./ui/server/mbzGenerator');
const { extractDataWithGemini, extractAllQuizzes } = require('./ui/server/extractor');

const GEMINI_KEY = process.env.GEMINI_KEY;
if (!GEMINI_KEY) { console.error('❌ GEMINI_KEY não encontrada no .env'); process.exit(1); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Matriz
  const matrizPath = path.resolve('matriz.docx');
  if (!fs.existsSync(matrizPath)) {
    console.error('❌ matriz.docx não encontrada na pasta atual');
    process.exit(1);
  }
  console.log('📄 Extraindo texto de matriz.docx...');
  const matrizText = await processMatriz(matrizPath);
  console.log(`  ${matrizText.length} caracteres extraídos`);

  console.log('🤖 Processando com Gemini (matriz)...');
  const matrizData = await extractDataWithGemini(matrizText, GEMINI_KEY);
  console.log(`  ✅ ${matrizData.aulas?.length ?? 0} aula(s) extraída(s)`);

  // 2. Quizzes (chamada única em batch)
  const quizzesDir = path.resolve('quizzes');
  if (fs.existsSync(quizzesDir)) {
    const quizFiles = fs.readdirSync(quizzesDir)
      .filter(f => /^quiz[_-]?\d+\.(docx?|doc)$/i.test(f))
      .sort((a, b) => {
        const na = parseInt((a.match(/(\d+)/) || [0, 0])[1]);
        const nb = parseInt((b.match(/(\d+)/) || [0, 0])[1]);
        return na - nb;
      });

    if (quizFiles.length > 0) {
      console.log(`📝 Processando ${quizFiles.length} quiz(zes) em chamada única...`);
      const allQuizzes = await extractAllQuizzes(
        quizFiles.map(f => path.join(quizzesDir, f)),
        GEMINI_KEY
      );

      let quizIdx = 0;
      for (const aula of (matrizData.aulas || [])) {
        if (aula.quiz && quizIdx < allQuizzes.length) {
          aula.quiz.questoes = allQuizzes[quizIdx].questoes || [];
          console.log(`  ✅ Quiz ${quizIdx + 1}: ${aula.quiz.questoes.length} questão(ões)`);
          quizIdx++;
        }
      }
    } else {
      console.log('ℹ️  Pasta quizzes/ sem arquivos quiz_N.docx');
    }
  } else {
    console.log('ℹ️  Pasta quizzes/ não encontrada — sem quizzes');
  }

  // 3. Tarefas (apenas referências de caminho, os arquivos serão embutidos no MBZ)
  const tarefasDir = path.resolve('tarefas');
  if (fs.existsSync(tarefasDir)) {
    const tarefaMap = {};
    for (const f of fs.readdirSync(tarefasDir)) {
      const m = f.match(/tarefa[_-]?(\d+)/i);
      if (m) {
        const n = parseInt(m[1]);
        if (!tarefaMap[n]) tarefaMap[n] = [];
        tarefaMap[n].push({ filename: f, filePath: path.join(tarefasDir, f) });
      }
    }
    let counter = 0;
    for (const aula of (matrizData.aulas || [])) {
      if (aula.tarefa) {
        counter++;
        if (tarefaMap[counter]) {
          aula.tarefa.arquivos = tarefaMap[counter];
          console.log(`  📎 Tarefa ${counter}: ${tarefaMap[counter].map(f => f.filename).join(', ')}`);
        }
      }
    }
  } else {
    console.log('ℹ️  Pasta tarefas/ não encontrada — sem arquivos de tarefa');
  }

  // 4. Gera .mbz
  console.log('\n📦 Gerando arquivo .mbz...');
  const mbzTmp = await generateMBZ(matrizData);
  const codigo = matrizData.disciplina?.codigo || 'moodle';
  const dest   = path.resolve(`curso_${codigo}.mbz`);
  fs.copyFileSync(mbzTmp, dest);
  fs.unlinkSync(mbzTmp);

  console.log(`\n✅ Arquivo gerado: ${dest}`);
}

main().catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
