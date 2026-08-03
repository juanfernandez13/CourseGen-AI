'use strict';

/* Leitura de planilhas de alunos (.xlsx, .xls, .csv) para uma matriz de texto.
 *
 * A interpretação das colunas é feita depois, pelo Gemini — aqui só importa
 * extrair as células fielmente. Tudo vira string: um CPF gravado como número
 * perderia o zero à esquerda se fosse tratado como tal.
 *
 * São DOIS formatos com o mesmo apelido "Excel", e nada em comum entre si:
 *
 *   .xlsx  ZIP de XML (OOXML)          -> exceljs
 *   .xls   OLE2/BIFF8, binário, 97-2003 -> sheetjs
 *
 * O exceljs lê só o primeiro. Antes, um .xls caía no leitor de .xlsx, voltava
 * vazio, e a rota traduzia isso para "a planilha não tem linhas de dados além
 * do cabeçalho" — mensagem que manda procurar defeito no arquivo errado.
 *
 * A escolha é pela assinatura do conteúdo, não pela extensão: planilha baixada
 * de sistema acadêmico costuma vir com o nome trocado. */

const ExcelJS = require('exceljs');

const MAX_LINHAS = 2000;

const ASSINATURA_OLE2 = Buffer.from('d0cf11e0a1b11ae1', 'hex'); // .xls 97-2003
const ASSINATURA_ZIP  = Buffer.from('504b0304', 'hex');         // .xlsx

function ehXlsLegado(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 8).equals(ASSINATURA_OLE2);
}

function ehXlsx(buffer) {
  return Buffer.isBuffer(buffer) && buffer.subarray(0, 4).equals(ASSINATURA_ZIP);
}

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

/* Formato 97-2003. O sheetjs entrega a célula já formatada (`raw: false`), que
 * é o que preserva o zero à esquerda de um CPF quando a coluna foi salva como
 * texto — mesmo cuidado que `cellToText` tem no caminho do .xlsx. */
function parseXlsLegado(buffer) {
  const XLSX = require('xlsx');

  const pasta = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: true });
  const primeira = pasta.SheetNames[0];
  if (!primeira) return [];

  const linhas = XLSX.utils.sheet_to_json(pasta.Sheets[primeira], {
    header: 1,       // matriz de matrizes, sem inferir cabeçalho
    blankrows: false,
    defval: '',
    raw: false,
  });

  return linhas
    .slice(0, MAX_LINHAS)
    .map(cells => cells.map(cellToText))
    .filter(cells => cells.some(c => c !== ''));
}

/**
 * @param {Buffer} buffer conteúdo do arquivo
 * @param {string} filename usado só como desempate quando o conteúdo não diz
 * @returns {Promise<string[][]>} linhas da planilha
 */
async function lerPlanilha(buffer, filename = '') {
  if (ehXlsLegado(buffer)) return parseXlsLegado(buffer);
  if (ehXlsx(buffer))      return parseXlsx(buffer);

  // Sem assinatura binária conhecida: é texto. CSV é o único que resta.
  if (/\.csv$/i.test(filename)) return parseCsv(buffer.toString('utf8'));

  throw new Error(
    'Formato de planilha não reconhecido. Salve como .xlsx, .xls ou .csv.',
  );
}

/** Representação textual compacta para enviar ao modelo. */
function planilhaParaTexto(rows) {
  return rows.map((cells, i) => `${i + 1}: ${cells.join(' | ')}`).join('\n');
}

module.exports = { lerPlanilha, planilhaParaTexto, parseCsv, ehXlsLegado, ehXlsx };
