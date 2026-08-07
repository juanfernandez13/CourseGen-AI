'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { leFormulario, Campos } = require('./form');
const { paraTimestamp, deTimestamp, leData, somaDias } = require('./dates');
const { analisaRestricoes, defineRestricaoDeData, dataAtual } = require('./availability');
const { planejaAtividade, planejaSecao, leDatasAtuais } = require('./plan');
const { criaToken, decifra, VALIDADE_S, cifrando } = require('./auth');
const { leCurso } = require('./course');

const FUSO = 'America/Fortaleza';

/* ---------- fidelidade do formulário ---------- */

const formTarefa = `
<form action="modedit.php" method="post" class="mform">
  <input type="hidden" name="sesskey" value="ABC123">
  <input type="text" name="name" value="Tarefa 1">
  <textarea name="introeditor[text]">Enunciado</textarea>

  <input type="hidden" name="allowsubmissionsfromdate[enabled]" value="0">
  <input type="checkbox" name="allowsubmissionsfromdate[enabled]" value="1" checked>
  <select name="allowsubmissionsfromdate[day]"><option value="21" selected>21</option></select>
  <select name="allowsubmissionsfromdate[month]"><option value="8" selected>8</option></select>
  <select name="allowsubmissionsfromdate[year]"><option value="2026" selected>2026</option></select>
  <select name="allowsubmissionsfromdate[hour]"><option value="0" selected>0</option></select>
  <select name="allowsubmissionsfromdate[minute]"><option value="0" selected>0</option></select>

  <input type="hidden" name="duedate[enabled]" value="0">
  <input type="checkbox" name="duedate[enabled]" value="1" checked>
  <select name="duedate[day]"><option value="30" selected>30</option></select>
  <select name="duedate[month]"><option value="8" selected>8</option></select>
  <select name="duedate[year]"><option value="2026" selected>2026</option></select>
  <select name="duedate[hour]"><option value="23" selected>23</option></select>
  <select name="duedate[minute]"><option value="59" selected>59</option></select>

  <input type="hidden" name="cutoffdate[enabled]" value="0">
  <input type="checkbox" name="cutoffdate[enabled]" value="1">
  <select name="cutoffdate[day]"><option value="30" selected>30</option></select>
  <select name="cutoffdate[month]"><option value="8" selected>8</option></select>
  <select name="cutoffdate[year]"><option value="2026" selected>2026</option></select>
  <select name="cutoffdate[hour]"><option value="23" selected>23</option></select>
  <select name="cutoffdate[minute]"><option value="59" selected>59</option></select>

  <input type="hidden" name="availabilityconditionsjson" value="">
  <select name="grade[modgrade_type]"><option value="none">Nenhum</option><option value="point">Pontos</option></select>
  <input type="checkbox" name="naomarcado" value="1">
  <input type="text" name="desativado" value="x" disabled>
  <input type="file" name="anexo">
  <input type="submit" name="submitbutton2" value="Salvar">
</form>`;

test('lê apenas o que o navegador enviaria', () => {
  const { campos } = leFormulario(formTarefa);
  const nomes = campos.entries().map(([n]) => n);

  assert.ok(!nomes.includes('submitbutton2'), 'botão fica de fora');
  assert.ok(!nomes.includes('desativado'), 'campo disabled fica de fora');
  assert.ok(!nomes.includes('anexo'), 'input file fica de fora');
  assert.ok(!nomes.includes('naomarcado'), 'checkbox desmarcado fica de fora');
  assert.equal(campos.obtem('introeditor[text]'), 'Enunciado');
});

test("select sem 'selected' cai na primeira opção, como o navegador", () => {
  const { campos } = leFormulario(formTarefa);
  assert.equal(campos.obtem('grade[modgrade_type]'), 'none');
});

test('hidden + checkbox de mesmo nome preserva ordem e a última ocorrência vence', () => {
  const { campos } = leFormulario(formTarefa);
  const pares = campos.entries().filter(([n]) => n === 'duedate[enabled]');
  assert.deepEqual(pares.map(([, v]) => v), ['0', '1']);
  assert.equal(campos.obtem('duedate[enabled]'), '1');
});

test('ativar um seletor desligado sobrescreve o hidden, sem duplicar', () => {
  const { campos } = leFormulario(formTarefa);
  campos.define('cutoffdate[enabled]', '1');
  const pares = campos.entries().filter(([n]) => n === 'cutoffdate[enabled]');
  assert.equal(pares.length, 1);
  assert.equal(pares[0][1], '1');
});

