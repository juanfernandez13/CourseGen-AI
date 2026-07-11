'use strict';

const fs = require('fs');
const {
  sanitize, dateToTs, normalizeTitleBrackets, formatNotaBR, embedAssignFiles,
} = require('./utils');
const {
  buildForumDiscussionXml, buildChatXml, buildWikiXml, buildGlossaryXml,
  buildQuizXml, buildAssignXml, buildActivityGradesXml,
} = require('./builders');

/** Writes lesson activities, meeting grade items and the final assessment. */
function writeActivities({ model, now, write, writeActivityStubs, fileEntries, emptyGrades }) {
  writeLessonActivities({ model, now, write, writeActivityStubs, fileEntries, emptyGrades });
  writeMeetingActivities({ model, now, write, writeActivityStubs });
  writeFinalAssessment({ model, now, write, writeActivityStubs });
}

function writeLessonActivities({ model, now, write, writeActivityStubs, fileEntries, emptyGrades }) {
  const { aulas } = model;
  const { aulaIds, eadCatId } = model.ids;

  for (const [i, aula] of aulas.entries()) {
    const ids = aulaIds[i];
    const secNum = i + 1;

    if (aula.forum) {
      const dir = `activities/forum_${ids.forumId}`;
      const start = dateToTs(aula.forum.data_inicio || aula.data_inicio);
      const end = dateToTs(aula.forum.data_fim || aula.data_fim, true, '23:55:00');
      write(`${dir}/forum.xml`, buildForumDiscussionXml(ids.forumId, ids.forumCtx, aula, now));
      writeActivityStubs(dir, ids.forumId, 'forum', ids.sectionId, secNum, start,
        buildActivityGradesXml(ids.forumId, eadCatId, aula.forum.titulo || `Fórum ${i + 1}`, 'forum', i * 3 + 10, now, 1), end);
      write(`${dir}/grading.xml`, buildGradingXml(ids.forumId + 70000, 'forum'));
    }

    if (aula.quiz) {
      const dir = `activities/quiz_${ids.quizId}`;
      write(`${dir}/quiz.xml`, buildQuizXml(ids.quizId, ids.quizCtx, aula, now));
      writeActivityStubs(dir, ids.quizId, 'quiz', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.quizId, eadCatId, aula.quiz.titulo || `Questionário ${i + 1}`, 'quiz', i * 3 + 11, now));
      if (aula.quiz.questoes?.length) write(`${dir}/inforef.xml`, buildQuizInforef(ids.quizId));
    }

    if (aula.chat) {
      const dir = `activities/chat_${ids.chatId}`;
      const start = dateToTs(aula.chat.data_inicio || aula.data_inicio);
      const end = dateToTs(aula.chat.data_fim || aula.data_fim, true, '23:55:00');
      write(`${dir}/chat.xml`, buildChatXml(ids.chatId, ids.chatCtx, aula, now));
      writeActivityStubs(dir, ids.chatId, 'chat', ids.sectionId, secNum, start, emptyGrades, end);

      const assignDir = `activities/assign_${ids.assignId}`;
      const title = sanitize(normalizeTitleBrackets(
        aula.chat.nota_titulo || `[Aula ${i + 1}] [Chat ${i + 1}] ${aula.chat.titulo || ''} [${formatNotaBR(aula.chat.nota || 10)}]`,
      ));
      write(`${assignDir}/assign.xml`, buildAssignXml(ids.assignId, ids.assignCtx,
        { tarefa: { titulo: title, descricao: 'Atividade para receber a nota do chat' } }, now, [], true));
      writeActivityStubs(assignDir, ids.assignId, 'assign', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.assignId, eadCatId, title, 'assign', i * 3 + 12, now), 0,
        { visible: 0, showdescription: 1 });
      write(`${assignDir}/grading.xml`, buildGradingXml(ids.assignId + 70000, 'submissions'));
    }

    if (aula.wiki) {
      const dir = `activities/wiki_${ids.wikiId}`;
      const start = dateToTs(aula.wiki.data_inicio || aula.data_inicio);
      const end = dateToTs(aula.wiki.data_fim || aula.data_fim, true, '23:55:00');
      write(`${dir}/wiki.xml`, buildWikiXml(ids.wikiId, ids.wikiCtx, aula, now));
      writeActivityStubs(dir, ids.wikiId, 'wiki', ids.sectionId, secNum, start, emptyGrades, end);

      const assignDir = `activities/assign_${ids.wikiAssignId}`;
      const title = sanitize(normalizeTitleBrackets(
        aula.wiki.nota_titulo || `[Aula ${i + 1}] [Wiki ${i + 1}] ${aula.wiki.titulo || ''} [${formatNotaBR(aula.wiki.nota || 10)}]`,
      ));
      write(`${assignDir}/assign.xml`, buildAssignXml(ids.wikiAssignId, ids.wikiAssignCtx,
        { tarefa: { titulo: title, descricao: '' } }, now, [], true));
      writeActivityStubs(assignDir, ids.wikiAssignId, 'assign', ids.sectionId, secNum, 0,
        buildActivityGradesXml(ids.wikiAssignId, eadCatId, title, 'assign', i * 3 + 13, now), 0,
        { visible: 0 });
      write(`${assignDir}/grading.xml`, buildGradingXml(ids.wikiAssignId + 70000, 'submissions'));
    }

    if (aula.glossario) {
      const dir = `activities/glossary_${ids.glossaryId}`;
      const start = dateToTs(aula.glossario.data_inicio || aula.data_inicio);
      const end = dateToTs(aula.glossario.data_fim || aula.data_fim, true, '23:55:00');
      write(`${dir}/glossary.xml`, buildGlossaryXml(ids.glossaryId, ids.glossaryCtx, aula, now));
      writeActivityStubs(dir, ids.glossaryId, 'glossary', ids.sectionId, secNum, start,
        buildActivityGradesXml(ids.glossaryId, eadCatId, aula.glossario.titulo || `Glossário ${i + 1}`, 'glossary', i * 3 + 14, now), end);
    }

    if (!aula.chat && aula.tarefa) {
      writeTask({ aula, ids, i, secNum, eadCatId, now, write, writeActivityStubs, fileEntries });
    }
  }
}

