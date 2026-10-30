'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { geminiGenerate, extractAllQuizzes } = require('./extractor');

const erro503 = () => Object.assign(
  new Error('{"error":{"code":503,"message":"The model is overloaded.","status":"UNAVAILABLE"}}'),
  { status: 503 },
);
const erro404 = () => new Error('{"error":{"code":404,"message":"model not found","status":"NOT_FOUND"}}');
const erro429 = (retryDelay) => new Error(JSON.stringify({
  error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay }] },
}));

/** ai falso: cada item de `respostas` é o que o modelo devolve na N-ésima chamada. */
function aiFalso(respostas) {
  const chamadas = [];
  return {
    chamadas,
    models: {
      async generateContent({ model }) {
        chamadas.push(model);
        const r = respostas[chamadas.length - 1];
        if (r instanceof Error) throw r;
        return r;
      },
    },
  };
}

const opts = (extra = {}) => ({ models: ['a', 'b'], sleep: async () => {}, random: () => 0, ...extra });

test('503 transitório: repete no mesmo modelo e devolve a resposta', async () => {
  const ai = aiFalso([erro503(), erro503(), { text: 'ok' }]);
  const r = await geminiGenerate(ai, 'p', opts());
  assert.equal(r.text, 'ok');
  assert.deepEqual(ai.chamadas, ['a', 'a', 'a']);
});

test('503 persistente: depois das tentativas cai para o modelo seguinte', async () => {
  const ai = aiFalso([erro503(), erro503(), erro503(), { text: 'do b' }]);
  const r = await geminiGenerate(ai, 'p', opts());
  assert.equal(r.text, 'do b');
  assert.deepEqual(ai.chamadas, ['a', 'a', 'a', 'b']);
});

test('todos os modelos fora do ar: lança o último erro (ainda um 503)', async () => {
  const ai = aiFalso(Array.from({ length: 6 }, erro503));
  await assert.rejects(geminiGenerate(ai, 'p', opts()), /503/);
  assert.equal(ai.chamadas.length, 6);
});

test('backoff cresce a cada tentativa e soma jitter', async () => {
  const esperas = [];
  const ai = aiFalso([erro503(), erro503(), { text: 'ok' }]);
  await geminiGenerate(ai, 'p', opts({ sleep: async ms => { esperas.push(ms); }, random: () => 0.5 }));
  assert.deepEqual(esperas, [3500, 6500]);
});

test('modelo inexistente (404) é pulado sem repetir', async () => {
  const ai = aiFalso([erro404(), { text: 'do b' }]);
  const r = await geminiGenerate(ai, 'p', opts());
  assert.equal(r.text, 'do b');
  assert.deepEqual(ai.chamadas, ['a', 'b']);
});

test('429 com espera longa troca de modelo em vez de dormir', async () => {
  const esperas = [];
  const ai = aiFalso([erro429('55s'), { text: 'do b' }]);
  const r = await geminiGenerate(ai, 'p', opts({ sleep: async ms => { esperas.push(ms); } }));
  assert.equal(r.text, 'do b');
  assert.deepEqual(esperas, []);
});

test('erro que não é de disponibilidade (chave inválida) falha na hora', async () => {
  const ai = aiFalso([new Error('{"error":{"code":403,"message":"API key not valid"}}')]);
  await assert.rejects(geminiGenerate(ai, 'p', opts()), /API key/);
  assert.deepEqual(ai.chamadas, ['a']);
});

const erro504 = () => new Error('{"error":{"code":504,"message":"Deadline expired","status":"DEADLINE_EXCEEDED"}}');

/** Relógio falso: cada leitura avança `passo` ms, o que simula tentativas lentas. */
function relogio(passo) {
  let t = 0;
  return () => { const v = t; t += passo; return v; };
}

