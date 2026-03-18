#!/usr/bin/env node
/**
 * Gera example.txt com o JSON extraído de matriz.docx + quizzes/
 * Uso: node generate_example.js
 */
'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { processMatriz } = require('./ui/server/parser');
const { extractDataWithGemini, extractAllQuizzes } = require('./ui/server/extractor');

const GEMINI_KEY = process.env.GEMINI_KEY;
if (!GEMINI_KEY) { console.error('❌ GEMINI_KEY não encontrada no .env'); process.exit(1); }

async function main() {
  console.log('📄 Lendo matriz.docx...');
  const matrizText = await processMatriz(path.resolve('matriz.docx'));
  console.log(`  ${matrizText.length} caracteres extraídos`);

  console.log('🤖 Enviando para Gemini (matriz)...');
  const matrizData = await extractDataWithGemini(matrizText, GEMINI_KEY);
  console.log(`  ✅ ${matrizData.aulas?.length ?? 0} aula(s) extraída(s)`);

  // Quizzes
  const quizzesDir = path.resolve('quizzes');
  if (fs.existsSync(quizzesDir)) {
    const quizFiles = fs.readdirSync(quizzesDir)
      .filter(f => /^quiz[_-]?\d+\.(docx?|doc)$/i.test(f))
      .sort((a, b) => {
        const na = parseInt((a.match(/(\d+)/) || [0, 0])[1]);
        const nb = parseInt((b.match(/(\d+)/) || [0, 0])[1]);
        return na - nb;
      });

    if (quizFiles.length) {
      console.log(`📝 Processando ${quizFiles.length} quiz(zes)...`);
      const allQuizzes = await extractAllQuizzes(
        quizFiles.map(f => path.join(quizzesDir, f)),
        GEMINI_KEY
      );
      let quizIdx = 0;
      for (const aula of (matrizData.aulas || [])) {
        if (aula.quiz && quizIdx < allQuizzes.length) {
          aula.quiz.questoes = allQuizzes[quizIdx].questoes || [];
          console.log(`  ✅ Quiz ${quizIdx + 1}: ${aula.quiz.questoes.length} questões`);
          quizIdx++;
        }
      }
    }
  }

  // Tarefas: apenas referências de nome
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
        if (tarefaMap[counter]) aula.tarefa.arquivos = tarefaMap[counter];
      }
    }
    console.log(`📎 ${counter} tarefa(s) com arquivos referenciados`);
  }

  const output = JSON.stringify(matrizData, null, 2);
  fs.writeFileSync(path.resolve('example.txt'), output, 'utf8');
  console.log(`\n✅ example.txt salvo (${(output.length / 1024).toFixed(1)} KB)`);
  console.log('   Copie o conteúdo no campo "Usar JSON existente" da UI para pular o Gemini.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
