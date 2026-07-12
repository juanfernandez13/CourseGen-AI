'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTaskNumber, mapTaskFiles } = require('./taskFileMapper');

test('reconhece número com espaço, underscore ou hífen', () => {
  assert.equal(extractTaskNumber('Tarefa 3_Aula 3_Metodologia.docx'), 3);
  assert.equal(extractTaskNumber('tarefa_2.pdf'), 2);
  assert.equal(extractTaskNumber('TAREFA-10-anexo.zip'), 10);
});

test('agrupa extensões da mesma tarefa pelo número explícito', () => {
  const mapped = mapTaskFiles([
    { name: 'Tarefa 2_Aula 2_Disciplina.pdf' },
    { name: 'Tarefa 1_Aula 1_Disciplina.docx' },
    { name: 'Tarefa 2_Aula 2_Disciplina.docx' },
  ]);

  assert.equal(mapped[1].length, 1);
  assert.equal(mapped[2].length, 2);
});

test('usa grupos em ordem alfabética quando não há número', () => {
  const mapped = mapTaskFiles([
    { name: 'Zoologia.pdf' },
    { name: 'Álgebra.docx' },
    { name: 'Algebra.pdf' },
    { name: 'Metodologia.pdf' },
  ]);

  assert.deepEqual(mapped[1].map(file => file.name), ['Álgebra.docx', 'Algebra.pdf']);
  assert.deepEqual(mapped[2].map(file => file.name), ['Metodologia.pdf']);
  assert.deepEqual(mapped[3].map(file => file.name), ['Zoologia.pdf']);
});

test('fallback alfabético não sobrescreve números explícitos', () => {
  const mapped = mapTaskFiles([
    { name: 'Tarefa 2_Declarada.pdf' },
    { name: 'Primeira sem número.pdf' },
    { name: 'Terceira sem número.pdf' },
  ]);

  assert.equal(mapped[1][0].name, 'Primeira sem número.pdf');
  assert.equal(mapped[2][0].name, 'Tarefa 2_Declarada.pdf');
  assert.equal(mapped[3][0].name, 'Terceira sem número.pdf');
});
