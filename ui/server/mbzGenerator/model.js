'use strict';

const { sanitize, normalizeTitleBrackets, formatNotaBR } = require('./utils');
const { isQuizOnly, secaoDestino } = require('../questionarios');

/**
 * Normalizes the extraction result and allocates every Moodle identifier.
 * Keeping ID arithmetic here prevents XML writers from inventing offsets.
 */
function createGenerationModel(matrizData, base) {
  if (isQuizOnly(matrizData)) return createQuizOnlyModel(matrizData, base);

  const disciplina = matrizData.disciplina || {};
  const mural = normalizeMural(matrizData.mural || {});
  const professor = matrizData.professor || {};
  const aulas = matrizData.aulas || [];
  const encontros = matrizData.encontros || [];
  const avFinal = matrizData.avaliacao_final || {};
  const categorias = normalizeCategorias(matrizData.livro_de_notas?.categorias);

  const shortname = sanitize(disciplina.codigo || 'DISC001');
  const fullname = sanitize(disciplina.nome || 'Disciplina');
  const catId = base + 1;
  const contextId = base + 2;

  const blocks = {
    professores: { id: base + 50, ctx: base + 53 },
    agenda: { id: base + 51, ctx: base + 54 },
    encontros: { id: base + 52, ctx: base + 55 },
  };
  const sec0Id = base + 200;
  const sec0Title = mural.titulo || (disciplina.polo
    ? `${fullname} / ${sanitize(disciplina.polo)}`
    : fullname);

  const aulaIds = aulas.map((_, i) => ({
    sectionId: base + 300 + i * 20,
    forumId: base + 301 + i * 20,
    forumCtx: base + 302 + i * 20,
    quizId: base + 303 + i * 20,
    quizCtx: base + 304 + i * 20,
    assignId: base + 305 + i * 20,
    assignCtx: base + 306 + i * 20,
    chatId: base + 307 + i * 20,
    chatCtx: base + 308 + i * 20,
    wikiId: base + 309 + i * 20,
    wikiCtx: base + 310 + i * 20,
    wikiAssignId: base + 311 + i * 20,
    wikiAssignCtx: base + 312 + i * 20,
    glossaryId: base + 313 + i * 20,
    glossaryCtx: base + 314 + i * 20,
  }));

  const encontrosBase = base + 300 + aulas.length * 20 + 100;
  const encontrosIds = encontros.map((_, i) => ({
    notaId: encontrosBase + i * 4,
    notaCtx: encontrosBase + i * 4 + 1,
    faltaId: encontrosBase + i * 4 + 2,
    faltaCtx: encontrosBase + i * 4 + 3,
  }));

  const afBase = encontrosBase + encontros.length * 4 + 10;
  const ids = {
    base,
    catId,
    contextId,
    aulaIds,
    encontrosIds,
    avFinalId: afBase,
    avFinalCtx: afBase + 1,
    avSectionId: afBase + 2,
    faltasSectionId: afBase + 3,
    rootCatId: catId,
    courseGradeItemId: catId + 2000,
    // Aula N → seção N (a 0 é o mural).
    aulaSectionNumbers: aulas.map((_, i) => i + 1),
    // Uma categoria por item de livro de notas, na ordem declarada.
    categoriaIds:     categorias.map((_, i) => catId + 1000 + i),
    categoriaItemIds: categorias.map((_, i) => catId + 2001 + i),
  };

  /* Qual categoria recebe cada tipo de atividade. Tipo não reivindicado por
   * nenhuma categoria cai na raiz, como a Avaliação Final. */
  const catIdPorTipo = new Map();
  categorias.forEach((cat, i) => {
    for (const tipo of cat.tipos) {
      if (!catIdPorTipo.has(tipo)) catIdPorTipo.set(tipo, ids.categoriaIds[i]);
    }
  });
  ids.gradeCategoryIdFor = tipo => catIdPorTipo.get(tipo) ?? ids.rootCatId;

  /* O Moodle numera o livro de notas de forma densa: o item da categoria vem
   * imediatamente antes dos seus filhos. Numeração esparsa fazia as atividades
   * aparecerem soltas na restauração. */
  ids.gradeSort = buildGradeSort({ categorias, ids, aulas, encontros });

  const allActivities = buildActivityDescriptors({ aulas, encontros, avFinal, ids });
  const allSections = [
    { sectionid: sec0Id, title: sec0Title, dir: `sections/section_${sec0Id}` },
    ...aulaIds.map((aulaId, i) => ({
      sectionid: aulaId.sectionId,
      title: sanitize(aulas[i]?.titulo || `Aula ${i + 1}`),
      dir: `sections/section_${aulaId.sectionId}`,
    })),
    { sectionid: ids.avSectionId, title: 'Avaliações', dir: `sections/section_${ids.avSectionId}` },
    { sectionid: ids.faltasSectionId, title: 'Faltas', dir: `sections/section_${ids.faltasSectionId}` },
  ];

  return {
    matrizData, disciplina, mural, professor, aulas, encontros, avFinal, categorias,
    shortname, fullname, blocks, sec0Id, sec0Title, allActivities, allSections, ids,
  };
}

