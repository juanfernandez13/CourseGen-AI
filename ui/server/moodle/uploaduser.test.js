'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPCOES_PADRAO, confirma, leLinhasDaPrevia, leResumo,
  formularioComUutype, achaRepositorioDeUpload,
} = require('./uploaduser');

/* A página do passo 2 tem TRÊS formulários com o mesmo action; o de verdade é o
 * que contém uutype. Pegar o primeiro traz o formulário de admin, com dois
 * campos, e o envio sai vazio. */
const PASSO2 = `
<form action="/admin/tool/uploaduser/index.php"><input type="hidden" name="adminedit" value="1"></form>
<form action="/course/search.php"><input name="search"></form>
<form action="/admin/tool/uploaduser/index.php" method="post">
  <input type="hidden" name="iid" value="1785888393">
  <input type="hidden" name="sesskey" value="ABC">
  <input type="hidden" name="_qf__admin_uploaduser_form2" value="1">
  <select name="uutype">
    <option value="0" selected>Adicionar somente novos</option>
    <option value="2">Adicionar novos e atualizar</option>
  </select>
  <select name="uupasswordnew"><option value="0">Do arquivo</option><option value="1" selected>Criar e enviar</option></select>
  <select name="uuupdatetype"><option value="0" selected>Nenhuma mudança</option><option value="2">Sobrepor com arquivo e padrões</option></select>
  <select name="uupasswordold"><option value="0" selected>Nenhuma</option><option value="1">Atualizar</option></select>
  <select name="uuforcepasswordchange"><option value="1">Fracas</option><option value="0" selected>Nenhum</option><option value="2">Todos</option></select>
  <select name="lang"><option value="pt_br" selected>Português</option></select>
  <input type="text" name="city" value="">
  <input type="submit" name="submitbutton" value="Carregar lista de usuários">
</form>`;

// sem coluna password o Moodle não emite uuforcepasswordchange
const PASSO2_SEM_SENHA = PASSO2.replace(
  /<select name="uuforcepasswordchange">.*?<\/select>/s, '');

test('acha o formulário do passo 2 entre os outros da página', () => {
  const f = formularioComUutype(PASSO2);
  assert.ok(f, 'formulário não encontrado');
  assert.equal(f.campos.obtem('iid'), '1785888393');
  assert.ok(f.campos.entries().length > 5, 'pegou o formulário de admin por engano');
});

test('as opções do IFCE são os valores reais dos selects', () => {
  assert.deepEqual(OPCOES_PADRAO, {
    uutype: '2',
    uupasswordnew: '1',
    uuupdatetype: '2',
    uupasswordold: '1',
    uuforcepasswordchange: '2',
  });
});

test('confirma reenvia o formulário inteiro com as opções por cima', async () => {
  const formulario = formularioComUutype(PASSO2);
  let enviado;

  const sessao = {
    postaForm: async (_caminho, campos) => {
      enviado = new Map(campos);
      return { text: async () => '<p>Usuários criados: 3</p>' };
    },
  };

  await confirma(sessao, formulario);

  assert.equal(enviado.get('uutype'), '2');
  assert.equal(enviado.get('uupasswordold'), '1');
  assert.equal(enviado.get('uuforcepasswordchange'), '2');
  // campos não relacionados às opções continuam indo, como o navegador faria
  assert.equal(enviado.get('iid'), '1785888393');
  assert.equal(enviado.get('lang'), 'pt_br');
  assert.equal(enviado.get('submitbutton'), 'Carregar lista de usuários');
});

test('não inventa campo que o formulário não tem', async () => {
  const formulario = formularioComUutype(PASSO2_SEM_SENHA);
  let enviado;
  const sessao = {
    postaForm: async (_c, campos) => { enviado = new Map(campos); return { text: async () => 'ok' }; },
  };

  await confirma(sessao, formulario);

  assert.equal(enviado.has('uuforcepasswordchange'), false,
    'sem coluna password o campo não existe e não pode ser inventado');
  assert.equal(enviado.get('uutype'), '2');
});

test('lê a prévia linha a linha com o status do Moodle', () => {
  const html = `<table>
    <tr><th>Linha CSV</th><th>username</th><th>firstname</th><th>lastname</th><th>email</th><th>Status</th></tr>
    <tbody>
      <tr><td>2</td><td>00000000191</td><td>ZZ</td><td>Teste</td><td>zz@x.com</td><td>Novo usuário</td></tr>
      <tr><td>3</td><td>11122233344</td><td>Ana</td><td>Silva</td><td>ana@x.com</td><td>Usuário já existe</td></tr>
    </tbody></table>`;

  const linhas = leLinhasDaPrevia(html);

  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas[0], {
    username: '00000000191', nome: 'ZZ Teste', email: 'zz@x.com', status: 'Novo usuário',
  });
  assert.equal(linhas[1].status, 'Usuário já existe');
});

test('página sem tabela de prévia não quebra', () => {
  assert.deepEqual(leLinhasDaPrevia('<p>erro</p>'), []);
});

/* Formato real da página de resultado, conferido contra o ead.ifce.edu.br: o
 * desfecho vem na PRIMEIRA coluna de cada linha, não como contagem em texto. */
test('resumo conta pelo status de cada linha do resultado', () => {
  const html = `<table>
    <tr><th>Status</th><th>Linha CSV</th><th>ID</th><th>Identificação</th><th>Inscrições</th></tr>
    <tbody>
      <tr><td>Novo usuário</td><td>2</td><td>2484</td><td>00000000191</td><td>Inscrito no curso "Disciplina teste" como "student"</td></tr>
      <tr><td>Novo usuário</td><td>3</td><td>2485</td><td>00000000272</td><td></td></tr>
      <tr><td>Usuário atualizado</td><td>4</td><td>900</td><td>11122233344</td><td></td></tr>
      <tr><td>Erro: e-mail duplicado</td><td>5</td><td></td><td>55566677788</td><td></td></tr>
    </tbody></table>`;

  const r = leResumo(html);

  assert.equal(r.criados, 2);
  assert.equal(r.atualizados, 1);
  assert.equal(r.erros, 1);

  // o ID do Moodle e o username ficam em colunas diferentes e são fáceis de trocar
  assert.equal(r.linhas[0].id, '2484');
  assert.equal(r.linhas[0].username, '00000000191');
  assert.match(r.linhas[0].inscricao, /Disciplina teste/);
});

test('resumo não estoura quando o Moodle devolve outra coisa', () => {
  const r = leResumo('<p>sessão expirada</p>');
  assert.deepEqual([r.criados, r.atualizados, r.erros], [0, 0, 0]);
  assert.deepEqual(r.linhas, []);
});

test('o repositório de upload vem da página, não de um número fixo', () => {
  const html = '...{"id":"5","name":"Enviar um arquivo","type":"upload",...}...';
  assert.equal(achaRepositorioDeUpload(html), '5');

  const outro = '...{"id":"9","name":"Upload a file","type":"upload",...}...';
  assert.equal(achaRepositorioDeUpload(outro), '9');
});