test('504 não é repetido no mesmo modelo: passa direto para o seguinte', async () => {
  const ai = aiFalso([erro504(), { text: 'do b' }]);
  const r = await geminiGenerate(ai, 'p', opts());
  assert.equal(r.text, 'do b');
  assert.deepEqual(ai.chamadas, ['a', 'b']);
});

test('interrupção por tempo (AbortError) também troca de modelo, com erro legível', async () => {
  const abort = () => Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
  const ai = aiFalso([abort(), abort()]);
  await assert.rejects(geminiGenerate(ai, 'p', opts()), /DEADLINE_EXCEEDED/);
  assert.deepEqual(ai.chamadas, ['a', 'b']);
});

test('cada tentativa leva um AbortSignal limitado pelo que resta do orçamento', async () => {
  const sinais = [];
  const ai = { models: { async generateContent(p) { sinais.push(p.config.abortSignal); return { text: 'ok' }; } } };
  await geminiGenerate(ai, 'p', opts({ budgetMs: 60000, attemptTimeoutMs: 1000 }));
  assert.equal(sinais.length, 1);
  assert.ok(sinais[0] instanceof AbortSignal);
});

test('orçamento esgotado: não começa outra tentativa e lança o último erro', async () => {
  // Cada leitura do relógio avança 100s; o orçamento de 240s não chega à 3ª tentativa.
  const ai = aiFalso(Array.from({ length: 6 }, erro503));
  await assert.rejects(geminiGenerate(ai, 'p', opts({ now: relogio(100000) })), /503/);
  assert.ok(ai.chamadas.length < 6, `fez ${ai.chamadas.length} chamadas`);
});

test('sem tempo nem para esperar o backoff: desiste em vez de dormir', async () => {
  const esperas = [];
  const ai = aiFalso([erro503(), erro503(), erro503()]);
  await assert.rejects(
    geminiGenerate(ai, 'p', opts({ budgetMs: 17000, sleep: async ms => { esperas.push(ms); } })),
    /503/,
  );
  assert.deepEqual(esperas, []);
  assert.deepEqual(ai.chamadas, ['a']);
});

test('extractAllQuizzes: uma chamada por arquivo, resultado na ordem dos arquivos', async () => {
  const prompts = [];
  const ai = {
    models: {
      async generateContent({ contents }) {
        prompts.push(contents);
        const n = contents.match(/texto-(\d)/)[1];
        // Quem tem número menor responde por último, para provar que a ordem vem do índice.
        await new Promise(r => setTimeout(r, (4 - Number(n)) * 10));
        return { text: JSON.stringify({ quizzes: [{ questoes: [{ numero: Number(n) }] }] }) };
      },
    },
  };
  const arquivos = ['1', '2', '3'];
  const r = await extractAllQuizzes(arquivos, 'k', { ai, readText: async f => `texto-${f}` });
  assert.equal(prompts.length, 3);
  for (const p of prompts) assert.equal((p.match(/=== QUIZ \d+ ===/g) || []).length, 1);
  assert.deepEqual(r.map(q => q.questoes[0].numero), [1, 2, 3]);
});

test('extractAllQuizzes: resposta sem questionário vira lista vazia, não quebra o alinhamento', async () => {
  const ai = { models: { async generateContent() { return { text: '{"quizzes": []}' }; } } };
  const r = await extractAllQuizzes(['1'], 'k', { ai, readText: async () => 'texto' });
  assert.deepEqual(r, [{ questoes: [] }]);
});

test('extractAllQuizzes: falha de um arquivo falha o lote e para de abrir chamadas novas', async () => {
  let chamadas = 0;
  const ai = {
    models: {
      async generateContent() {
        chamadas++;
        throw new Error('{"error":{"code":403,"message":"API key not valid"}}');
      },
    },
  };
  const arquivos = Array.from({ length: 10 }, (_, i) => String(i));
  await assert.rejects(extractAllQuizzes(arquivos, 'k', { ai, readText: async () => 'texto' }), /API key/);
  assert.ok(chamadas <= 4, `fez ${chamadas} chamadas`);
});