/**
 * Pacote só de questionários, feito para "Mesclar o backup neste curso".
 *
 * Por isso NÃO leva nada que pertença ao curso: nem mural, nem blocos, nem
 * Avaliações/Faltas/Avaliação Final, nem categorias do livro de notas. O Moodle
 * de destino criaria tudo isso dentro do curso de outra pessoa.
 *
 * Cada item de `aulas` é um questionário e `numero` é a seção de destino. Itens
 * que apontam para a mesma seção dividem uma só seção no backup; os demais
 * campos do item (fórum, tarefa…) são ignorados de propósito.
 */
function createQuizOnlyModel(data, base) {
  const disciplina = data.disciplina || {};
  const aulas = (Array.isArray(data.aulas) ? data.aulas : [])
    .filter(item => item?.quiz)
    .map((item, i) => {
      const numero = secaoDestino(item.numero, i);
      return {
        numero,
        titulo: item.quiz.titulo || `Questionário ${numero}`,
        data_inicio: item.data_inicio,
        data_fim: item.data_fim,
        quiz: { ...item.quiz, titulo: item.quiz.titulo || `Questionário ${numero}` },
      };
    });
  if (!aulas.length) throw new Error('Nenhum questionário para exportar.');

  const catId = base + 1;
  const contextId = base + 2;

  const aulaIds = aulas.map((_, i) => ({
    sectionId: base + 300 + i * 20,
    quizId: base + 303 + i * 20,
    quizCtx: base + 304 + i * 20,
  }));

  // Uma seção por número de destino; o questionário herda o id da primeira do grupo.
  const secoes = [];
  aulas.forEach((aula, i) => {
    let secao = secoes.find(s => s.numero === aula.numero);
    if (!secao) {
      secao = { numero: aula.numero, sectionId: aulaIds[i].sectionId, quizIds: [] };
      secoes.push(secao);
    }
    aulaIds[i].sectionId = secao.sectionId;
    secao.quizIds.push(aulaIds[i].quizId);
  });
  secoes.sort((a, b) => a.numero - b.numero);

  const ids = {
    base,
    catId,
    contextId,
    aulaIds,
    encontrosIds: [],
    rootCatId: catId,
    courseGradeItemId: catId + 2000,
    aulaSectionNumbers: aulas.map(aula => aula.numero),
    categoriaIds: [],
    categoriaItemIds: [],
    // Sem categorias: toda nota cai na raiz e o Moodle de destino a reencaixa.
    gradeCategoryIdFor: () => catId,
  };
  ids.gradeSort = buildGradeSort({ categorias: [], ids, aulas, encontros: [] });

  const allActivities = aulas.map((aula, i) =>
    activity(aulaIds[i].quizId, aulaIds[i].sectionId, 'quiz', aula.quiz.titulo));
  const allSections = secoes.map(secao => ({
    sectionid: secao.sectionId,
    title: secao.numero === 0 ? 'Seção geral (0)' : `Seção ${secao.numero}`,
    dir: `sections/section_${secao.sectionId}`,
  }));

  return {
    quizOnly: true,
    matrizData: data,
    disciplina,
    professor: {},
    mural: {},
    aulas,
    secoes,
    encontros: [],
    avFinal: {},
    categorias: [],
    shortname: sanitize(disciplina.codigo || 'QUIZZES'),
    fullname: sanitize(disciplina.nome || 'Questionários'),
    allActivities,
    allSections,
    ids,
  };
}

