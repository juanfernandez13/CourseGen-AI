'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cpfTemDigitoValido, emailValido, normalizarAluno, normalizarAlunos, montarCsv,
  SENHA_PADRAO, CIDADE_PADRAO,
} = require('./alunos');
const { parseCsv } = require('./planilha');

/* CPF de teste com dígitos verificadores corretos. */
const CPF_OK = '52998224725';

function problemasDe(aluno, campo) {
  return aluno.problemas.filter(p => p.campo === campo);
}

/* ─── CPF ────────────────────────────────────────────────────────────────── */

test('valida dígito verificador do CPF', () => {
  assert.equal(cpfTemDigitoValido(CPF_OK), true);
  assert.equal(cpfTemDigitoValido('12345678901'), false);
});

test('rejeita CPF com todos os dígitos iguais', () => {
  assert.equal(cpfTemDigitoValido('11111111111'), false);
});

test('remove pontuação do CPF sem alterar os dígitos', () => {
  const aluno = normalizarAluno({ cpf: '529.982.247-25' });
  assert.equal(aluno.username, CPF_OK);
  assert.deepEqual(problemasDe(aluno, 'username'), []);
});

test('acusa CPF com quantidade errada de dígitos sem completar', () => {
  const aluno = normalizarAluno({ cpf: '5299822472' });
  assert.equal(aluno.username, '5299822472');
  assert.match(problemasDe(aluno, 'username')[0].mensagem, /10 dígitos/);
});

test('acusa CPF ausente em vez de inventar', () => {
  const aluno = normalizarAluno({ cpf: null });
  assert.equal(aluno.username, '');
  assert.equal(problemasDe(aluno, 'username').length, 1);
});

/* ─── E-mail ─────────────────────────────────────────────────────────────── */

test('valida formato de e-mail', () => {
  assert.equal(emailValido('maria@ifce.edu.br'), true);
  assert.equal(emailValido('maria@ifce'), false);
  assert.equal(emailValido('maria ifce.edu.br'), false);
  assert.equal(emailValido('maria @ifce.edu.br'), false);
});

test('marca e-mail inválido mas preserva o valor original', () => {
  const aluno = normalizarAluno({ email: 'maria@ifce' });
  assert.equal(aluno.email, 'maria@ifce');
  assert.equal(problemasDe(aluno, 'email').length, 1);
});

/* ─── Defaults ───────────────────────────────────────────────────────────── */

test('senha é sempre a padrão', () => {
  assert.equal(normalizarAluno({}).password, SENHA_PADRAO);
  assert.equal(normalizarAluno({ password: 'outra' }).password, SENHA_PADRAO);
});

test('cidade ausente vira Fortaleza e gera aviso', () => {
  const aluno = normalizarAluno({ city: '  ' });
  assert.equal(aluno.city, CIDADE_PADRAO);
  assert.equal(aluno.avisos.filter(a => a.campo === 'city').length, 1);
});

test('cidade informada é preservada sem aviso', () => {
  const aluno = normalizarAluno({ city: 'Sobral' });
  assert.equal(aluno.city, 'Sobral');
  assert.deepEqual(aluno.avisos, []);
});

test('type1 aceita apenas 1 ou 2, com 1 como padrão', () => {
  assert.equal(normalizarAluno({ type1: 2 }).type1, 2);
  assert.equal(normalizarAluno({ type1: '2' }).type1, 2);
  assert.equal(normalizarAluno({ type1: 7 }).type1, 1);
  assert.equal(normalizarAluno({}).type1, 1);
});

test('curso ausente é problema, porque exige conferência', () => {
  assert.equal(problemasDe(normalizarAluno({}), 'course1').length, 1);
  assert.deepEqual(problemasDe(normalizarAluno({ course1: 'MAT001' }), 'course1'), []);
});

/* ─── Nome ───────────────────────────────────────────────────────────────── */

test('normaliza espaços do nome e acusa sobrenome ausente', () => {
  const aluno = normalizarAluno({ firstname: '  Maria   ', lastname: '' });
  assert.equal(aluno.firstname, 'Maria');
  assert.equal(problemasDe(aluno, 'lastname').length, 1);
});

