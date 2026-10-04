'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normaliza, fichas, variantesDeSemestre, temSemestre,
  pontua, ranqueia, montarPromptTurmas, alertasDaEscolha, confereTurmas,
} = require('./sugestaoTurmas');

/* O caso real que originou o módulo: aluno de Guaramiranga, "Superior em
 * Tecnologia em Gestão de Eventos", a matricular em 2026.2. */
const ALUNO = {
  curso: 'Superior em Tecnologia em Gestão de Eventos',
  cidade: 'Guaramiranga',
  semestre: '2026.2',
};

const CATEGORIAS = [
  { id: '1302', caminho: 'Cursos Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS / 1º Período / 2026.2' },
  { id: '1303', caminho: 'Cursos Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS / 2º Período / 2026.2' },
  { id: '1304', caminho: 'Cursos Presenciais / CAMPUS GUARAMIRANGA / TECNOLOGIA EM EVENTOS / 1º Período / 2026.1' },
  { id: '81',   caminho: 'EAD Técnico / CAMPUS GUARAMIRANGA / TÉCNICO EM ADMINISTRAÇÃO' },
  { id: '470',  caminho: 'EAD Técnico / CAMPUS SOBRAL / TÉCNICO EM EVENTOS' },
  { id: '335',  caminho: 'EAD Pós-graduação' },
];

/* ---------- normalização ---------- */

test('normaliza tira acento, caixa e pontuação', () => {
  assert.equal(normaliza('Gestão de EVENTOS — 2026.2'), 'gestao de eventos 2026 2');
});

test('fichas descarta conectivos, que aparecem em todo caminho', () => {
  assert.deepEqual([...fichas('Superior em Tecnologia em Gestão de Eventos')].sort(),
    ['eventos', 'gestao', 'superior', 'tecnologia']);
});

/* ---------- semestre ---------- */

test('variantesDeSemestre cobre as grafias usadas no IFCE', () => {
  assert.deepEqual(variantesDeSemestre('2026.2'), ['2026.2', '2026/2', '20262', '2026-2', '2026_2']);
});

test('temSemestre acha o semestre em qualquer das grafias', () => {
  assert.equal(temSemestre('Inglês_guaramiranga20262', '2026.2'), true);
  assert.equal(temSemestre('.../1º Período / 2026.2', '2026.2'), true);
  assert.equal(temSemestre('2026/2 - Fundamentos', '2026.2'), true);
  assert.equal(temSemestre('Projeto Integrador I_guaramiranga20261', '2026.2'), false);
});

test('temSemestre não explode com semestre ausente ou torto', () => {
  assert.equal(temSemestre('qualquer coisa', undefined), false);
  assert.deepEqual(variantesDeSemestre('sem número'), []);
});

/* ---------- pontuação ---------- */

test('pontua soma termos em comum, cidade e semestre, e diz por quê', () => {
  const nota = pontua(ALUNO, CATEGORIAS[0]);

  assert.equal(nota.cidadeBate, true);
  assert.equal(nota.semestreBate, true);
  assert.equal(nota.nota, 8);
  assert.ok(nota.motivos.some(m => /tecnologia/.test(m)), 'os motivos precisam citar o que casou');
});

test('pontua rebaixa o semestre errado sem descartá-lo', () => {
  const certo = pontua(ALUNO, CATEGORIAS[0]);
  const errado = pontua(ALUNO, CATEGORIAS[2]); // mesma trilha, 2026.1

  assert.equal(errado.semestreBate, false);
  assert.ok(errado.nota < certo.nota);
  assert.ok(errado.nota > 0, 'continua candidato: a planilha pode estar errada, não a categoria');
});

test('pontua separa campus certo de campus errado', () => {
  const guaramiranga = pontua(ALUNO, CATEGORIAS[3]); // administração, cidade certa
  const sobral = pontua(ALUNO, CATEGORIAS[4]);       // eventos, cidade errada

  assert.equal(guaramiranga.cidadeBate, true);
  assert.equal(sobral.cidadeBate, false);
});

test('pontua devolve zero para categoria sem nada em comum', () => {
  assert.equal(pontua(ALUNO, CATEGORIAS[5]).nota, 0);
});

/* ---------- ranqueamento ---------- */

test('ranqueia põe a categoria correta em primeiro', () => {
  const ranking = ranqueia(ALUNO, CATEGORIAS);

  assert.equal(ranking[0].id, '1302');
  assert.equal(ranking[1].id, '1303', 'o 2º período empata em nota e vem logo atrás');
});

