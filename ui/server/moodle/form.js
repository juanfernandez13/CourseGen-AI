'use strict';

/* Leitura e reescrita fiel de formulários do Moodle.
 *
 * O modedit.php reposta a configuração INTEIRA da atividade: campo omitido é
 * ajuste apagado no servidor. Por isso este módulo reproduz exatamente o que um
 * navegador enviaria — ordem, disabled, checkbox desmarcado, select sem
 * "selected" — em vez de montar um POST só com o que queremos mudar. */

const cheerio = require('cheerio');

/* Lista ordenada de pares nome/valor.
 *
 * A ordem importa: o Moodle emite um <input type="hidden" name="x[enabled]"
 * value="0"> logo antes do checkbox de mesmo nome, e o PHP fica com a última
 * ocorrência. Por isso `define` sobrescreve a ÚLTIMA — assim marcar ou
 * desmarcar um checkbox vira uma simples troca de valor. */
class Campos {
  constructor(pares = []) {
    this.pares = pares;
  }

  obtem(nome) {
    for (let i = this.pares.length - 1; i >= 0; i--) {
      if (this.pares[i][0] === nome) return this.pares[i][1];
    }
    return undefined;
  }

  tem(nome) {
    return this.pares.some(([campo]) => campo === nome);
  }

  define(nome, valor) {
    const texto = String(valor);
    for (let i = this.pares.length - 1; i >= 0; i--) {
      if (this.pares[i][0] === nome) {
        this.pares[i][1] = texto;
        return this;
      }
    }
    this.pares.push([nome, texto]);
    return this;
  }

  entries() {
    return this.pares;
  }

  clone() {
    return new Campos(this.pares.map(par => [...par]));
  }
}

const TIPOS_IGNORADOS = new Set(['submit', 'button', 'image', 'reset', 'file']);

function valorDaOpcao($, opcao) {
  const el = $(opcao);
  return el.attr('value') ?? el.text();
}

/** Lê um <form> e devolve só o que o navegador submeteria. Botões ficam de
 *  fora de propósito: quem chama escolhe qual "clicar". */
function leFormulario(html, seletor) {
  const $ = cheerio.load(html);

  const form = seletor
    ? $(seletor).first()
    : $('form[action*="modedit.php"], form[action*="editsection.php"], form.mform, form#mform1').first();

  if (!form.length) throw new Error('Formulário não encontrado na página');

  const campos = new Campos();

  form.find('input, select, textarea').each((_, elemento) => {
    const el = $(elemento);
    const nome = el.attr('name');
    if (!nome || el.attr('disabled') !== undefined) return;

    const tag = elemento.tagName.toLowerCase();

    if (tag === 'textarea') {
      campos.pares.push([nome, el.text()]);
      return;
    }

    if (tag === 'select') {
      const selecionadas = el.find('option[selected]');
      if (selecionadas.length) {
        selecionadas.each((__, opcao) => campos.pares.push([nome, valorDaOpcao($, opcao)]));
      } else if (el.attr('multiple') === undefined) {
        // sem "selected" explícito o navegador manda a primeira opção
        const primeira = el.find('option').first();
        if (primeira.length) campos.pares.push([nome, valorDaOpcao($, primeira[0])]);
      }
      return;
    }

    const tipo = (el.attr('type') ?? 'text').toLowerCase();
    if (TIPOS_IGNORADOS.has(tipo)) return;

    if (tipo === 'checkbox' || tipo === 'radio') {
      if (el.attr('checked') !== undefined) campos.pares.push([nome, el.attr('value') ?? 'on']);
      return;
    }

    campos.pares.push([nome, el.attr('value') ?? '']);
  });

  return { campos, action: form.attr('action') || '', method: (form.attr('method') || 'post').toLowerCase() };
}

/** Mensagens de validação devolvidas quando o Moodle recusa o formulário. */
function extraiErros(html) {
  const $ = cheerio.load(html);
  const mensagens = new Set();

  $('.form-control-feedback, .invalid-feedback, .error, .alert-danger').each((_, el) => {
    const texto = $(el).text().trim();
    if (texto) mensagens.add(texto);
  });

  return [...mensagens].slice(0, 3).join(' | ') || 'o formulário foi recusado';
}

module.exports = { Campos, leFormulario, extraiErros };