function writeTask({ aula, ids, i, secNum, eadCatId, now, write, writeActivityStubs, fileEntries }) {
  const dir = `activities/assign_${ids.assignId}`;
  const arquivos = (aula.tarefa.arquivos || []).filter(file => {
    if (!file?.filePath) return false;
    try { fs.statSync(file.filePath); return true; } catch { return false; }
  });
  write(`${dir}/assign.xml`, buildAssignXml(ids.assignId, ids.assignCtx, aula, now, arquivos));
  writeActivityStubs(dir, ids.assignId, 'assign', ids.sectionId, secNum, 0,
    buildActivityGradesXml(ids.assignId, eadCatId, aula.tarefa.titulo || `Tarefa ${i + 1}`, 'assign', i * 3 + 12, now));
  write(`${dir}/grading.xml`, buildGradingXml(ids.assignId + 70000, 'submissions'));

  if (!arquivos.length) return;
  const idxStart = fileEntries.length;
  for (const { hash, content } of embedAssignFiles(ids.assignCtx, arquivos, fileEntries)) {
    write(`files/${hash.slice(0, 2)}/${hash}`, content);
  }
  fileEntries._assignInforefs = fileEntries._assignInforefs || [];
  fileEntries._assignInforefs.push({
    dir,
    gradeItemId: ids.assignId + 90000,
    idxStart,
    idxEnd: fileEntries.length,
  });
}

function writeMeetingActivities({ model, now, write, writeActivityStubs }) {
  const { encontros } = model;
  const { encontrosIds, avSectionId, faltasSectionId, presencialCatId } = model.ids;
  const sectionNumber = model.aulas.length + 1;

  for (const [i, encontro] of encontros.entries()) {
    const ids = encontrosIds[i];
    const notaTitle = sanitize(normalizeTitleBrackets(encontro.nota_titulo || `[Encontro ${encontro.numero || i + 1}] [Nota]`));
    const faltaTitle = sanitize(normalizeTitleBrackets(encontro.falta_titulo || `[Encontro ${encontro.numero || i + 1}] [Faltas]`));

    if (encontro.avaliacao === 'nota_media') {
      const dir = `activities/assign_${ids.notaId}`;
      write(`${dir}/assign.xml`, buildAssignXml(ids.notaId, ids.notaCtx,
        { tarefa: { titulo: notaTitle, descricao: encontro.descricao || '' } }, now, [], true));
      writeActivityStubs(dir, ids.notaId, 'assign', avSectionId, sectionNumber, 0,
        buildActivityGradesXml(ids.notaId, presencialCatId, notaTitle, 'assign', 500 + i * 2, now));
      write(`${dir}/grading.xml`, buildGradingXml(ids.notaId + 70000, 'submissions'));
    }

    const dir = `activities/assign_${ids.faltaId}`;
    write(`${dir}/assign.xml`, buildAssignXml(ids.faltaId, ids.faltaCtx,
      { tarefa: { titulo: faltaTitle, descricao: encontro.titulo || encontro.descricao || '' } }, now, [], true));
    writeActivityStubs(dir, ids.faltaId, 'assign', faltasSectionId, sectionNumber + 1, 0);
    write(`${dir}/grading.xml`, buildGradingXml(ids.faltaId + 70000, 'submissions'));
  }
}

function writeFinalAssessment({ model, now, write, writeActivityStubs }) {
  const { avFinal } = model;
  const { avFinalId, avFinalCtx, avSectionId, rootCatId } = model.ids;
  const sectionNumber = model.aulas.length + 1;
  const title = sanitize(normalizeTitleBrackets(avFinal.titulo || '[Disciplina] [Avaliação Final]'));
  const dir = `activities/assign_${avFinalId}`;
  write(`${dir}/assign.xml`, buildAssignXml(avFinalId, avFinalCtx,
    { tarefa: { titulo: title, descricao: avFinal.descricao || '' } }, now, [], true));
  writeActivityStubs(dir, avFinalId, 'assign', avSectionId, sectionNumber, 0,
    buildActivityGradesXml(avFinalId, rootCatId, title, 'assign', 549, now));
  write(`${dir}/grading.xml`, buildGradingXml(avFinalId + 70000, 'submissions'));
}

function buildGradingXml(areaId, areaName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<areas>
  <area id="${areaId}">
    <areaname>${areaName}</areaname>
    <activemethod>$@NULL@$</activemethod>
    <definitions>
    </definitions>
  </area>
</areas>`;
}

function buildQuizInforef(quizId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<inforef>
  <grade_itemref><grade_item><id>${quizId + 90000}</id></grade_item></grade_itemref>
  <question_categoryref>
    <question_category><id>${quizId + 2000000}</id></question_category>
    <question_category><id>${quizId + 2001000}</id></question_category>
  </question_categoryref>
</inforef>`;
}

module.exports = { writeActivities };