test('ranqueia desempata período pelo caminho, do menor para o maior', () => {
  /* 1º e 2º período têm exatamente a mesma nota — nada nos dados do aluno diz
   * o período. A ordem estável evita que a sugestão mude a cada execução. */
  const [primeiro, segundo] = ranqueia(ALUNO, CATEGORIAS);

  assert.equal(primeiro.nota, segundo.nota);
  assert.match(primeiro.caminho, /1º Período/);
});

test('ranqueia descarta o que não tem termo em comum', () => {
  assert.equal(ranqueia(ALUNO, CATEGORIAS).some(c => c.id === '335'), false);
});

test('ranqueia respeita o limite', () => {
  assert.equal(ranqueia(ALUNO, CATEGORIAS, 2).length, 2);
});

test('montarPromptTurmas leva id, caminho e motivos para o modelo', () => {
  const prompt = montarPromptTurmas(ALUNO, ranqueia(ALUNO, CATEGORIAS, 2));

  assert.match(prompt, /id 1302/);
  assert.match(prompt, /Guaramiranga/);
  assert.match(prompt, /2026\.2/);
});

/* ---------- alerta de raiz errada ---------- */

test('alertasDaEscolha cala quando a escolha bate em tudo', () => {
  const [melhor] = ranqueia(ALUNO, CATEGORIAS);

  assert.deepEqual(alertasDaEscolha(ALUNO, melhor), []);
});

test('alertasDaEscolha denuncia a raiz errada', () => {
  /* O caso real: apontar "EAD Técnico" para um aluno de curso superior devolve
   * o campus certo e o curso errado, com ar de resposta e nota baixa. */
  const soTecnico = [
    { id: '80', caminho: 'EAD Técnico / CAMPUS GUARAMIRANGA' },
    { id: '81', caminho: 'EAD Técnico / CAMPUS GUARAMIRANGA / TÉCNICO EM ADMINISTRAÇÃO' },
  ];
  const [melhor] = ranqueia(ALUNO, soTecnico);
  const alertas = alertasDaEscolha(ALUNO, melhor);

  assert.ok(alertas.some(a => /semestre/.test(a)), 'o semestre pedido não está no caminho');
  assert.ok(alertas.some(a => /raiz pode estar errada/.test(a)));
});

test('alertasDaEscolha aguenta escolha nula', () => {
  assert.deepEqual(alertasDaEscolha(ALUNO, null), []);
});

/* ---------- portão determinístico ---------- */

test('confereTurmas barra categoria sem turma alguma', () => {
  /* Antes isto voltava "aprovado, 0 problemas": o desfecho mais enganoso
   * possível, porque nada matricularia e a tela diria que estava tudo certo. */
  const vazio = confereTurmas([], '2026.2');

  assert.equal(vazio.ok, false);
  assert.match(vazio.problemas[0].mensagem, /não tem turmas/);
  assert.equal(confereTurmas(null, '2026.2').ok, false);
});

test('confereTurmas barra nome breve truncado', () => {
  const { ok, problemas } = confereTurmas([
    { id: '5153', fullname: 'Cerimonial', shortname: 'Cerimonial, Protocolo e Etiqueta Social_Guaram...', truncado: true },
  ], '2026.2');

  assert.equal(ok, false);
  assert.match(problemas[0].mensagem, /truncado/);
});

test('confereTurmas barra turma sem nome breve', () => {
  const { ok, problemas } = confereTurmas([{ id: '9', fullname: 'Sem nav', shortname: null }], '2026.2');

  assert.equal(ok, false);
  assert.equal(problemas.length, 1);
});

test('confereTurmas avisa, sem barrar, quando o semestre não aparece no nome breve', () => {
  const { ok, avisos } = confereTurmas([
    { id: '1', fullname: 'Inglês', shortname: 'Ingles_guaramiranga20261', truncado: false },
  ], '2026.2');

  assert.equal(ok, true, 'nome breve fora do padrão é suspeita, não impedimento');
  assert.match(avisos[0].mensagem, /2026\.2/);
});

test('confereTurmas avisa sobre turma oculta', () => {
  const { ok, avisos } = confereTurmas([
    { id: '1', fullname: 'Inglês', shortname: 'Ingles_guaramiranga20262', truncado: false, visivel: false },
  ], '2026.2');

  assert.equal(ok, true);
  assert.match(avisos[0].mensagem, /oculta/);
});

test('confereTurmas aprova o conjunto correto sem ruído', () => {
  const { ok, problemas, avisos } = confereTurmas([
    { id: '5155', fullname: 'Projeto Integrador I', shortname: 'Projeto Integrador I_guaramiranga20262', truncado: false, visivel: true },
    { id: '5160', fullname: 'Inglês', shortname: 'Inglês_guaramiranga20262', truncado: false, visivel: true },
  ], '2026.2');

  assert.equal(ok, true);
  assert.deepEqual(problemas, []);
  assert.deepEqual(avisos, []);
});