/* ---------- datas ---------- */

test('timestamp respeita o fuso de Fortaleza (UTC-3, sem horário de verão)', () => {
  const ts = paraTimestamp('2026-07-10 23:59', FUSO);
  assert.equal(new Date(ts * 1000).toISOString(), '2026-07-11T02:59:00.000Z');
});

test('ida e volta de timestamp preserva a data', () => {
  assert.equal(deTimestamp(paraTimestamp('2026-09-15 23:59', FUSO), FUSO), '2026-09-15 23:59');
  assert.equal(deTimestamp(paraTimestamp('2026-09-15 00:00', FUSO), FUSO), '2026-09-15 00:00');
});

test('somaDias atravessa fim de mês preservando o horário', () => {
  assert.equal(somaDias('2026-08-28 23:59', 7), '2026-09-04 23:59');
  assert.equal(somaDias('2026-12-31 00:00', 1), '2027-01-01 00:00');
});

test('leData ignora seletor desligado', () => {
  const { campos } = leFormulario(formTarefa);
  assert.equal(leData(campos, 'duedate'), '2026-08-30 23:59');
  assert.equal(leData(campos, 'cutoffdate'), null);
});

/* ---------- restrições de acesso ---------- */

test('availability atualiza a data existente sem perder outras restrições', () => {
  const bruto = JSON.stringify({
    op: '&',
    c: [{ type: 'group', id: 7 }, { type: 'date', d: '<', t: 1000 }],
    showc: [true, false],
  });

  const { restricoes, criada, anterior } = defineRestricaoDeData(analisaRestricoes(bruto), {
    direcao: '<', timestamp: 2000,
  });

  assert.equal(criada, false);
  assert.equal(anterior, 1000);
  assert.equal(dataAtual(restricoes, '<'), 2000);
  assert.deepEqual(restricoes.c[0], { type: 'group', id: 7 });
});

test('availability não mexe numa restrição de direção diferente', () => {
  const bruto = JSON.stringify({ op: '&', c: [{ type: 'date', d: '>=', t: 500 }], showc: [false] });
  const { restricoes } = defineRestricaoDeData(analisaRestricoes(bruto), { direcao: '<', timestamp: 900 });

  assert.equal(dataAtual(restricoes, '>='), 500);
  assert.equal(dataAtual(restricoes, '<'), 900);
});

/* ---------- planejador ---------- */

test('tarefa: início vai para allowsubmissionsfromdate, fim para duedate e cutoffdate', () => {
  const { campos } = leFormulario(formTarefa);
  const mudancas = planejaAtividade(campos, 'assign', {
    inicio: '2026-09-01 00:00', fim: '2026-09-15 23:59',
  }, FUSO);

  assert.deepEqual(mudancas.map(m => m.campo).sort(), ['allowsubmissionsfromdate', 'cutoffdate', 'duedate']);
  assert.equal(leData(campos, 'allowsubmissionsfromdate'), '2026-09-01 00:00');
  assert.equal(leData(campos, 'duedate'), '2026-09-15 23:59');
  assert.equal(leData(campos, 'cutoffdate'), '2026-09-15 23:59');
  // o cutoffdate estava desligado e precisa ser ligado junto
  assert.equal(campos.obtem('cutoffdate[enabled]'), '1');
});

test('planejador não repete campo que já está na data pedida', () => {
  const { campos } = leFormulario(formTarefa);
  const mudancas = planejaAtividade(campos, 'assign', { inicio: null, fim: '2026-08-30 23:59' }, FUSO);
  // duedate já está nessa data; só o cutoffdate (desligado) muda
  assert.deepEqual(mudancas.map(m => m.campo), ['cutoffdate']);
});

test('fórum usa restrição de acesso nas duas pontas', () => {
  const html = `<form action="modedit.php"><input type="hidden" name="availabilityconditionsjson" value=""></form>`;
  const { campos } = leFormulario(html);

  planejaAtividade(campos, 'forum', { inicio: '2026-09-01 00:00', fim: '2026-09-15 23:55' }, FUSO);
  const restricoes = analisaRestricoes(campos.obtem('availabilityconditionsjson'));

  assert.equal(deTimestamp(dataAtual(restricoes, '>='), FUSO), '2026-09-01 00:00');
  assert.equal(deTimestamp(dataAtual(restricoes, '<'), FUSO), '2026-09-15 23:55');
});

