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

/* O anexo por bloco (ReviewStep) grava a escolha como prefixo "tarefa_N__".
 * Estes testes fixam esse contrato entre a UI e o mapper. */

test('prefixo tarefa_N__ da associação explícita resolve para N', () => {
  const mapped = mapTaskFiles([
    { name: 'tarefa_3__Trabalho final.pdf' },
    { name: 'tarefa_1__Estudo de caso.docx' },
  ]);

  assert.equal(mapped[1][0].name, 'tarefa_1__Estudo de caso.docx');
  assert.equal(mapped[3][0].name, 'tarefa_3__Trabalho final.pdf');
});

test('prefixo explícito vence número que já existia no nome original', () => {
  const mapped = mapTaskFiles([{ name: 'tarefa_2__Tarefa 7 revisada.pdf' }]);

  assert.equal(mapped[2].length, 1);
  assert.equal(mapped[7], undefined);
});

test('arquivos anexados por bloco convivem com os enviados em lote', () => {
  const mapped = mapTaskFiles([
    { name: 'tarefa_2__Anexado no bloco.pdf' },
    { name: 'Sem numero.pdf' },
  ]);

  assert.equal(mapped[1][0].name, 'Sem numero.pdf');
  assert.equal(mapped[2][0].name, 'tarefa_2__Anexado no bloco.pdf');
});

/* ─── Quizzes ─────────────────────────────────────────────────────────────
 * Mesma regra das tarefas: número explícito no nome vence; sem número, vale a
 * ordem natural. Antes disso a associação seguia a ordem de seleção do
 * navegador, que não é garantida. */

const { mapQuizFiles, extractQuizNumber } = require('./taskFileMapper');

test('reconhece Quiz e Questionário, com ou sem acento', () => {
  assert.equal(extractQuizNumber('2.Quiz_3_-_Aula_3.docx'), 3);
  assert.equal(extractQuizNumber('Questionário 5.docx'), 5);
  assert.equal(extractQuizNumber('questionario-2.docx'), 2);
  assert.equal(extractQuizNumber('QUIZ 10 revisado.docx'), 10);
});

test('número do quiz não é confundido com o prefixo de ordem', () => {
  const mapped = mapQuizFiles([
    { name: '7._Quiz_4_-_Aula_4.docx' },
    { name: '4._Quiz_1_-_Aula_1.docx' },
  ]);

  assert.equal(mapped[1][0].name, '4._Quiz_1_-_Aula_1.docx');
  assert.equal(mapped[4][0].name, '7._Quiz_4_-_Aula_4.docx');
  assert.equal(mapped[7], undefined);
});

test('quiz sem número cai na ordem natural, com 10 depois de 4', () => {
  const mapped = mapQuizFiles([
    { name: '10_prova_final.docx' },
    { name: '4_prova_inicial.docx' },
  ]);

  assert.equal(mapped[1][0].name, '4_prova_inicial.docx');
  assert.equal(mapped[2][0].name, '10_prova_final.docx');
});

test('a ordem de seleção não altera o resultado', () => {
  const arquivos = [{ name: 'Quiz 2.docx' }, { name: 'Quiz 1.docx' }, { name: 'Quiz 3.docx' }];
  const direto    = mapQuizFiles(arquivos);
  const invertido = mapQuizFiles([...arquivos].reverse());

  for (const n of [1, 2, 3]) {
    assert.equal(direto[n][0].name, invertido[n][0].name);
  }
});

test('rótulo de tarefa não é lido como quiz, e vice-versa', () => {
  assert.equal(extractQuizNumber('Tarefa 3.docx'), null);
  assert.equal(extractTaskNumber('Quiz 3.docx'), null);
});

test('lacuna na numeração preserva as posições declaradas', () => {
  const mapped = mapQuizFiles([{ name: 'Quiz 1.docx' }, { name: 'Quiz 4.docx' }]);

  assert.equal(mapped[1][0].name, 'Quiz 1.docx');
  assert.equal(mapped[4][0].name, 'Quiz 4.docx');
  assert.equal(mapped[2], undefined);
});

/* ─── Mover arquivo de tarefa na revisão ──────────────────────────────────
 * A tela reetiqueta com o prefixo "tarefa_N__". Estes testes garantem que
 * mover não empilha prefixos nem se confunde com o número do nome original. */

const PREFIXO_MANUAL = /^tarefa[\s_-]*\d+__/i;
const mover = (nome, n) => `tarefa_${n}__${nome.replace(PREFIXO_MANUAL, '')}`;

test('mover vence o número que já existia no nome original', () => {
  const movido = mover('4.Tarefa_1-_Aula_1.docx', 5);
  assert.equal(Number(Object.keys(mapTaskFiles([{ name: movido }]))[0]), 5);
});

test('mover duas vezes troca o destino sem empilhar prefixo', () => {
  const duasVezes = mover(mover('4.Tarefa_1-_Aula_1.docx', 5), 2);

  assert.equal(duasVezes, 'tarefa_2__4.Tarefa_1-_Aula_1.docx');
  assert.equal(Number(Object.keys(mapTaskFiles([{ name: duasVezes }]))[0]), 2);
});

test('mover um arquivo não arrasta os outros da mesma tarefa', () => {
  const mapped = mapTaskFiles([
    { name: mover('7._Tarefa_4_-_Aula_4.docx', 1) },
    { name: '7.1_Tarefa_4_-_Aula_4.pdf' },
  ]);

  assert.equal(mapped[1][0].name, 'tarefa_1__7._Tarefa_4_-_Aula_4.docx');
  assert.equal(mapped[4][0].name, '7.1_Tarefa_4_-_Aula_4.pdf');
});
