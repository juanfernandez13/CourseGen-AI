const fs = require('fs');
const JSZip = require('jszip');
const { ommlToLatex } = require('./ommlToLatex');

async function processMatriz(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('Arquivo .docx inválido: word/document.xml não encontrado.');
  }
  const xml = await docFile.async('string');
  const fullText = extractTextWithMath(xml);

  if (!fullText || fullText.trim().length < 50) {
    throw new Error('Documento vazio ou não foi possível extrair o texto.');
  }
  return fullText;
}

function extractTextWithMath(xml) {
  const root = parseXml(xml);
  const lines = [];
  let buf = '';

  const flush = () => {
    if (buf.trim().length > 0) lines.push(buf.replace(/\s+$/, ''));
    else if (buf.length > 0) lines.push('');
    buf = '';
  };

  const walk = (node) => {
    if (!node || node.type !== 'element') return;
    const name = node.name;

    if (name === 'm:oMathPara') {
      const latex = ommlToLatex(node).trim();
      if (latex) {
        flush();
        lines.push(`\\[ ${latex} \\]`);
      }
      return;
    }
    if (name === 'm:oMath') {
      const latex = ommlToLatex(node).trim();
      if (latex) buf += `\\( ${latex} \\)`;
      return;
    }
    if (name === 'w:t') {
      for (const c of node.children) if (c.type === 'text') buf += c.value;
      return;
    }
    if (name === 'w:tab') { buf += '\t'; return; }
    if (name === 'w:br') { flush(); return; }
    if (name === 'w:p') {
      for (const c of node.children) walk(c);
      flush();
      return;
    }
    for (const c of node.children) walk(c);
  };

  walk(root);
  flush();
  return lines.join('\n');
}

function parseXml(xml) {
  let i = 0;
  const len = xml.length;
  const root = { type: 'element', name: '#root', attrs: {}, children: [] };
  const stack = [root];

  while (i < len) {
    if (xml[i] !== '<') {
      let j = xml.indexOf('<', i);
      if (j === -1) j = len;
      const text = decodeEntities(xml.slice(i, j));
      if (text.length > 0) {
        stack[stack.length - 1].children.push({ type: 'text', value: text });
      }
      i = j;
      continue;
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i + 9);
      const text = end === -1 ? xml.slice(i + 9) : xml.slice(i + 9, end);
      stack[stack.length - 1].children.push({ type: 'text', value: text });
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (xml[i + 1] === '?' || xml[i + 1] === '!') {
      const end = xml.indexOf('>', i);
      i = end === -1 ? len : end + 1;
      continue;
    }
    const end = findTagEnd(xml, i);
    if (end === -1) break;
    const raw = xml.slice(i + 1, end);
    i = end + 1;

    if (raw.startsWith('/')) {
      const closeName = raw.slice(1).trim().split(/\s+/)[0];
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].name === closeName) {
          stack.length = s;
          break;
        }
      }
      continue;
    }
    const selfClosing = raw.endsWith('/');
    const body = selfClosing ? raw.slice(0, -1) : raw;
    const { name, attrs } = parseTag(body);
    const node = { type: 'element', name, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

function findTagEnd(xml, start) {
  let i = start + 1;
  let inQuote = null;
  while (i < xml.length) {
    const c = xml[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
    } else {
      if (c === '"' || c === "'") inQuote = c;
      else if (c === '>') return i;
    }
    i++;
  }
  return -1;
}

function parseTag(body) {
  const m = body.match(/^([^\s/>]+)/);
  if (!m) return { name: '', attrs: {} };
  const name = m[1];
  const attrs = {};
  const re = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let mm;
  while ((mm = re.exec(body)) !== null) {
    attrs[mm[1]] = decodeEntities(mm[3] !== undefined ? mm[3] : mm[4]);
  }
  return { name, attrs };
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

module.exports = { processMatriz };