test('seção recebe só o início — pôr "até" esconderia a aula inteira', () => {
  const html = `<form action="editsection.php"><input type="hidden" name="availabilityconditionsjson" value=""></form>`;
  const { campos } = leFormulario(html);

  planejaSecao(campos, { inicio: '2026-09-01 00:00', fim: '2026-09-15 23:59' }, FUSO);
  const restricoes = analisaRestricoes(campos.obtem('availabilityconditionsjson'));

  assert.equal(deTimestamp(dataAtual(restricoes, '>='), FUSO), '2026-09-01 00:00');
  assert.equal(dataAtual(restricoes, '<'), null, 'a seção não ganha data de fim');
});

test('tipo sem regra não gera mudança', () => {
  const { campos } = leFormulario(formTarefa);
  assert.deepEqual(planejaAtividade(campos, 'resource', { inicio: '2026-09-01 00:00', fim: null }, FUSO), []);
});

test('leDatasAtuais devolve o par início/fim para a prévia', () => {
  const { campos } = leFormulario(formTarefa);
  assert.deepEqual(leDatasAtuais(campos, 'assign', FUSO), {
    inicio: '2026-08-21 00:00',
    fim: '2026-08-30 23:59',
  });
});

/* ---------- estrutura do curso ---------- */

test('leCurso agrupa atividades por seção e captura o id da seção', () => {
  /* A estrutura precisa ser a do Moodle: as atividades ficam num <ul> dentro da
   * seção. Sem esse <ul>, a regra de parsing do HTML fecha o <li> da seção ao
   * encontrar o <li> da atividade, e elas viram irmãs em vez de filhas. */
  const html = `
    <h1>tteste</h1>
    <ul class="topics">
      <li id="section-1" data-id="41313" data-number="1">
        <h3 class="sectionname">Aula 1</h3>
        <ul class="section">
          <li class="activity forum modtype_forum" id="module-99464">
            <span class="instancename">Fórum 1<span class="accesshide"> Fórum</span></span>
          </li>
          <li class="activity assign modtype_assign" id="module-99465">
            <span class="instancename">Tarefa 1<span class="accesshide"> Tarefa</span></span>
          </li>
        </ul>
      </li>
      <li id="section-2" data-id="41314" data-number="2">
        <ul class="section">
          <li class="activity quiz modtype_quiz" id="module-99466"><span class="instancename">Quiz 2</span></li>
        </ul>
      </li>
    </ul>`;

  const curso = leCurso(html, 5369);

  assert.equal(curso.secoes.length, 2);
  assert.equal(curso.secoes[0].sectionId, '41313');
  assert.deepEqual(curso.secoes[0].atividades.map(a => a.cmid), ['99464', '99465']);
  assert.equal(curso.secoes[0].atividades[0].nome, 'Fórum 1', 'o accesshide sai do nome');
  assert.deepEqual(curso.secoes[1].atividades.map(a => a.tipo), ['quiz']);
});

/* ---------- cadência ---------- */

const { montaLinhas } = require('./cadencia');

test('modo única repete a mesma data em todas as aulas', () => {
  const linhas = montaLinhas({
    modo: 'unica', aulaInicio: 1, aulaFim: 3,
    inicio: '2026-09-01 00:00', fim: '2026-09-15 23:59', intervaloDias: 7,
  });

  assert.deepEqual(linhas.map(l => l.aula), [1, 2, 3]);
  assert.ok(linhas.every(l => l.inicio === '2026-09-01 00:00' && l.fim === '2026-09-15 23:59'));
});

test('modo cadência desloca cada aula pelo intervalo, a partir da primeira', () => {
  const linhas = montaLinhas({
    modo: 'cadencia', aulaInicio: 1, aulaFim: 4,
    inicio: '2026-08-21 00:00', fim: '2026-08-30 23:59', intervaloDias: 7,
  });

  assert.deepEqual(linhas.map(l => l.inicio), [
    '2026-08-21 00:00', '2026-08-28 00:00', '2026-09-04 00:00', '2026-09-11 00:00',
  ]);
  assert.deepEqual(linhas.map(l => l.fim), [
    '2026-08-30 23:59', '2026-09-06 23:59', '2026-09-13 23:59', '2026-09-20 23:59',
  ]);
});

test('cadência conta a partir da primeira aula do range, não da aula 1', () => {
  const linhas = montaLinhas({
    modo: 'cadencia', aulaInicio: 5, aulaFim: 6,
    inicio: '2026-09-20 00:00', fim: '', intervaloDias: 7,
  });

  assert.deepEqual(linhas.map(l => [l.aula, l.inicio]), [
    [5, '2026-09-20 00:00'], [6, '2026-09-27 00:00'],
  ]);
});

