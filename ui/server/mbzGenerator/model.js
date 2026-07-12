'use strict';

const { sanitize, normalizeTitleBrackets, formatNotaBR } = require('./utils');

/**
 * Normalizes the extraction result and allocates every Moodle identifier.
 * Keeping ID arithmetic here prevents XML writers from inventing offsets.
 */
function createGenerationModel(matrizData, base) {
  const disciplina = matrizData.disciplina || {};
  const mural = normalizeMural(matrizData.mural || {});
  const professor = matrizData.professor || {};
  const aulas = matrizData.aulas || [];
  const encontros = matrizData.encontros || [];
  const avFinal = matrizData.avaliacao_final || {};
  const categorias = matrizData.livro_de_notas?.categorias || [
    { nome: 'Atividades a distância', peso: 40 },
    { nome: 'Atividades presenciais', peso: 60 },
  ];

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
    eadCatId: catId + 1000,
    presencialCatId: catId + 1001,
    courseGradeItemId: catId + 2000,
    eadCatItemId: catId + 2001,
    presencialCatItemId: catId + 2002,
  };

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

module.exports = { createGenerationModel, normalizeMural };
