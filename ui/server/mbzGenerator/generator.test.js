'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const { generateMBZ } = require('./index');
const { createGenerationModel, normalizeMural } = require('./model');

function readFirstArchiveEntry(archivePath, pattern) {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    let result = null;

    extract.on('entry', (header, stream, next) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        if (!result && pattern.test(header.name)) {
          result = { name: header.name, content: Buffer.concat(chunks).toString('utf8') };
        }
        next();
      });
      stream.on('error', reject);
      stream.resume();
    });
    extract.on('finish', () => resolve(result));
    extract.on('error', reject);
    fs.createReadStream(archivePath).pipe(zlib.createGunzip()).pipe(extract);
  });
}

function readArchiveEntries(archivePath, pattern) {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    const results = [];

    extract.on('entry', (header, stream, next) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        if (pattern.test(header.name)) {
          results.push({ name: header.name, content: Buffer.concat(chunks).toString('utf8') });
        }
        next();
      });
      stream.on('error', reject);
      stream.resume();
    });
    extract.on('finish', () => resolve(results));
    extract.on('error', reject);
    fs.createReadStream(archivePath).pipe(zlib.createGunzip()).pipe(extract);
  });
}

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

test('normalizeMural separa título, mensagem pedagógica e elementos fixos do Moodle', () => {
  const mural = normalizeMural({
    descricao: `Progressões e Matemática Financeira / Polo
Caro(a) aluno(a),
Seja bem-vindo(a)!
Estamos iniciando nossas atividades na disciplina.
Ao longo das aulas, estudaremos os principais conteúdos.
Bons estudos!
Livro da disciplina
PUD
Biblioteca
PROFESSORES(AS)
PROFª DIANA ELIZABETTE
AGENDA
NAVEGAÇÃO
ADMINISTRAÇÃO`,
  });

  assert.equal(mural.titulo, 'Progressões e Matemática Financeira / Polo');
  assert.equal(mural.descricao,
    'Seja bem-vindo(a)!\n\nEstamos iniciando nossas atividades na disciplina.\n\nAo longo das aulas, estudaremos os principais conteúdos.');
});

test('título literal do mural tem prioridade sobre polos da tabela de tutores', () => {
  const model = createGenerationModel({
    disciplina: {
      nome: 'Progressões e Matemática Financeira',
      polo: 'Caucaia, Itapipoca, Ubajara, Orós, Camocim, Meruoca',
    },
    mural: {
      titulo: 'Progressões e Matemática Financeira / Polo',
      descricao: 'Seja bem-vindo(a)!\n\nMensagem.',
    },
  }, 10000);

  assert.equal(model.sec0Title, 'Progressões e Matemática Financeira / Polo');
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
    encontros: [{
      numero: 2,
      titulo: 'Encontro Presencial 2',
      avaliacao: 'nota_media',
      nota_titulo: '[Encontro Presencial 2] [Avaliação I] [100]',
    }],
    avaliacao_final: { titulo: '[Disciplina] [Avaliação Final]' },
  });

  try {
    const content = fs.readFileSync(output);
    assert.ok(content.length > 1000);
    assert.equal(content[0], 0x1f);
    assert.equal(content[1], 0x8b);

    const inforefEntry = await readFirstArchiveEntry(
      output,
      /activities\/forum_(\d+)\/inforef\.xml/,
    );
    assert.ok(inforefEntry, 'inforef.xml do fórum deve existir no MBZ');
    const forumId = Number(inforefEntry.name.match(/forum_(\d+)/)[1]);
    assert.match(inforefEntry.content, new RegExp(`<id>${forumId + 90000}<\\/id>`));

    const gradebookEntry = await readFirstArchiveEntry(output, /^gradebook\.xml$/);
    const categoryIds = [...gradebookEntry.content.matchAll(/<grade_category id="(\d+)">/g)]
      .map(match => Number(match[1]));
    assert.equal(categoryIds.length, 3);

    const forumGradesEntry = await readFirstArchiveEntry(
      output,
      new RegExp(`activities/forum_${forumId}/grades\\.xml`),
    );
    assert.match(forumGradesEntry.content, new RegExp(`<categoryid>${categoryIds[1]}<\\/categoryid>`));
    const categoryItems = [...gradebookEntry.content.matchAll(/<grade_item id="\d+">([\s\S]*?)<\/grade_item>/g)]
      .map(match => match[1])
      .filter(item => item.includes('<itemtype>category</itemtype>'));
    assert.equal(categoryItems.length, 2);
    for (const item of categoryItems) {
      assert.match(item, /<categoryid>\$@NULL@\$<\/categoryid>/);
    }

    const activityGrades = await readArchiveEntries(output, /activities\/[^/]+\/grades\.xml$/);
    const eadGrades = activityGrades.filter(entry =>
      entry.content.includes('<itemname>Fórum 1</itemname>') ||
      entry.content.includes('<itemname>Tarefa 1</itemname>'));
    const finalGrade = activityGrades.find(entry =>
      entry.content.includes('<itemname>[Disciplina] [Avaliação Final]</itemname>'));
    const presencialGrade = activityGrades.find(entry =>
      entry.content.includes('<itemname>[Encontro Presencial 2] [Avaliação I] [100]</itemname>'));
    assert.equal(eadGrades.length, 2);
    for (const entry of eadGrades) {
      assert.match(entry.content, new RegExp(`<categoryid>${categoryIds[1]}<\\/categoryid>`));
    }
    assert.ok(presencialGrade, 'a prova do encontro deve possuir item de nota');
    assert.match(presencialGrade.content,
      new RegExp(`<categoryid>${categoryIds[2]}<\\/categoryid>`));
    assert.ok(finalGrade, 'a avaliação final deve possuir item de nota');
    assert.match(finalGrade.content, new RegExp(`<categoryid>${categoryIds[0]}<\\/categoryid>`));
  } finally {
    fs.rmSync(output, { force: true });
  }
});