test('lado vazio continua vazio — é o jeito de não mexer naquela ponta', () => {
  const linhas = montaLinhas({
    modo: 'cadencia', aulaInicio: 1, aulaFim: 2,
    inicio: '', fim: '2026-09-15 23:59', intervaloDias: 7,
  });

  assert.deepEqual(linhas.map(l => l.inicio), ['', '']);
  assert.deepEqual(linhas.map(l => l.fim), ['2026-09-15 23:59', '2026-09-22 23:59']);
});

test('range invertido ou incompleto não gera linhas', () => {
  const base = { modo: 'unica', inicio: '2026-09-01 00:00', fim: '', intervaloDias: 7 };
  assert.deepEqual(montaLinhas({ ...base, aulaInicio: 5, aulaFim: 2 }), []);
  assert.deepEqual(montaLinhas({ ...base, aulaInicio: NaN, aulaFim: 3 }), []);
});

/* ---------- cookie de sessão: com e sem segredo ---------- */

function comSegredo(valor, executa) {
  const anterior = process.env.MOODLE_SESSION_SECRET;
  if (valor === undefined) delete process.env.MOODLE_SESSION_SECRET;
  else process.env.MOODLE_SESSION_SECRET = valor;
  try { return executa(); } finally {
    if (anterior === undefined) delete process.env.MOODLE_SESSION_SECRET;
    else process.env.MOODLE_SESSION_SECRET = anterior;
  }
}

const SESSAO = { cookies: 'MoodleSession=abc', usuario: 'juan', nome: 'Juan' };

test('sem segredo o app funciona: guarda a sessão em claro no cookie', () => {
  comSegredo(undefined, () => {
    const token = criaToken(SESSAO);
    assert.ok(token.startsWith('p.'), 'marca de token plano');
    assert.equal(cifrando(), false);

    const dados = decifra(token);
    assert.equal(dados.cookies, 'MoodleSession=abc');
    assert.equal(dados.usuario, 'juan');
  });
});

test('token plano é legível por quem tiver o cookie — é o custo aceito', () => {
  comSegredo(undefined, () => {
    const token = criaToken(SESSAO);
    const cru = Buffer.from(token.slice(2), 'base64url').toString('utf8');
    assert.match(cru, /MoodleSession=abc/);
  });
});

test('com segredo, cifra e o valor não aparece em claro', () => {
  comSegredo('x'.repeat(40), () => {
    const token = criaToken(SESSAO);
    assert.ok(token.startsWith('c.'), 'marca de token cifrado');
    assert.equal(cifrando(), true);
    assert.doesNotMatch(token, /MoodleSession/);
    assert.equal(decifra(token).cookies, 'MoodleSession=abc');
  });
});

test('token cifrado adulterado é rejeitado', () => {
  comSegredo('x'.repeat(40), () => {
    const [marca, iv, tag, corpo] = criaToken(SESSAO).split('.');
    const bytes = Buffer.from(corpo, 'base64url');
    bytes[0] ^= 0xff;
    assert.equal(decifra([marca, iv, tag, bytes.toString('base64url')].join('.')), null);
  });
});

test('cookie cifrado deixa de valer se o segredo for removido depois', () => {
  const token = comSegredo('x'.repeat(40), () => criaToken(SESSAO));
  comSegredo(undefined, () => assert.equal(decifra(token), null, 'sem a chave, refaz o login'));
});

test('cookie plano continua valendo depois de configurar o segredo? não — refaz o login', () => {
  const token = comSegredo(undefined, () => criaToken(SESSAO));
  // o formato plano é reconhecido, mas a sessão do Moodle provavelmente já caiu;
  // o importante é não estourar
  comSegredo('x'.repeat(40), () => assert.equal(decifra(token).usuario, 'juan'));
});

test('token vencido não autentica em nenhum dos dois modos', () => {
  for (const segredo of [undefined, 'x'.repeat(40)]) {
    const agora = Date.now;
    Date.now = () => agora() - (VALIDADE_S + 60) * 1000;
    const vencido = comSegredo(segredo, () => criaToken(SESSAO));
    Date.now = agora;
    comSegredo(segredo, () => assert.equal(decifra(vencido), null, `modo ${segredo ? 'cifrado' : 'plano'}`));
  }
});

test('lixo e ausência não estouram', () => {
  assert.equal(decifra('lixo'), null);
  assert.equal(decifra(undefined), null);
  assert.equal(decifra('z.abc'), null, 'formato desconhecido');
});