/* ─── CSV ────────────────────────────────────────────────────────────────── */

test('CSV sai na ordem de colunas do Moodle', () => {
  const linhas = montarCsv([]).trim().split('\r\n');
  assert.equal(
    linhas[0],
    '"password","username","firstname","lastname","email","city","course1","type1"',
  );
});

test('CSV escapa aspas e não vaza os campos de diagnóstico', () => {
  const [aluno] = normalizarAlunos([{
    cpf: CPF_OK, firstname: 'Ana', lastname: 'Souza',
    email: 'ana@ifce.edu.br', city: 'Aspas "teste"', course1: 'MAT001', type1: 1,
  }]);

  const linha = montarCsv([aluno]).trim().split('\r\n')[1];
  assert.equal(
    linha,
    '"abcd1234","52998224725","Ana","Souza","ana@ifce.edu.br","Aspas ""teste""","MAT001","1"',
  );
  assert.ok(!linha.includes('problemas'));
});

/* ─── Leitura de CSV ─────────────────────────────────────────────────────── */

test('lê CSV separado por ponto e vírgula', () => {
  const rows = parseCsv('nome;cpf\nAna Souza;529.982.247-25\n');
  assert.deepEqual(rows, [['nome', 'cpf'], ['Ana Souza', '529.982.247-25']]);
});

test('respeita vírgulas e aspas dentro das células', () => {
  const rows = parseCsv('nome,cidade\n"Souza, Ana","Fortaleza"\n');
  assert.deepEqual(rows, [['nome', 'cidade'], ['Souza, Ana', 'Fortaleza']]);
});

/* ─── Geração múltipla ───────────────────────────────────────────────────── */

const { montarCsvPorCurso, slugCurso } = require('./alunos');

const TURMA = normalizarAlunos([
  { cpf: CPF_OK, firstname: 'Ana', lastname: 'Souza', email: 'ana@ifce.edu.br', city: 'Sobral', course1: 'ORIGINAL' },
  { cpf: '111.444.777-35', firstname: 'Bruno', lastname: 'Lima', email: 'bruno@ifce.edu.br', city: 'Fortaleza', course1: 'ORIGINAL' },
]);

test('gera um CSV por curso com os mesmos alunos', () => {
  const arquivos = montarCsvPorCurso(TURMA, ['MAT001', 'FIS002'], 'turma');

  assert.equal(arquivos.length, 2);
  assert.deepEqual(arquivos.map(a => a.curso), ['MAT001', 'FIS002']);
  for (const arquivo of arquivos) {
    // cabeçalho + 2 alunos
    assert.equal(arquivo.csv.trim().split('\r\n').length, 3);
  }
});

test('cada arquivo sobrescreve o course1 que veio da planilha', () => {
  const [mat] = montarCsvPorCurso(TURMA, ['MAT001'], 'turma');
  assert.ok(mat.csv.includes('"MAT001"'));
  assert.ok(!mat.csv.includes('ORIGINAL'));
});

test('cursos repetidos não geram arquivos duplicados', () => {
  const arquivos = montarCsvPorCurso(TURMA, ['MAT001', 'MAT001', ' MAT001 '], 'turma');
  assert.equal(arquivos.length, 1);
});

test('sem curso nenhum não gera arquivo', () => {
  assert.deepEqual(montarCsvPorCurso(TURMA, []), []);
  assert.deepEqual(montarCsvPorCurso(TURMA, ['  ']), []);
});

test('nome de arquivo tira acento e caractere especial', () => {
  assert.equal(slugCurso('Técnico em Serviços Públicos'), 'Tecnico_em_Servicos_Publicos');
  assert.equal(slugCurso('  '), 'curso');
  const [arquivo] = montarCsvPorCurso(TURMA, ['Informática/EAD'], 'turma');
  assert.equal(arquivo.filename, 'turma_Informatica_EAD.csv');
});
