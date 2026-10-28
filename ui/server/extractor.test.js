'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { geminiGenerate } = require('./extractor');

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
