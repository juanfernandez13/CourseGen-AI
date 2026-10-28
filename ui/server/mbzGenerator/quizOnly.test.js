'use strict';

/* Modo "só questionários": o pacote é feito para MESCLAR num curso que já
 * existe, então o que importa aqui é o que NÃO pode ir junto — mural, blocos,
 * Avaliações/Faltas, Avaliação Final e categorias do livro de notas. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const zlib = require('node:zlib');
const tar = require('tar-stream');
const { generateMBZ } = require('./index');
const { createGenerationModel } = require('./model');
const {
  montarQuestionarios, tituloDoArquivo, secaoDestino, isQuizOnlyJson,
} = require('../questionarios');

const QUESTOES = [
  {
    tipo: 'multipla_escolha', numero: 1, enunciado: 'Quanto é 2 + 2?', pontuacao: 2,
    itens: [
      { texto: '3', isCorrect: false },
      { texto: '4', isCorrect: true, feedback: 'Isso mesmo.' },
    ],
  },
  { tipo: 'associativa', numero: 2, enunciado: 'V ou F', pontuacao: 1, itens: [{ texto: 'O céu é azul', resposta: 'V' }] },
  { tipo: 'dissertativa', numero: 3, enunciado: 'Explique.', pontuacao: 3, feedback: 'Gabarito' },
];

const dados = () => ({
  modo: 'questionarios',
  aulas: [
    { numero: 3, quiz: { titulo: 'Quiz 3', questoes: QUESTOES } },
    { numero: 1, quiz: { titulo: 'Quiz 1', questoes: QUESTOES.slice(0, 1) } },
  ],
});

function readEntries(archivePath) {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();
    const files = new Map();
    extract.on('entry', (header, stream, next) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        if (header.type === 'file') files.set(header.name, Buffer.concat(chunks).toString('utf8'));
        next();
      });
      stream.on('error', reject);
      stream.resume();
    });
    extract.on('finish', () => resolve(files));
    extract.on('error', reject);
    fs.createReadStream(archivePath).pipe(zlib.createGunzip()).pipe(extract);
  });
}

async function gerar(data) {
  const output = await generateMBZ(data);
  try {
    return await readEntries(output);
  } finally {
    fs.rmSync(output, { force: true });
  }
}

/* ─── regras do JSON ──────────────────────────────────────────────────────── */

test('secaoDestino: usa o número declarado, a posição quando falta, e aceita a seção 0', () => {
  assert.equal(secaoDestino(4, 0), 4);
  assert.equal(secaoDestino('2', 5), 2);
  assert.equal(secaoDestino(0, 3), 0);
  assert.equal(secaoDestino(undefined, 2), 3);
  assert.equal(secaoDestino(-1, 0), 1);
  assert.equal(secaoDestino('abc', 1), 2);
});

test('isQuizOnlyJson: reconhece o modo e tolera JSON quebrado', () => {
  assert.equal(isQuizOnlyJson('{"modo":"questionarios","aulas":[]}'), true);
  assert.equal(isQuizOnlyJson('{"disciplina":{}}'), false);
  assert.equal(isQuizOnlyJson('{ quebrado'), false);
  assert.equal(isQuizOnlyJson(''), false);
});

test('tituloDoArquivo: tira a extensão e troca _ por espaço', () => {
  assert.equal(tituloDoArquivo('Quiz_3.docx'), 'Quiz 3');
  assert.equal(tituloDoArquivo('Questionário  Aula 2.docx'), 'Questionário Aula 2');
  assert.equal(tituloDoArquivo(undefined), '');
});

test('montarQuestionarios: seção vem do número do arquivo e, sem ele, da ordem', () => {
  const json = montarQuestionarios(
    [{ questoes: [{ enunciado: 'a' }] }, { questoes: [] }],
    [{ numero: 4, nome: 'Quiz_4.docx' }, { nome: 'Prova.docx' }],
  );

  assert.equal(json.modo, 'questionarios');
  assert.deepEqual(json.aulas.map(a => a.numero), [4, 2]);
  assert.deepEqual(json.aulas.map(a => a.quiz.titulo), ['Quiz 4', 'Prova']);
  assert.equal(json.aulas[0].quiz.questoes.length, 1);
});

/* ─── modelo ──────────────────────────────────────────────────────────────── */

