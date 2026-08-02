'use strict';

const collator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

function getFilename(file) {
  return String(file?.name || file?.filename || '');
}

/* Rótulos reconhecidos no nome do arquivo. O número explícito sempre vence a
 * ordenação, então vale aceitar as grafias que aparecem na prática. */
const PADROES = {
  tarefa: /tarefa[\s_-]*(\d+)/i,
  quiz:   /(?:quiz|question[\u00e1a]rio)[\s_-]*(\d+)/i,
};

function extractNumber(filename, padrao) {
  const match = String(filename || '').match(padrao);
  return match ? Number.parseInt(match[1], 10) : null;
}

/** Accepts "Tarefa 1", "tarefa_1" and "tarefa-1" anywhere in the filename. */
function extractTaskNumber(filename) {
  return extractNumber(filename, PADROES.tarefa);
}

/** Accepts "Quiz 1", "quiz_1", "Questionário 1" anywhere in the filename. */
function extractQuizNumber(filename) {
  return extractNumber(filename, PADROES.quiz);
}

function alphabeticalGroupKey(filename) {
  return String(filename || '')
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

/**
 * Maps files to the Nth slot of `padrao`.
 *
 * Explicit numbers always win. Files without a number are grouped by basename
 * (so PDF/DOCX siblings stay together), sorted with numeric collation — sem
 * ela "10." viria antes de "4." — e ocupam as posições ainda livres.
 */
function mapFilesByNumber(files, padrao) {
  const taskMap = {};
  const unnumberedGroups = new Map();

  for (const file of files || []) {
    const filename = getFilename(file);
    const taskNumber = extractNumber(filename, padrao);
    if (taskNumber !== null) {
      if (!taskMap[taskNumber]) taskMap[taskNumber] = [];
      taskMap[taskNumber].push(file);
      continue;
    }

    const key = alphabeticalGroupKey(filename);
    if (!unnumberedGroups.has(key)) unnumberedGroups.set(key, []);
    unnumberedGroups.get(key).push(file);
  }

  const groups = [...unnumberedGroups.entries()]
    .sort(([a], [b]) => collator.compare(a, b));
  let nextTask = 1;
  for (const [, group] of groups) {
    while (taskMap[nextTask]) nextTask++;
    taskMap[nextTask] = group.sort((a, b) => collator.compare(getFilename(a), getFilename(b)));
    nextTask++;
  }

  for (const group of Object.values(taskMap)) {
    group.sort((a, b) => collator.compare(getFilename(a), getFilename(b)));
  }
  return taskMap;
}

/** Tarefas: "Tarefa 3", "tarefa_3", "4.Tarefa_1-_Aula_1.docx". */
function mapTaskFiles(files) {
  return mapFilesByNumber(files, PADROES.tarefa);
}

/** Quizzes: mesma regra, para não depender da ordem de seleção no navegador. */
function mapQuizFiles(files) {
  return mapFilesByNumber(files, PADROES.quiz);
}

module.exports = {
  PADROES,
  extractTaskNumber,
  extractQuizNumber,
  mapFilesByNumber,
  mapTaskFiles,
  mapQuizFiles,
};
