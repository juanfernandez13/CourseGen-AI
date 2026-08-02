'use strict';

/* Leitura de planilhas de alunos (.xlsx, .xls, .csv) para uma matriz de texto.
 *
 * A interpretação das colunas é feita depois, pelo Gemini — aqui só importa
 * extrair as células fielmente. Tudo vira string: um CPF gravado como número
 * perderia o zero à esquerda se fosse tratado como tal. */

const ExcelJS = require('exceljs');

const MAX_LINHAS = 2000;

/** Converte o valor de uma célula do ExcelJS em texto. */
function cellToText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    // Fórmulas, hyperlinks e rich text guardam o valor legível em subcampos.
    if ('result' in value)   return cellToText(value.result);
    if ('text' in value)     return cellToText(value.text);
    if ('richText' in value) return value.richText.map(part => part.text).join('');
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return '';
  }
  return String(value).trim();
}

/** Divide uma linha de CSV respeitando aspas e vírgulas escapadas. */
function parseCsvLine(line, separator) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else quoted = false;
      } else current += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  // Planilhas exportadas em pt-BR costumam usar ponto e vírgula.
  const separator = (clean.split('\n')[0].match(/;/g) || []).length
    > (clean.split('\n')[0].match(/,/g) || []).length ? ';' : ',';

  return clean
    .split(/\r?\n/)
    .filter(line => line.trim() !== '')
    .slice(0, MAX_LINHAS)
    .map(line => parseCsvLine(line, separator));
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    if (rows.length >= MAX_LINHAS) return;
    const cells = [];
    // row.values é 1-indexado no ExcelJS.
    for (let i = 1; i <= row.cellCount; i++) {
      cells.push(cellToText(row.getCell(i).value));
    }
    if (cells.some(c => c !== '')) rows.push(cells);
  });
  return rows;
}

/**
 * @param {Buffer} buffer conteúdo do arquivo
 * @param {string} filename usado só para escolher o leitor
 * @returns {Promise<string[][]>} linhas da planilha
 */
async function lerPlanilha(buffer, filename) {
  if (/\.csv$/i.test(filename)) return parseCsv(buffer.toString('utf8'));
  return parseXlsx(buffer);
}

/** Representação textual compacta para enviar ao modelo. */
function planilhaParaTexto(rows) {
  return rows.map((cells, i) => `${i + 1}: ${cells.join(' | ')}`).join('\n');
}

module.exports = { lerPlanilha, planilhaParaTexto, parseCsv };
