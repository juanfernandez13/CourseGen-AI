'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const { lerPlanilha, parseCsv, ehXlsLegado, ehXlsx } = require('./planilha');

/* Gera planilha de verdade em memória, no formato pedido, em vez de guardar
 * binário no repositório. 'biff8' é o .xls do Excel 97-2003. */
function planilha(linhas, formato) {
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, XLSX.utils.aoa_to_sheet(linhas), 'Alunos');
  return XLSX.write(pasta, { bookType: formato, type: 'buffer' });
}

const LINHAS = [
  ['CPF', 'Nome', 'Sobrenome', 'Cidade', 'Email'],
  ['12345678909', 'Alessandra', 'de Sousa Castro', 'BATURITÉ', 'a@x.com'],
  ['98765432100', 'EDUARDO', 'SILVA DO CARMO', 'ITAPIUNA', 'e@x.com'],
];

test('lê .xls do Excel 97-2003, que o exceljs não abre', async () => {
  const rows = await lerPlanilha(planilha(LINHAS, 'biff8'), 'alunos.xls');

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], LINHAS[0]);
  assert.equal(rows[1][1], 'Alessandra');
  assert.equal(rows[2][3], 'ITAPIUNA');
});

test('.xlsx continua sendo lido pelo caminho antigo', async () => {
  const rows = await lerPlanilha(planilha(LINHAS, 'xlsx'), 'alunos.xlsx');

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], LINHAS[0]);
  assert.equal(rows[1][0], '12345678909');
});

test('o formato vem da assinatura do conteúdo, não da extensão', async () => {
  // planilha baixada de sistema acadêmico costuma vir com o nome trocado
  const comoXls = planilha(LINHAS, 'biff8');
  const comoXlsx = planilha(LINHAS, 'xlsx');

  assert.ok(ehXlsLegado(comoXls) && !ehXlsx(comoXls));
  assert.ok(ehXlsx(comoXlsx) && !ehXlsLegado(comoXlsx));

  // .xls chamado de .xlsx e vice-versa: ambos leem
  assert.equal((await lerPlanilha(comoXls, 'alunos.xlsx')).length, 3);
  assert.equal((await lerPlanilha(comoXlsx, 'alunos.xls')).length, 3);
});

test('CPF salvo como texto mantém o zero à esquerda', async () => {
  const comZero = [['CPF', 'Nome'], ['01234567890', 'Fulano']];

  for (const formato of ['biff8', 'xlsx']) {
    const rows = await lerPlanilha(planilha(comZero, formato), `a.${formato}`);
    assert.equal(rows[1][0], '01234567890', `zero perdido em ${formato}`);
  }
});

test('linhas em branco no meio não viram alunos vazios', async () => {
  const comBuraco = [['CPF', 'Nome'], ['11122233344', 'Fulano'], ['', ''], ['55566677788', 'Beltrano']];
  const rows = await lerPlanilha(planilha(comBuraco, 'biff8'), 'a.xls');

  assert.equal(rows.length, 3);
  assert.equal(rows[2][1], 'Beltrano');
});

test('formato desconhecido falha dizendo o que fazer, não "sem linhas"', async () => {
  // antes, um binário qualquer voltava [] e a rota culpava o conteúdo da planilha
  await assert.rejects(
    () => lerPlanilha(Buffer.from('%PDF-1.7 conteudo qualquer'), 'alunos.pdf'),
    /não reconhecido.*\.xlsx, \.xls ou \.csv/s,
  );
});

test('CSV continua funcionando, inclusive com ponto e vírgula', () => {
  const rows = parseCsv('CPF;Nome\r\n12345678909;Alessandra\r\n');

  assert.deepEqual(rows, [['CPF', 'Nome'], ['12345678909', 'Alessandra']]);
});