const MURAL_END_MARKERS = [
  /^bons estudos!?$/i,
  /^livro da disciplina$/i,
  /^pud$/i,
  /^biblioteca$/i,
  /^f[oó]rum tira[- ]?d[uú]vidas$/i,
  /^professores?\(as\)$/i,
  /^agenda$/i,
  /^navega[cç][aã]o$/i,
  /^administra[cç][aã]o$/i,
];

/** Keeps only the pedagogical message and extracts a literal mural heading. */
function normalizeMural(rawMural) {
  const lines = String(rawMural.descricao || '')
    .split(/\r?\n+/)
    .map(line => line.trim())
    .filter(Boolean);
  let titulo = String(rawMural.titulo || '').trim();

  if (!titulo && lines[0] && /\/\s*polo\b/i.test(lines[0])) {
    titulo = lines.shift();
  } else if (titulo && lines[0] === titulo) {
    lines.shift();
  }

  const welcomeIndex = lines.findIndex(line => /^seja bem-vind[oa]\(a\)!?$/i.test(line));
  let content = welcomeIndex >= 0
    ? lines.slice(welcomeIndex)
    : lines.filter((line, index) => !(index === 0 && /^car[oa]\(a\) alun[oa]\(a\),?$/i.test(line)));
  const endIndex = content.findIndex(line => MURAL_END_MARKERS.some(pattern => pattern.test(line)));
  if (endIndex >= 0) content = content.slice(0, endIndex);

  return {
    titulo: sanitize(titulo),
    descricao: content.join('\n\n'),
  };
}

function buildActivityDescriptors({ aulas, encontros, avFinal, ids }) {
  const { aulaIds, encontrosIds, avSectionId, faltasSectionId, avFinalId } = ids;
  return [
    ...aulas.flatMap((aula, i) => {
      const aulaId = aulaIds[i];
      const activities = [];
      if (aula.forum) activities.push(activity(aulaId.forumId, aulaId.sectionId, 'forum', aula.forum.titulo || `Fórum ${i + 1}`));
      if (aula.quiz) activities.push(activity(aulaId.quizId, aulaId.sectionId, 'quiz', aula.quiz.titulo || `Questionário ${i + 1}`));
      if (aula.chat) {
        activities.push(activity(aulaId.chatId, aulaId.sectionId, 'chat', aula.chat.titulo || `Chat ${i + 1}`));
        activities.push(activity(aulaId.assignId, aulaId.sectionId, 'assign',
          aula.chat.nota_titulo || `[Aula ${i + 1}] [Chat ${i + 1}] ${aula.chat.titulo || ''} [${formatNotaBR(aula.chat.nota || 10)}]`));
      }
      if (aula.wiki) {
        activities.push(activity(aulaId.wikiId, aulaId.sectionId, 'wiki', aula.wiki.titulo || `Wiki ${i + 1}`));
        activities.push(activity(aulaId.wikiAssignId, aulaId.sectionId, 'assign',
          aula.wiki.nota_titulo || `[Aula ${i + 1}] [Wiki ${i + 1}] ${aula.wiki.titulo || ''} [${formatNotaBR(aula.wiki.nota || 10)}]`));
      }
      if (aula.glossario) activities.push(activity(aulaId.glossaryId, aulaId.sectionId, 'glossary', aula.glossario.titulo || `Glossário ${i + 1}`));
      if (!aula.chat && aula.tarefa) activities.push(activity(aulaId.assignId, aulaId.sectionId, 'assign', aula.tarefa.titulo || `Tarefa ${i + 1}`));
      return activities;
    }),
    ...encontros.flatMap((enc, i) => {
      const activities = [];
      if (enc.avaliacao === 'nota_media') {
        activities.push(activity(encontrosIds[i].notaId, avSectionId, 'assign', enc.nota_titulo || `[Encontro ${enc.numero || i + 1}] [Nota]`));
      }
      activities.push(activity(encontrosIds[i].faltaId, faltasSectionId, 'assign', enc.falta_titulo || `[Encontro ${enc.numero || i + 1}] [Faltas]`));
      return activities;
    }),
    activity(avFinalId, avSectionId, 'assign', avFinal.titulo || '[Disciplina] [Avaliação Final]'),
  ];
}