test('modelo: só atividades quiz, uma seção por número de destino, em ordem', () => {
  const model = createGenerationModel(dados(), 10000);

  assert.equal(model.quizOnly, true);
  assert.deepEqual(model.allActivities.map(a => a.modulename), ['quiz', 'quiz']);
  assert.deepEqual(model.secoes.map(s => s.numero), [1, 3]);
  assert.equal(model.allSections.length, 2);
  assert.deepEqual(model.ids.aulaSectionNumbers, [3, 1]);
  assert.equal(model.ids.categoriaIds.length, 0);
});

test('modelo: questionários da mesma seção dividem uma seção só', () => {
  const model = createGenerationModel({
    modo: 'questionarios',
    aulas: [
      { numero: 2, quiz: { titulo: 'A', questoes: QUESTOES } },
      { numero: 2, quiz: { titulo: 'B', questoes: QUESTOES } },
    ],
  }, 10000);

  assert.equal(model.secoes.length, 1);
  assert.equal(model.secoes[0].quizIds.length, 2);
  assert.equal(model.ids.aulaIds[0].sectionId, model.ids.aulaIds[1].sectionId);
});

test('modelo: ignora fórum, tarefa e o resto — só o quiz entra', () => {
  const model = createGenerationModel({
    modo: 'questionarios',
    aulas: [
      { numero: 1, forum: { titulo: 'F' }, tarefa: { titulo: 'T' }, quiz: { titulo: 'Q', questoes: QUESTOES } },
      { numero: 2, forum: { titulo: 'só fórum' } },
    ],
  }, 10000);

  assert.deepEqual(model.allActivities.map(a => a.modulename), ['quiz']);
});

test('modelo: sem nenhum questionário é erro claro, não um pacote vazio', () => {
  assert.throws(
    () => createGenerationModel({ modo: 'questionarios', aulas: [{ numero: 1, forum: { titulo: 'F' } }] }, 10000),
    /Nenhum questionário/,
  );
});

test('modelo do curso inteiro continua numerando a aula N na seção N', () => {
  const model = createGenerationModel({
    disciplina: { nome: 'C', codigo: 'C1' },
    aulas: [{ quiz: { titulo: 'Q1' } }, { quiz: { titulo: 'Q2' } }],
  }, 10000);

  assert.deepEqual(model.ids.aulaSectionNumbers, [1, 2]);
});

/* ─── pacote ──────────────────────────────────────────────────────────────── */

test('pacote: nada do curso vai junto (blocos, Avaliações, Faltas, notas, atividades extras)', async () => {
  const files = await gerar(dados());
  const nomes = [...files.keys()];

  assert.ok(!nomes.some(n => n.startsWith('course/blocks/')), 'blocos HTML vazariam para o curso de destino');
  assert.ok(!files.has('gradebook.xml'), 'categorias de nota seriam criadas no curso de destino');
  assert.ok(!nomes.some(n => /^activities\/(assign|forum|chat|wiki|glossary)_/.test(n)));

  const backup = files.get('moodle_backup.xml');
  assert.doesNotMatch(backup, /Avalia[çc][õo]es|Faltas|Avalia[çc][ãa]o Final/);
  assert.equal([...backup.matchAll(/<modulename>quiz<\/modulename>/g)].length, 2);
  assert.equal([...backup.matchAll(/<section>\s*<sectionid>/g)].length, 2);
});

test('pacote: seção sem nome nem resumo e módulo apontando para a seção certa', async () => {
  const files = await gerar(dados());
  const secoes = [...files.entries()].filter(([n]) => /^sections\/section_\d+\/section\.xml$/.test(n));
  assert.equal(secoes.length, 2);

  for (const [, xml] of secoes) {
    assert.match(xml, /<name>\$@NULL@\$<\/name>/);
    assert.match(xml, /<summary><\/summary>/);
  }

  const porNumero = new Map(secoes.map(([n, xml]) => [
    Number(xml.match(/<number>(\d+)<\/number>/)[1]),
    { id: Number(n.match(/section_(\d+)/)[1]), xml },
  ]));
  assert.deepEqual([...porNumero.keys()].sort(), [1, 3]);

  for (const [n, xml] of files) {
    const dir = n.match(/^activities\/quiz_(\d+)\/module\.xml$/);
    if (!dir) continue;
    const numero = Number(xml.match(/<sectionnumber>(\d+)<\/sectionnumber>/)[1]);
    const secao = porNumero.get(numero);
    assert.ok(secao, `módulo aponta para a seção ${numero}, que não existe no pacote`);
    assert.match(xml, new RegExp(`<sectionid>${secao.id}</sectionid>`));
    assert.match(secao.xml, new RegExp(`<sequence>[^<]*${dir[1]}[^<]*</sequence>`));
  }
});

