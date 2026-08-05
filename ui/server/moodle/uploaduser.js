'use strict';

/* Envio do CSV de alunos para o "Carregar lista de usuários" do Moodle
 * (admin/tool/uploaduser), por HTTP puro.
 *
 * São quatro saltos, e o segundo é o que não existia na edição de datas:
 *
 *   1. GET  uploaduser/index.php    -> sesskey + itemid de uma área de rascunho
 *   2. POST repository_ajax.php     -> o CSV entra NO RASCUNHO (multipart)
 *   3. POST uploaduser/index.php    -> passo 1, referenciando o itemid
 *   4. POST uploaduser/index.php    -> passo 2, e só AQUI usuários são criados
 *
 * O campo `userfile` do formulário não é o arquivo: é o id do rascunho. E o
 * passo 2 não reenvia o CSV, referencia o `iid` do arquivo já interpretado.
 *
 * O formulário do passo 2 MUDA conforme as colunas do CSV: com uma coluna
 * `password` o Moodle acrescenta `uuforcepasswordchange` e os `uulegacy*`; sem
 * ela, esses campos não existem. Por isso as opções são aplicadas sobre o
 * formulário lido, nunca sobre uma lista fixa. */

const cheerio = require('cheerio');
const { leFormulario, extraiErros } = require('./form');

const CAMINHO = '/admin/tool/uploaduser/index.php';

/* Configuração usada no fluxo do IFCE. Os números são os valores reais dos
 * <select>, conferidos contra o formulário do ead.ifce.edu.br. */
const OPCOES_PADRAO = {
  uutype: '2',                 // adicionar novos e atualizar já existentes
  uupasswordnew: '1',          // criar senha se necessário e enviar por e-mail
  uuupdatetype: '2',           // sobrepor com o arquivo e padrões
  uupasswordold: '1',          // atualizar senha de quem já existe
  uuforcepasswordchange: '2',  // forçar troca para todos
};

const DELIMITADOR_PADRAO = 'comma';

/** O formulário do passo 2 é o que contém `uutype`; a página tem outros com o
 *  mesmo action, e pegar o primeiro traz o formulário errado. */
function formularioComUutype(html) {
  const $ = cheerio.load(html);
  const indice = $('form').toArray().findIndex(f => $(f).find('[name="uutype"]').length);
  if (indice === -1) return null;
  return leFormulario(html, `form:eq(${indice})`);
}

/** Passo 1: abre a página e sobe o CSV para a área de rascunho. */
async function enviaParaRascunho(sessao, csv, nomeArquivo) {
  const html = await sessao.texto(CAMINHO);
  const $ = cheerio.load(html);

  const sesskey = $('input[name="sesskey"]').attr('value');
  const itemid = $('input[name="userfile"]').attr('value');
  if (!sesskey || !itemid) {
    throw new Error('Sem permissão para carregar lista de usuários neste Moodle.');
  }

  const repoId = achaRepositorioDeUpload(html);

  const corpo = new FormData();
  for (const [chave, valor] of Object.entries({
    sesskey, repo_id: repoId, itemid, savepath: '/', title: nomeArquivo, author: '', env: 'filepicker',
  })) corpo.set(chave, valor);
  corpo.set('repo_upload_file', new Blob([csv], { type: 'text/csv' }), nomeArquivo);

  const resposta = await sessao.requisita('/repository/repository_ajax.php?action=upload', {
    method: 'POST', body: corpo,
  });
  const retorno = await resposta.text();

  if (!retorno.includes('"id"')) {
    throw new Error(`O Moodle recusou o arquivo: ${retorno.slice(0, 120)}`);
  }
  return { sesskey, itemid };
}

/* O id do repositório "Enviar um arquivo" vem da configuração do filepicker
 * embutida na página. Fixar um número quebraria em outra instalação. */
