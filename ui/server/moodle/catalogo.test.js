'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { leCategorias, subarvore, leCursos, leNomeBreve, truncado } = require('./catalogo');

/* ---------- seletor de categorias ---------- */

const seletor = `
<form>
  <select name="category">
    <option value="112">Cursos Presenciais</option>
    <option value="1235">Cursos Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS</option>
    <option value="1302">Cursos&nbsp;Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS / 1º Período / 2026.2</option>
    <option value="1304">Cursos Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS / 1º Período / 2026.1</option>
    <option value="56">EAD Técnico</option>
    <option value="">Escolha...</option>
  </select>
</form>`;

test('leCategorias devolve id e caminho, normalizando o espaço do tema', () => {
  const categorias = leCategorias(seletor);

  assert.equal(categorias.length, 5, 'a opção sem value é descartada');
  assert.deepEqual(categorias[0], { id: '112', caminho: 'Cursos Presenciais' });

  const guara = categorias.find(c => c.id === '1302');
  assert.equal(
    guara.caminho,
    'Cursos Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS / 1º Período / 2026.2',
    'o &nbsp; do tema não pode sobreviver ao caminho',
  );
});

test('subarvore recolhe a raiz e a descendência', () => {
  const dentro = subarvore(leCategorias(seletor), 1235).map(c => c.id);

  assert.deepEqual(dentro.sort(), ['1235', '1302', '1304'].sort());
});

test('subarvore mede profundidade a partir da raiz pedida', () => {
  const porId = Object.fromEntries(subarvore(leCategorias(seletor), 1235).map(c => [c.id, c]));

  assert.equal(porId['1235'].profundidade, 0);
  assert.equal(porId['1302'].profundidade, 2);
  assert.equal(porId['1302'].folha, '2026.2');
});

test('subarvore não deixa um prefixo de nome recolher categoria vizinha', () => {
  /* "CAMPUS CEDRO" não pode arrastar "CAMPUS CEDRO DO NORTE": sem o separador
   * na comparação, startsWith casaria os dois e o lote sairia com turma de
   * outro campus. */
  const html = `
    <select name="category">
      <option value="10">Raiz / CAMPUS CEDRO</option>
      <option value="11">Raiz / CAMPUS CEDRO DO NORTE</option>
      <option value="12">Raiz / CAMPUS CEDRO / 1º Período</option>
    </select>`;

  assert.deepEqual(subarvore(leCategorias(html), 10).map(c => c.id), ['10', '12']);
});

test('subarvore devolve vazio quando a categoria não existe', () => {
  assert.deepEqual(subarvore(leCategorias(seletor), 99999), []);
});

/* ---------- turmas de uma categoria ---------- */

/* A listagem dá id e nome completo; o nome breve só existe no bloco de
 * navegação, e lá ele vem cortado quando é longo. */
const gerenciamento = `
<div id="course-listing">
  <ul>
    <li class="listitem listitem-course" data-id="5160" data-visible="1">
      <a class="coursename" href="#">2026/2 - Inglês</a>
    </li>
    <li class="listitem listitem-course" data-id="5153" data-visible="1">
      <a class="coursename" href="#">2026/2 - Cerimonial</a>
    </li>
    <li class="listitem listitem-course" data-id="5199" data-visible="0">
      <a class="coursename" href="#">2026/2 - Sem nav</a>
    </li>
  </ul>
</div>
<div id="nav">
  <li class="type_course">
    <a title="2026/2 - Inglês" href="https://ead.ifce.edu.br/course/view.php?id=5160">
      <img><span class="item-content-wrap">Inglês_guaramiranga20262</span>
    </a>
  </li>
  <li class="type_course">
    <a title="2026/2 - Cerimonial" href="https://ead.ifce.edu.br/course/view.php?id=5153">
      <img><span class="item-content-wrap">Cerimonial, Protocolo e Etiqueta Social_Guaramiran...</span>
    </a>
  </li>
</div>`;

test('leCursos cruza a listagem com o nome breve do bloco de navegação', () => {
  const cursos = leCursos(gerenciamento);

  assert.equal(cursos.length, 3);
  assert.deepEqual(cursos[0], {
    id: '5160',
    fullname: '2026/2 - Inglês',
    shortname: 'Inglês_guaramiranga20262',
    truncado: false,
    visivel: true,
  });
});

test('leCursos marca o nome breve cortado pelo nav', () => {
  /* Este é o caso que estraga o CSV em silêncio: o Moodle não acha o curso
   * pelo nome truncado e simplesmente não matricula, sem linha de erro. */
  const cerimonial = leCursos(gerenciamento).find(c => c.id === '5153');

  assert.equal(cerimonial.truncado, true);
  assert.match(cerimonial.shortname, /\.\.\.$/);
});

test('leCursos devolve nome breve nulo quando o nav não cobre a turma', () => {
  const semNav = leCursos(gerenciamento).find(c => c.id === '5199');

  assert.equal(semNav.shortname, null, 'chutar aqui produziria CSV que não matricula');
  assert.equal(semNav.truncado, false);
  assert.equal(semNav.visivel, false);
});

test('truncado reconhece reticências de um caractere só', () => {
  assert.equal(truncado('Nome longo…'), true);
  assert.equal(truncado('Nome longo...'), true);
  assert.equal(truncado('Nome curto'), false);
});

test('leNomeBreve tira o valor exato do formulário de edição', () => {
  const html = '<form><input name="shortname" value="Cerimonial, Protocolo e Etiqueta Social_Guaramiranga2026.2"></form>';

  assert.equal(leNomeBreve(html), 'Cerimonial, Protocolo e Etiqueta Social_Guaramiranga2026.2');
  assert.equal(leNomeBreve('<form></form>'), '');
});
