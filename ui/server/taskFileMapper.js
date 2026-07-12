'use strict';

const collator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

function getFilename(file) {
  return String(file?.name || file?.filename || '');
}

/** Accepts "Tarefa 1", "tarefa_1" and "tarefa-1" anywhere in the filename. */
function extractTaskNumber(filename) {
  const match = String(filename || '').match(/tarefa[\s_-]*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
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
 * Maps files to the Nth task.
 * Explicit task numbers always win. Files without a number are grouped by
 * basename (so PDF/DOCX siblings stay together), sorted alphabetically, and
 * assigned to the first task positions that do not already have files.
 */
function mapTaskFiles(files) {
  const taskMap = {};
  const unnumberedGroups = new Map();

  for (const file of files || []) {
    const filename = getFilename(file);
    const taskNumber = extractTaskNumber(filename);
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

module.exports = { extractTaskNumber, mapTaskFiles };