function achaRepositorioDeUpload(html) {
  for (const m of html.matchAll(/"id":"(\d+)","name":"[^"]*","type":"upload"/g)) return m[1];
  for (const m of html.matchAll(/\{"id":"?(\d+)"?,[^{}]*"type":"upload"/g)) return m[1];
  return '5'; // padrão do IFCE, conferido; só entra em jogo se o HTML mudar
}

/**
 * Sobe o CSV e devolve a pré-visualização do Moodle sem criar ninguém.
 * É o mesmo passo que a tela mostra antes de confirmar.
 */
async function previsualiza(sessao, { csv, nomeArquivo = 'alunos.csv', delimitador = DELIMITADOR_PADRAO }) {
  const { sesskey, itemid } = await enviaParaRascunho(sessao, csv, nomeArquivo);

  const resposta = await sessao.postaForm(CAMINHO, [
    ['sesskey', sesskey],
    ['_qf__admin_uploaduser_form1', '1'],
    ['mform_isexpanded_id_settingsheader', '1'],
    ['userfile', itemid],
    ['delimiter_name', delimitador],
    ['encoding', 'UTF-8'],
    ['previewrows', '10'],
    ['submitbutton', 'Carregar lista de usuários'],
  ]);

  const html = await resposta.text();
  const formulario = formularioComUutype(html);

  if (!formulario) {
    throw new Error(`O Moodle não aceitou o CSV: ${extraiErros(html)}`);
  }

  return { formulario, linhas: leLinhasDaPrevia(html), html };
}

/** Tabela de pré-visualização: uma linha por aluno, com o status do Moodle. */
function leLinhasDaPrevia(html) {
  const $ = cheerio.load(html);
  const tabela = $('table').filter((_, t) =>
    /Linha CSV|CSV line/i.test($(t).find('th').first().text())).first();
  if (!tabela.length) return [];

  const colunas = tabela.find('th').map((_, th) => $(th).text().trim()).get();

  return tabela.find('tr').map((_, tr) => {
    const celulas = $(tr).find('td').map((__, td) => $(td).text().trim()).get();
    // linha de cabeçalho não tem <td>; sem esse filtro ela virava um aluno em
    // branco, porque o parser de HTML embute o <tr> do <th> dentro do <tbody>
    if (!celulas.length) return null;

    const linha = Object.fromEntries(colunas.map((c, i) => [c, celulas[i] ?? '']));
    return {
      username: linha.username ?? '',
      nome: `${linha.firstname ?? ''} ${linha.lastname ?? ''}`.trim(),
      email: linha.email ?? '',
      status: celulas[celulas.length - 1] ?? '',
    };
  }).get().filter(Boolean);
}

/**
 * Confirma o envio: cria e atualiza os usuários. Não tem desfazer.
 *
 * Reenvia TODOS os campos lidos do passo 2 com as opções aplicadas por cima —
 * mesmo princípio do modedit: campo omitido é configuração perdida.
 */
async function confirma(sessao, formulario, opcoes = {}) {
  const campos = formulario.campos.clone();

  for (const [nome, valor] of Object.entries({ ...OPCOES_PADRAO, ...opcoes })) {
    // só define o que o formulário realmente tem: uuforcepasswordchange não
    // existe quando o CSV não traz coluna de senha
    if (campos.tem(nome)) campos.define(nome, valor);
  }
  campos.pares.push(['submitbutton', 'Carregar lista de usuários']);

  const resposta = await sessao.postaForm(formulario.action || CAMINHO, campos.entries());
  const html = await resposta.text();

  return { ok: !formularioComUutype(html), resumo: leResumo(html), erro: extraiErros(html) };
}

/* Resultado do envio.
 *
 * O Moodle não imprime "Usuários criados: N" nesta página — ele devolve uma
 * tabela com uma linha por aluno e o desfecho na PRIMEIRA coluna ("Novo
 * usuário", "Usuário atualizado", "Erro..."). Contar aqui, a partir dessas
 * linhas, é o que corresponde ao que a página realmente diz; procurar rótulos
 * de contagem devolvia zero em tudo mesmo com o usuário criado. */
function leResumo(html) {
  const $ = cheerio.load(html);

  const tabela = $('table').filter((_, t) =>
    /^\s*Status/i.test($(t).find('th').first().text())).first();

  // colunas: Status | Linha CSV | ID | Identificação de usuário | Nome | ...
  const linhas = tabela.find('tr').map((_, tr) => {
    const celulas = $(tr).find('td').map((__, td) => $(td).text().trim()).get();
    if (!celulas.length) return null;

    return {
      status: celulas[0],
      id: celulas[2] ?? '',
      username: celulas[3] ?? '',
      inscricao: celulas.find(c => /Inscrito no curso/i.test(c)) ?? '',
    };
  }).get().filter(Boolean);

  const conta = expressao => linhas.filter(l => expressao.test(l.status)).length;

  return {
    criados: conta(/novo/i),
    atualizados: conta(/atualiz/i),
    erros: conta(/erro/i),
    linhas,
    texto: tabela.text().replace(/\s+/g, ' ').slice(0, 400),
  };
}

module.exports = {
  OPCOES_PADRAO, DELIMITADOR_PADRAO,
  previsualiza, confirma, leLinhasDaPrevia, leResumo, formularioComUutype, achaRepositorioDeUpload,
};