test('pacote: as questões ficam no contexto de cada quiz e as referências batem', async () => {
  const files = await gerar(dados());
  const questions = files.get('questions.xml');

  for (const [n, xml] of files) {
    const dir = n.match(/^activities\/quiz_(\d+)\/quiz\.xml$/);
    if (!dir) continue;
    const quizId = dir[1];
    const ctx = xml.match(/<activity id="\d+" moduleid="\d+" modulename="quiz" contextid="(\d+)">/)[1];

    // Cada slot aponta para uma entrada do banco que existe, no contexto do quiz.
    const entradas = [...xml.matchAll(/<questionbankentryid>(\d+)<\/questionbankentryid>/g)].map(m => m[1]);
    assert.ok(entradas.length > 0);
    for (const id of entradas) assert.match(questions, new RegExp(`<question_bank_entry id="${id}">`));
    assert.match(xml, new RegExp(`<usingcontextid>${ctx}</usingcontextid>`));
    assert.match(questions, new RegExp(`<contextid>${ctx}</contextid>\\s*<contextlevel>70</contextlevel>\\s*<contextinstanceid>${quizId}</contextinstanceid>`));

    const inforef = files.get(`activities/quiz_${quizId}/inforef.xml`);
    assert.match(inforef, /<question_categoryref>/);
  }

  assert.equal([...questions.matchAll(/<qtype>multichoice<\/qtype>/g)].length, 2);
  assert.equal([...questions.matchAll(/<qtype>match<\/qtype>/g)].length, 1);
  assert.equal([...questions.matchAll(/<qtype>essay<\/qtype>/g)].length, 1);
});

test('pacote: nota do quiz sem peso herdado e sem categoria do curso', async () => {
  const files = await gerar(dados());
  const grades = [...files.entries()].filter(([n]) => /^activities\/quiz_\d+\/grades\.xml$/.test(n));
  assert.equal(grades.length, 2);
  for (const [, xml] of grades) {
    // "Quiz 3" não traz peso entre colchetes: 0, para o Moodle de destino não ler como crédito extra.
    assert.match(xml, /<aggregationcoef>0\.00000<\/aggregationcoef>/);
    assert.match(xml, /<itemtype>mod<\/itemtype>/);
  }
});

test('pacote: título do quiz vira o nome da atividade e do item de nota', async () => {
  const files = await gerar(dados());
  const quiz3 = [...files.entries()].find(([n, xml]) => /quiz\.xml$/.test(n) && xml.includes('<name>Quiz 3</name>'));
  assert.ok(quiz3, 'quiz.xml com o título Quiz 3');
  const dir = quiz3[0].replace('/quiz.xml', '');
  assert.match(files.get(`${dir}/grades.xml`), /<itemname>Quiz 3<\/itemname>/);
});

test('pacote: título com & e < sai escapado no XML', async () => {
  const files = await gerar({
    modo: 'questionarios',
    aulas: [{ numero: 1, quiz: { titulo: 'Lógica & <Conjuntos>', questoes: QUESTOES.slice(0, 1) } }],
  });
  const quiz = [...files.entries()].find(([n]) => /quiz\.xml$/.test(n))[1];
  assert.match(quiz, /<name>Lógica &amp; &lt;Conjuntos&gt;<\/name>/);
});

test('pacote do curso inteiro segue levando blocos e gradebook', async () => {
  const files = await gerar({
    disciplina: { nome: 'Curso', codigo: 'C1' },
    aulas: [{ numero: 1, titulo: 'Aula 1', quiz: { titulo: 'Q', questoes: QUESTOES.slice(0, 1) } }],
  });

  assert.ok([...files.keys()].some(n => n.startsWith('course/blocks/')));
  assert.ok(files.has('gradebook.xml'));
  assert.match(files.get('moodle_backup.xml'), /Avalia/);
});
