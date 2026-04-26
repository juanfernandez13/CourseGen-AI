const SYMBOLS = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
  'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
  'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
  'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho',
  'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\varphi',
  'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
  'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
  'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi',
  'Ψ': '\\Psi', 'Ω': '\\Omega',
  '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div',
  '⋅': '\\cdot', '∘': '\\circ', '∗': '\\ast',
  '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx',
  '≡': '\\equiv', '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla',
  '∀': '\\forall', '∃': '\\exists', '∈': '\\in', '∉': '\\notin',
  '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup', '∩': '\\cap',
  '→': '\\to', '←': '\\leftarrow', '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow',
  '∑': '\\sum', '∏': '\\prod', '∫': '\\int', '∬': '\\iint',
  '∭': '\\iiint', '∮': '\\oint', '√': '\\sqrt',
  '…': '\\ldots', '⋯': '\\cdots', '⋮': '\\vdots', '⋱': '\\ddots',
  '′': "'", '″': "''",
};

const ACCENTS = {
  '̂': '\\hat', 'ˆ': '\\hat',
  '̃': '\\tilde', '˜': '\\tilde',
  '̄': '\\bar', '¯': '\\bar',
  '̇': '\\dot', '̈': '\\ddot',
  '̊': '\\mathring',
  '⃗': '\\vec', '→': '\\vec',
  '⃖': '\\overleftarrow',
  '̆': '\\breve',
  '̌': '\\check',
};

function ommlToLatex(node) {
  return convert(node).trim();
}

function convert(node) {
  if (!node || node.type !== 'element') return '';
  let out = '';
  for (const c of node.children) out += convertElement(c);
  return out;
}

function convertElement(node) {
  if (node.type !== 'element') return '';
  switch (node.name) {
    case 'm:t':            return mapText(textOf(node));
    case 'm:r':            return convert(node);
    case 'm:f':            return convFraction(node);
    case 'm:rad':          return convRadical(node);
    case 'm:sSup':         return convSup(node);
    case 'm:sSub':         return convSub(node);
    case 'm:sSubSup':      return convSubSup(node);
    case 'm:sPre':         return convPre(node);
    case 'm:nary':         return convNary(node);
    case 'm:d':            return convDelimiter(node);
    case 'm:func':         return convFunc(node);
    case 'm:fName':        return convert(node);
    case 'm:limLow':       return convLimLow(node);
    case 'm:limUpp':       return convLimUpp(node);
    case 'm:m':            return convMatrix(node);
    case 'm:bar':          return convBar(node);
    case 'm:acc':          return convAccent(node);
    case 'm:groupChr':     return convGroupChr(node);
    case 'm:box':          return convert(child(node, 'm:e')) || convert(node);
    case 'm:eqArr':        return convEqArr(node);
    case 'm:e':
    case 'm:num':
    case 'm:den':
    case 'm:sub':
    case 'm:sup':
    case 'm:lim':
    case 'm:deg':
    case 'm:oMath':
    case 'm:oMathPara':
      return convert(node);
    default:
      if (node.name && node.name.endsWith('Pr')) return '';
      return convert(node);
  }
}

function textOf(node) {
  let s = '';
  for (const c of node.children) if (c.type === 'text') s += c.value;
  return s;
}

function child(node, name) {
  if (!node) return null;
  for (const c of node.children) if (c.type === 'element' && c.name === name) return c;
  return null;
}

function children(node, name) {
  const out = [];
  if (!node) return out;
  for (const c of node.children) if (c.type === 'element' && c.name === name) out.push(c);
  return out;
}

function chrVal(node, propTag) {
  const pr = child(node, propTag);
  const chr = child(pr, 'm:chr');
  if (chr && chr.attrs && chr.attrs['m:val']) return chr.attrs['m:val'];
  return null;
}

function mapText(s) {
  if (!s) return '';
  let out = '';
  for (const ch of s) {
    if (SYMBOLS[ch]) out += SYMBOLS[ch] + ' ';
    else out += ch;
  }
  return out;
}

function wrap(s) {
  const t = s.trim();
  if (!t) return '{}';
  if (/^[A-Za-z0-9]$/.test(t)) return t;
  if (/^\\[A-Za-z]+$/.test(t)) return t;
  return `{${t}}`;
}

function convFraction(node) {
  const num = convert(child(node, 'm:num')).trim();
  const den = convert(child(node, 'm:den')).trim();
  const pr = child(node, 'm:fPr');
  const type = child(pr, 'm:type');
  const tval = type && type.attrs && type.attrs['m:val'];
  if (tval === 'lin')  return `${wrap(num)}/${wrap(den)}`;
  if (tval === 'skw')  return `\\nicefrac{${num}}{${den}}`;
  if (tval === 'noBar') return `\\genfrac{}{}{0pt}{}{${num}}{${den}}`;
  return `\\frac{${num}}{${den}}`;
}

function convRadical(node) {
  const deg = convert(child(node, 'm:deg')).trim();
  const e = convert(child(node, 'm:e')).trim();
  return deg ? `\\sqrt[${deg}]{${e}}` : `\\sqrt{${e}}`;
}