/* ─── Livro de notas personalizável ───────────────────────────────────────── */

const { normalizeCategorias } = require('./model');

test('categorias: sem "tipos" declarado, mantém o comportamento histórico', () => {
  const [ead, presencial] = normalizeCategorias(undefined);

  assert.equal(ead.nome, 'Atividades a distância');
  assert.equal(ead.peso, 40);
  assert.ok(ead.tipos.includes('forum') && ead.tipos.includes('tarefa'));
  assert.deepEqual(presencial.tipos, ['encontro']);
});

test('categorias: aceita mais de duas, com tipos próprios', () => {
  const cats = normalizeCategorias([
    { nome: 'Unidade I',  peso: 30, tipos: ['forum', 'quiz'] },
    { nome: 'Unidade II', peso: 30, tipos: ['tarefa'] },
    { nome: 'Presencial', peso: 40, tipos: ['encontro'] },
  ]);

  assert.equal(cats.length, 3);
  assert.deepEqual(cats.map(c => c.peso), [30, 30, 40]);
  assert.deepEqual(cats[1].tipos, ['tarefa']);
});

test('categorias: peso inválido vira 0 em vez de NaN no XML', () => {
  assert.equal(normalizeCategorias([{ nome: 'X', peso: 'abc' }])[0].peso, 0);
  assert.equal(normalizeCategorias([{ nome: 'X' }])[0].peso, 0);
});

test('sortorder: numeração densa, categoria antes dos seus filhos', () => {
  const model = createGenerationModel({
    disciplina: { nome: 'D', codigo: 'D1' },
    aulas: [
      { titulo: 'A1', forum: { titulo: 'F1' }, tarefa: { titulo: 'T1' } },
      { titulo: 'A2', quiz: { titulo: 'Q2' } },
    ],
    encontros: [{ numero: 1, avaliacao: 'nota_media' }],
  }, 1000);

  const { gradeSort, aulaIds, encontrosIds } = model.ids;

  assert.equal(gradeSort.course, 1);
  // Categoria EaD abre em 2; seus três itens ocupam 3, 4 e 5.
  assert.equal(gradeSort.categorias[0], 2);
  assert.deepEqual(
    [aulaIds[0].forumId, aulaIds[0].assignId, aulaIds[1].quizId].map(id => gradeSort.porAtividade[id]),
    [3, 4, 5],
  );
  // Presencial vem depois, colada no seu único filho.
  assert.equal(gradeSort.categorias[1], 6);
  assert.equal(gradeSort.porAtividade[encontrosIds[0].notaId], 7);
  // Avaliação Final fecha na raiz.
  assert.equal(gradeSort.avaliacaoFinal, 8);
});

test('sortorder: sem buracos e sem repetição', () => {
  const model = createGenerationModel({
    disciplina: { nome: 'D', codigo: 'D1' },
    aulas: [
      { forum: { titulo: 'F' }, tarefa: { titulo: 'T' }, quiz: { titulo: 'Q' } },
      { forum: { titulo: 'F2' }, glossario: { titulo: 'G' } },
    ],
    encontros: [{ numero: 1, avaliacao: 'nota_media' }, { numero: 2, avaliacao: 'nota_media' }],
  }, 5000);

  const { gradeSort } = model.ids;
  const todos = [
    gradeSort.course,
    ...gradeSort.categorias,
    ...Object.values(gradeSort.porAtividade),
    gradeSort.avaliacaoFinal,
  ].sort((a, b) => a - b);

  assert.deepEqual(todos, Array.from({ length: todos.length }, (_, i) => i + 1));
});

test('atividade cai na categoria que reivindica o seu tipo', () => {
  const model = createGenerationModel({
    disciplina: { nome: 'D', codigo: 'D1' },
    aulas: [{ forum: { titulo: 'F' }, tarefa: { titulo: 'T' } }],
    livro_de_notas: {
      categorias: [
        { nome: 'Discussões', peso: 50, tipos: ['forum'] },
        { nome: 'Entregas',   peso: 50, tipos: ['tarefa'] },
      ],
    },
  }, 2000);

  const { gradeCategoryIdFor, categoriaIds, rootCatId } = model.ids;

  assert.equal(gradeCategoryIdFor('forum'), categoriaIds[0]);
  assert.equal(gradeCategoryIdFor('tarefa'), categoriaIds[1]);
  // Tipo que ninguém reivindica fica na raiz, como a Avaliação Final.
  assert.equal(gradeCategoryIdFor('encontro'), rootCatId);
});
