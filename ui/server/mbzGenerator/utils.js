'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

// ── String helpers ────────────────────────────────────────────────────────────

function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

// Converts plain text (with \n\n paragraph breaks) to XML-escaped Moodle HTML
function textToMoodleHtml(text) {
  if (!text) return '';
  return String(text).split(/\n\n+/)
    .map(p => `&lt;p&gt;${sanitize(p.trim())}&lt;/p&gt;`)
    .filter(p => p !== '&lt;p&gt;&lt;/p&gt;')
    .join('');
}

// Formata nota para exibição em título: inteiro fica sem vírgula, decimal usa vírgula (6.5 → "6,5", 10 → "10")
function formatNotaBR(n) {
  const num = typeof n === 'string' ? parseFloat(n.replace(',', '.')) : Number(n);
  if (!Number.isFinite(num)) return String(n);
  return Number.isInteger(num) ? String(num) : String(num).replace('.', ',');
}

// Normaliza o último colchete de peso: "[Peso 50%]" → "[50]", "[Tema X 6,5]" → "[6,5]"
function normalizeTitleBrackets(titulo) {
  return String(titulo || '').replace(
    /\[[^\[\]]*?(\d+(?:[.,]\d+)?)[^\[\]]*\]([^\[]*)$/,
    (_, n, tail) => `[${formatNotaBR(n)}]${tail}`
  );
}

// Extrai o peso numérico do último par de colchetes: "[Aula 1] [10]" → 10, "[6,5]" → 6.5
function extractBracketWeight(titulo) {
  const m = String(titulo || '').match(/\[(\d+(?:[.,]\d+)?)\][^\[]*$/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateToTs(dateStr, isEndDate = false, endTime = '23:59:59') {
  if (!dateStr || dateStr === 'null') return 0;
  const m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 0;
  const [, d, mo, y] = m;
  const time = isEndDate ? `T${endTime}` : 'T00:00:00';
  return Math.floor(new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}${time}-03:00`).getTime() / 1000);
}

// ── File helpers ──────────────────────────────────────────────────────────────

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc':  'application/msword',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
  }[ext] || 'application/octet-stream';
}

// SHA1 of empty string — used for Moodle directory entries in files.xml
const EMPTY_SHA1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';

/**
 * Reads each file in `arquivos`, hashes it and pushes metadata into fileEntries.
 * Returns copy descriptors { hash, content } for the caller to write to disk.
 */
function embedAssignFiles(assignCtxId, arquivos, fileEntries) {
  if (!arquivos?.length) return [];
  const copies = [];
  for (const arq of arquivos) {
    if (!arq?.filePath) continue;
    try {
      const content  = fs.readFileSync(arq.filePath);
      const hash     = crypto.createHash('sha1').update(content).digest('hex');
      const filename = path.basename(arq.filename || arq.filePath);
      fileEntries.push({
        contenthash: hash,
        contextid:   assignCtxId,
        filename,
        filesize:    content.length,
        mimetype:    getMimeType(filename),
        content,
      });
      copies.push({ hash, content });
    } catch (e) {
      console.warn(`⚠️ Arquivo da tarefa não encontrado: ${arq.filePath}`);
    }
  }
  return copies;
}

/**
 * Builds files.xml from an array of file entries populated by embedAssignFiles.
 * Inserts a directory entry (EMPTY_SHA1) before each new contextid group.
 */
function buildFilesXml(entries, now) {
  const seen = new Set();
  const rows = [];
  let id = 1;

  for (const f of entries) {
    // Directory entry — one per contextid
    if (!seen.has(f.contextid)) {
      seen.add(f.contextid);
      rows.push(`
  <file id="${id++}">
    <contenthash>${EMPTY_SHA1}</contenthash>
    <contextid>${f.contextid}</contextid>
    <component>mod_assign</component>
    <filearea>introattachment</filearea>
    <itemid>0</itemid>
    <filepath>/</filepath>
    <filename>.</filename>
    <userid>$@NULL@$</userid>
    <filesize>0</filesize>
    <mimetype>$@NULL@$</mimetype>
    <status>0</status>
    <timecreated>${now}</timecreated>
    <timemodified>${now}</timemodified>
    <source>$@NULL@$</source>
    <author>$@NULL@$</author>
    <license>$@NULL@$</license>
    <sortorder>0</sortorder>
    <repositorytype>$@NULL@$</repositorytype>
    <repositoryid>$@NULL@$</repositoryid>
    <reference>$@NULL@$</reference>
  </file>`);
    }
    // Actual file entry
    rows.push(`
  <file id="${id++}">
    <contenthash>${f.contenthash}</contenthash>
    <contextid>${f.contextid}</contextid>
    <component>mod_assign</component>
    <filearea>introattachment</filearea>
    <itemid>0</itemid>
    <filepath>/</filepath>
    <filename>${sanitize(f.filename)}</filename>
    <userid>$@NULL@$</userid>
    <filesize>${f.filesize}</filesize>
    <mimetype>${f.mimetype}</mimetype>
    <status>0</status>
    <timecreated>${now}</timecreated>
    <timemodified>${now}</timemodified>
    <source>${sanitize(f.filename)}</source>
    <author>$@NULL@$</author>
    <license>allrightsreserved</license>
    <sortorder>0</sortorder>
    <repositorytype>$@NULL@$</repositorytype>
    <repositoryid>$@NULL@$</repositoryid>
    <reference>$@NULL@$</reference>
  </file>`);
    f._xmlId = id - 1;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<files>${rows.join('')}\n</files>`;
}

module.exports = {
  sanitize,
  textToMoodleHtml,
  normalizeTitleBrackets,
  extractBracketWeight,
  formatNotaBR,
  dateToTs,
  getMimeType,
  EMPTY_SHA1,
  embedAssignFiles,
  buildFilesXml,
};
