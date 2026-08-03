'use strict';

/* Estrutura de uma turma: seções ("aulas") e as atividades dentro de cada uma.
 *
 * Aula N = seção N. Não é preciso ligar o modo de edição: o cmid está no
 * id="module-N" de cada atividade e o id da seção está no data-id — ambos
 * presentes na página normal do curso. */

const cheerio = require('cheerio');

const TIPO = /(?:^|\s)modtype_([a-z0-9]+)/;

function achaCmid($, el) {
  const porId = /module-(\d+)/.exec(el.attr('id') ?? '')?.[1];
  if (porId) return porId;

  const porDados = el.attr('data-cmid') ?? el.find('[data-cmid]').first().attr('data-cmid');
  if (porDados) return porDados;

  const href = el.find('a[href*="modedit.php"]').first().attr('href') ?? '';
  return /update=(\d+)/.exec(href)?.[1] ?? null;
}

function nomeDaAtividade($, el, tipo, cmid) {
  const bruto = el.find('.instancename, .activityname, .aalink').first();
  // o Moodle acrescenta um <span class="accesshide"> com o tipo da atividade
  const limpo = bruto.clone().find('.accesshide').remove().end().text().trim();
  return limpo || bruto.text().trim() || `${tipo} ${cmid}`;
}

/** Lê course/view.php e devolve a turma inteira, seção a seção. */
function leCurso(html, cursoId) {
  const $ = cheerio.load(html);
  const secoes = [];

  $('li[id^="section-"], [data-for="section"]').each((_, elemento) => {
    const sec = $(elemento);
    const numero = Number(sec.attr('data-number') ?? /section-(\d+)/.exec(sec.attr('id') ?? '')?.[1]);
    if (!Number.isInteger(numero)) return;
    if (secoes.some(s => s.numero === numero)) return;

    const sectionId =
      sec.attr('data-id') ??
      /id=(\d+)/.exec(sec.find('a[href*="editsection.php"]').first().attr('href') ?? '')?.[1] ??
      null;

    const atividades = [];
    const vistos = new Set();

    sec.find('[class*="modtype_"]').each((__, alvo) => {
      const el = $(alvo);
      const tipo = TIPO.exec(el.attr('class') ?? '')?.[1];
      if (!tipo) return;

      const cmid = achaCmid($, el);
      if (!cmid || vistos.has(cmid)) return;
      vistos.add(cmid);

      atividades.push({ cmid, tipo, nome: nomeDaAtividade($, el, tipo, cmid) });
    });

    secoes.push({
      numero,
      sectionId,
      nome: sec.find('.sectionname, h3.sectionname, .course-section-header').first().text().trim(),
      atividades,
    });
  });

  secoes.sort((a, b) => a.numero - b.numero);

  return { cursoId, nome: nomeDaTurma($), secoes };
}

function nomeDaTurma($) {
  return $('h1').first().text().trim() || $('title').text().split('|')[0].trim() || '';
}

module.exports = { leCurso };
