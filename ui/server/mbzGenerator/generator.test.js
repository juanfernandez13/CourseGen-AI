'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { generateMBZ } = require('./index');
const { createGenerationModel } = require('./model');

test('createGenerationModel centraliza IDs e descritores das atividades', () => {
  const model = createGenerationModel({
    disciplina: { nome: 'Curso', codigo: 'TST' },
    aulas: [{ forum: { titulo: 'Fórum' }, quiz: { titulo: 'Quiz' } }],
    encontros: [],
  }, 10000);

  assert.equal(model.ids.aulaIds[0].sectionId, 10300);
  assert.deepEqual(model.allActivities.map(item => item.modulename), ['forum', 'quiz', 'assign']);
  assert.equal(model.allSections.length, 4);
});

test('generateMBZ produz um arquivo gzip Moodle não vazio', async () => {
  const output = await generateMBZ({
    disciplina: { nome: 'Curso de teste', codigo: 'TST001' },
    professor: { nome: 'Docente' },
    aulas: [{
      numero: 1,
      titulo: 'Aula 1',
      data_inicio: '01/08/2026',
      forum: { titulo: 'Fórum 1', descricao: 'Discussão' },
      tarefa: { titulo: 'Tarefa 1', descricao: 'Entrega' },
    }],
    encontros: [],
    avaliacao_final: { titulo: '[Disciplina] [Avaliação Final]' },
  });

  try {
    const content = fs.readFileSync(output);
    assert.ok(content.length > 1000);
    assert.equal(content[0], 0x1f);
    assert.equal(content[1], 0x8b);
  } finally {
    fs.rmSync(output, { force: true });
  }
});