function activity(moduleid, sectionid, modulename, title) {
  return {
    moduleid,
    sectionid,
    modulename,
    title: sanitize(normalizeTitleBrackets(title)),
    dir: `activities/${modulename}_${moduleid}`,
  };
}

/* Tipos que uma categoria pode reivindicar. 'avaliacao_final' fica de fora de
 * propósito: o Moodle a mantém na raiz. */
const TIPOS_EAD = ['forum', 'quiz', 'tarefa', 'chat', 'wiki', 'glossario'];
const TIPOS_PRESENCIAL = ['encontro'];

function normalizeCategorias(brutas) {
  const lista = Array.isArray(brutas) && brutas.length ? brutas : [
    { nome: 'Atividades a distância', peso: 40 },
    { nome: 'Atividades presenciais', peso: 60 },
  ];

  return lista.map((cat, i) => ({
    nome: cat?.nome || `Categoria ${i + 1}`,
    peso: Number.isFinite(Number(cat?.peso)) ? Number(cat.peso) : 0,
    // Sem "tipos" declarado, mantém o comportamento histórico por posição.
    tipos: Array.isArray(cat?.tipos) && cat.tipos.length
      ? cat.tipos
      : (i === 0 ? TIPOS_EAD : i === 1 ? TIPOS_PRESENCIAL : []),
  }));
}

/** Atividades que geram item de nota, na ordem em que são escritas. */
function gradedItems({ aulas, encontros, ids }) {
  const items = [];
  aulas.forEach((aula, i) => {
    const a = ids.aulaIds[i];
    if (aula.forum) items.push({ id: a.forumId, tipo: 'forum' });
    if (aula.quiz) items.push({ id: a.quizId, tipo: 'quiz' });
    if (aula.chat) items.push({ id: a.assignId, tipo: 'chat' });
    else if (aula.tarefa) items.push({ id: a.assignId, tipo: 'tarefa' });
    if (aula.wiki) items.push({ id: a.wikiAssignId, tipo: 'wiki' });
    if (aula.glossario) items.push({ id: a.glossaryId, tipo: 'glossario' });
  });
  encontros.forEach((enc, i) => {
    if (enc.avaliacao === 'nota_media') items.push({ id: ids.encontrosIds[i].notaId, tipo: 'encontro' });
  });
  return items;
}

/**
 * Numeração densa e sequencial: curso, depois cada categoria seguida dos seus
 * filhos, e por fim o que ficou na raiz. É o padrão que o Moodle gera.
 */
function buildGradeSort({ categorias, ids, aulas, encontros }) {
  const items = gradedItems({ aulas, encontros, ids });
  const sort = { course: 1, categorias: [], porAtividade: {} };
  let proximo = 2;

  categorias.forEach((cat, i) => {
    sort.categorias[i] = proximo++;
    for (const item of items) {
      if (cat.tipos.includes(item.tipo) && sort.porAtividade[item.id] === undefined) {
        sort.porAtividade[item.id] = proximo++;
      }
    }
  });

  // Sobras (tipo sem categoria) e a Avaliação Final ficam na raiz, ao final.
  for (const item of items) {
    if (sort.porAtividade[item.id] === undefined) sort.porAtividade[item.id] = proximo++;
  }
  sort.avaliacaoFinal = proximo++;

  return sort;
}

module.exports = { createGenerationModel, normalizeMural, normalizeCategorias, buildGradeSort };
