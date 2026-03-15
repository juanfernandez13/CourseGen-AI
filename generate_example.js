#!/usr/bin/env node
/**
 * Gera example.txt com o JSON extraído de matriz.docx + quizzes/
 * Uso: node generate_example.js
 */
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { processMatriz }   = require('./parser');
const { GoogleGenAI }     = require('@google/genai');
const { jsonrepair }      = require('jsonrepair');

const GEMINI_KEY = process.env.GEMINI_KEY;
if (!GEMINI_KEY) { console.error('❌ GEMINI_KEY não encontrada no .env'); process.exit(1); }

/* ─── helpers (copiados do server.js) ──────────────────────────────────── */
async function geminiGenerate(ai, prompt, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return response;
    } catch (e) {
      const body = e?.message ?? '';
      const is429 = body.includes('429') || body.includes('RESOURCE_EXHAUSTED') || body.includes('quota');
      const is503 = body.includes('503') || body.includes('UNAVAILABLE');
      if ((is429 || is503) && attempt < maxRetries) {
        let waitMs = 60000;
        try {
          const parsed = JSON.parse(body);
          const retryInfo = parsed?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
          if (retryInfo?.retryDelay) waitMs = parseInt(retryInfo.retryDelay) * 1000;
        } catch {}
        const code = is429 ? '429' : '503';
        console.log(`  ⏳ Gemini indisponível (${code}). Aguardando ${Math.round(waitMs/1000)}s (tentativa ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitMs));
      } else throw e;
    }
  }
}

function cleanJSON(text) {
  let s = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  const start = s.search(/[{[]/);
  const end   = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  s = s.replace(/,\s*([}\]])/g, '$1');
  return s;
}

function safeParseJSON(json, label) {
  try { return JSON.parse(json); }
  catch {
    try { return JSON.parse(jsonrepair(json)); }
    catch (e2) { throw new Error(`JSON inválido (${label}): ${e2.message}`); }
  }
}

/* ─── prompts (mesmos do server.js) ──────────────────────────────────── */
const PROMPT_SCHEMA = fs.readFileSync('./server.js', 'utf8').match(/const PROMPT_SCHEMA = `([\s\S]*?)`;/)?.[1] ?? '';
const PROMPT_QUIZ   = fs.readFileSync('./server.js', 'utf8').match(/const PROMPT_QUIZ = `([\s\S]*?)`;/)?.[1] ?? '';

/* ─── main ──────────────────────────────────────────────────────────────── */
async function main() {
  const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

  console.log('📄 Lendo matriz.docx...');
  const matrizText = await processMatriz(path.resolve('matriz.docx'));
  console.log(`  ${matrizText.length} caracteres extraídos`);

  console.log('🤖 Enviando para Gemini (matriz)...');
  const matrizResp = await geminiGenerate(ai, PROMPT_SCHEMA + matrizText);
  const matrizJson = cleanJSON(matrizResp.text);
  const matrizData = safeParseJSON(matrizJson, 'matriz');
  console.log('  ✅ Matriz extraída');

  // Quizzes
  const quizzesDir = path.resolve('quizzes');
  if (fs.existsSync(quizzesDir)) {
    const quizFiles = fs.readdirSync(quizzesDir)
      .filter(f => /\.(docx?|pdf)$/i.test(f))
      .sort((a, b) => {
        const na = parseInt((a.match(/(\d+)/) || [0,0])[1]);
        const nb = parseInt((b.match(/(\d+)/) || [0,0])[1]);
        return na - nb;
      });

    if (quizFiles.length) {
      console.log(`📝 Processando ${quizFiles.length} quiz(zes)...`);
      const texts = await Promise.all(
        quizFiles.map(f => processMatriz(path.join(quizzesDir, f)))
      );
      const combined = quizFiles.map((name, i) =>
        `=== ${name} ===\n${texts[i]}`
      ).join('\n\n');

      const quizResp = await geminiGenerate(ai, PROMPT_QUIZ + combined);
      const quizJson = cleanJSON(quizResp.text);
      const allQuizzes = safeParseJSON(quizJson, 'quizzes');

      const quizList = Array.isArray(allQuizzes) ? allQuizzes : [allQuizzes];
      let quizIdx = 0;
      for (const aula of (matrizData.aulas || [])) {
        if (aula.quiz && quizIdx < quizList.length) {
          aula.quiz.questoes = quizList[quizIdx].questoes || [];
          console.log(`  ✅ Quiz ${quizIdx + 1}: ${aula.quiz.questoes.length} questões`);
          quizIdx++;
        }
      }
    }
  }

  // Tarefas: apenas referências de nome (arquivos não são lidos aqui)
  const tarefasDir = path.resolve('tarefas');
  if (fs.existsSync(tarefasDir)) {
    const tarefaFiles = fs.readdirSync(tarefasDir).filter(f => /\.(docx?|pdf)$/i.test(f));
    const tarefaMap = {};
    for (const f of tarefaFiles) {
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
