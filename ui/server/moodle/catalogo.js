'use strict';

/* Catálogo de categorias e turmas do Moodle.
 *
 * Serve para responder "quais turmas existem sob esta categoria, e qual é o
 * nome breve de cada uma" — que é o valor exigido na coluna `course1` do CSV
 * de importação.
 *
 * Três descobertas pagas em produção moldam este módulo:
 *
 * 1. `course/index.php?categoryid=N` NÃO filtra por categoria neste Moodle:
 *    devolve a árvore inteira, sem curso nenhum. A página que responde de fato
 *    é `course/management.php?categoryid=N`.
 *
 * 2. O nome breve não está no `li.listitem-course` da listagem — está no bloco
 *    de navegação, num `li.type_course` à parte. A listagem dá a lista
 *    autoritativa de ids; o nav dá os nomes breves. É preciso cruzar os dois.
 *
 * 3. O nav TRUNCA o nome breve em ~50 caracteres, com reticências. E um
 *    `course1` truncado não falha: o Moodle apenas não encontra o curso e a
 *    matrícula não acontece, sem erro na tela. Por isso todo nome breve
 *    truncado precisa ser reconfirmado em `course/edit.php?id=N` antes de
 *    virar CSV. É o que `completaNomesBreves` faz.
 */

const cheerio = require('cheerio');

const SEPARADOR = ' / ';

/* ─── Categorias ────────────────────────────────────────────────────────── */

/**
 * Lê o seletor de categoria de um formulário de curso.
 *
 * Uma requisição só devolve TODAS as categorias do site com o caminho
 * completo ("Cursos Presenciais / CAMPUS GUARAMIRANGA / ..."), que é a fonte
 * mais barata que existe para montar a árvore.
 */
function leCategorias(html) {
  const $ = cheerio.load(html);

  return $('select[name="category"] option')
    .map((_, el) => ({
      id: String($(el).attr('value') ?? '').trim(),
      // o tema indenta com espaços e nbsp; o caminho é o texto normalizado
      caminho: $(el).text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim(),
    }))
    .get()
    .filter(c => c.id && c.caminho);
}

/**
 * A categoria pedida e tudo que pende dela.
 *
 * O seletor não traz o id do pai, só o caminho — então a descendência é
 * decidida por prefixo. Comparar com o separador junto evita que
 * "CAMPUS CEDRO" recolha "CAMPUS CEDRO DO NORTE".
 */
function subarvore(categorias, raizId) {
  const raiz = categorias.find(c => c.id === String(raizId));
  if (!raiz) return [];

  const prefixo = raiz.caminho + SEPARADOR;

  return categorias
    .filter(c => c.caminho === raiz.caminho || c.caminho.startsWith(prefixo))
    .map(c => ({
      ...c,
      profundidade: c.caminho === raiz.caminho
        ? 0
        : c.caminho.slice(raiz.caminho.length).split(SEPARADOR).length - 1,
      folha: c.caminho.split(SEPARADOR).pop(),
    }));
}

/* ─── Turmas de uma categoria ───────────────────────────────────────────── */

/** O nav corta o nome breve e marca o corte com reticências. */
function truncado(nome) {
  return /(\.\.\.|…)\s*$/.test(nome);
}

/**
 * Turmas de `management.php?categoryid=N`.
 *
 * `li.listitem-course` é a lista autoritativa (id + nome completo). Os nomes
 * breves vêm do bloco de navegação e são casados pelo id do curso; quando o
 * nav não cobre um curso, `shortname` fica null — e null é honesto, porque
 * chutar aqui produz CSV que não matricula ninguém.
 */
function leCursos(html) {
  const $ = cheerio.load(html);

  const breves = new Map();
  $('li.type_course a[href*="course/view.php?id="]').each((_, el) => {
    const a = $(el);
    const id = /id=(\d+)/.exec(a.attr('href') ?? '')?.[1];
    const nome = a.find('.item-content-wrap').text().trim() || a.text().trim();
    if (id && nome && !breves.has(id)) breves.set(id, nome);
  });

  return $('li.listitem-course')
    .map((_, el) => {
      const li = $(el);
      const id = li.attr('data-id');
      const bruto = breves.get(id) ?? null;

      return {
        id,
        fullname: li.find('.coursename').first().text().trim(),
        shortname: bruto,
        truncado: bruto ? truncado(bruto) : false,
        visivel: li.attr('data-visible') !== '0',
      };
    })
    .get()
    .filter(c => c.id);
}

/** Nome breve exato, do formulário de edição do curso. */
function leNomeBreve(html) {
  return cheerio.load(html)('input[name="shortname"]').attr('value') ?? '';
}

/* ─── Acesso à rede ─────────────────────────────────────────────────────── */

/* O formulário de "novo curso" já traz o seletor completo de categorias, e não
 * depende de existir um curso conhecido para ser aberto. */
async function buscaCategorias(sessao) {
  return leCategorias(await sessao.texto('/course/edit.php?category=1'));
}

async function buscaCursos(sessao, categoriaId) {
  return leCursos(await sessao.texto(`/course/management.php?categoryid=${categoriaId}&perpage=100`));
}

/**
 * Garante nome breve exato em todas as turmas.
 *
 * Só vai à rede pelo que veio truncado ou ausente — o resto do nav já é
 * confiável. Uma requisição por turma corrigida.
 */
async function completaNomesBreves(sessao, cursos) {
  const saida = [];

  for (const curso of cursos) {
    if (curso.shortname && !curso.truncado) {
      saida.push({ ...curso, exato: true });
      continue;
    }

    const nome = leNomeBreve(await sessao.texto(`/course/edit.php?id=${curso.id}`));
    saida.push({ ...curso, shortname: nome, truncado: false, exato: Boolean(nome) });
  }

  return saida;
}

module.exports = {
  SEPARADOR,
  truncado,
  leCategorias,
  subarvore,
  leCursos,
  leNomeBreve,
  buscaCategorias,
  buscaCursos,
  completaNomesBreves,
};