function convSup(node) {
  const e = convert(child(node, 'm:e')).trim();
  const sup = convert(child(node, 'm:sup')).trim();
  return `${wrap(e)}^${wrap(sup)}`;
}

function convSub(node) {
  const e = convert(child(node, 'm:e')).trim();
  const sub = convert(child(node, 'm:sub')).trim();
  return `${wrap(e)}_${wrap(sub)}`;
}

function convSubSup(node) {
  const e = convert(child(node, 'm:e')).trim();
  const sub = convert(child(node, 'm:sub')).trim();
  const sup = convert(child(node, 'm:sup')).trim();
  return `${wrap(e)}_${wrap(sub)}^${wrap(sup)}`;
}

function convPre(node) {
  const sub = convert(child(node, 'm:sub')).trim();
  const sup = convert(child(node, 'm:sup')).trim();
  const e = convert(child(node, 'm:e')).trim();
  return `{}_{${sub}}^{${sup}}${wrap(e)}`;
}

function convNary(node) {
  const pr = child(node, 'm:naryPr');
  const chrNode = child(pr, 'm:chr');
  const subHide = child(pr, 'm:subHide');
  const supHide = child(pr, 'm:supHide');
  const chr = chrNode && chrNode.attrs && chrNode.attrs['m:val'];
  let op = '\\sum';
  if (chr) {
    if (SYMBOLS[chr]) op = SYMBOLS[chr];
    else op = chr;
  }
  const sub = convert(child(node, 'm:sub')).trim();
  const sup = convert(child(node, 'm:sup')).trim();
  const e = convert(child(node, 'm:e')).trim();
  let out = op;
  if (sub && !(subHide && subHide.attrs && subHide.attrs['m:val'] === '1')) out += `_{${sub}}`;
  if (sup && !(supHide && supHide.attrs && supHide.attrs['m:val'] === '1')) out += `^{${sup}}`;
  if (e) out += ` ${e}`;
  return out;
}

function convDelimiter(node) {
  const pr = child(node, 'm:dPr');
  const beg = child(pr, 'm:begChr');
  const end = child(pr, 'm:endChr');
  const sep = child(pr, 'm:sepChr');
  const begChr = beg && beg.attrs && beg.attrs['m:val'] !== undefined ? beg.attrs['m:val'] : '(';
  const endChr = end && end.attrs && end.attrs['m:val'] !== undefined ? end.attrs['m:val'] : ')';
  const sepChr = sep && sep.attrs && sep.attrs['m:val'] !== undefined ? sep.attrs['m:val'] : '|';
  const parts = children(node, 'm:e').map(e => convert(e).trim());
  const inner = parts.join(sepChr);
  const L = begChr === '' ? '.' : delimEscape(begChr);
  const R = endChr === '' ? '.' : delimEscape(endChr);
  return `\\left${L} ${inner} \\right${R}`;
}

function delimEscape(c) {
  if (c === '{' || c === '}') return `\\${c}`;
  if (c === '|') return '|';
  return c;
}

function convFunc(node) {
  const fName = convert(child(node, 'm:fName')).trim();
  const e = convert(child(node, 'm:e')).trim();
  return `${fName}${wrap(e)}`;
}

function convLimLow(node) {
  const e = convert(child(node, 'm:e')).trim();
  const lim = convert(child(node, 'm:lim')).trim();
  if (/^\\(lim|max|min|sup|inf|liminf|limsup)\b/.test(e)) return `${e}_{${lim}}`;
  return `\\underset{${lim}}{${e}}`;
}

function convLimUpp(node) {
  const e = convert(child(node, 'm:e')).trim();
  const lim = convert(child(node, 'm:lim')).trim();
  return `\\overset{${lim}}{${e}}`;
}

function convMatrix(node) {
  const rows = children(node, 'm:mr').map(mr =>
    children(mr, 'm:e').map(e => convert(e).trim()).join(' & ')
  );
  return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
}

function convBar(node) {
  const pos = chrVal(node, 'm:barPr') || 'top';
  const e = convert(child(node, 'm:e')).trim();
  return pos === 'bot' ? `\\underline{${e}}` : `\\overline{${e}}`;
}

function convAccent(node) {
  const chr = chrVal(node, 'm:accPr') || '̂';
  const e = convert(child(node, 'm:e')).trim();
  const cmd = ACCENTS[chr] || '\\hat';
  return `${cmd}{${e}}`;
}

function convGroupChr(node) {
  const chr = chrVal(node, 'm:groupChrPr');
  const pr = child(node, 'm:groupChrPr');
  const pos = child(pr, 'm:pos');
  const posVal = pos && pos.attrs && pos.attrs['m:val'];
  const e = convert(child(node, 'm:e')).trim();
  if (chr === '⏞') return `\\overbrace{${e}}`;
  if (chr === '⏟') return `\\underbrace{${e}}`;
  if (chr === '⏜') return `\\overparen{${e}}`;
  if (chr === '⏝') return `\\underparen{${e}}`;
  return posVal === 'bot' ? `\\underbrace{${e}}` : `\\overbrace{${e}}`;
}

function convEqArr(node) {
  const rows = children(node, 'm:e').map(e => convert(e).trim());
  return `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`;
}

module.exports = { ommlToLatex };
