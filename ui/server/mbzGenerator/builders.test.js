'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildQuizXml, buildQuestionsXml } = require('./builders');
const { PROMPT_QUIZ_BATCH, PROMPT_SCHEMA } = require('../extractor');

const NOW = 1700000000;

function makeAula(quiz = {}) {
  return {
    titulo: 'Aula 1 – Teste',
    data_inicio: '01/04/2026',
    data_fim:    '10/04/2026',
    quiz: {
      titulo: '[Aula 1] [Questionário 1] Teste [10]',
      data_inicio: '01/04/2026',
      data_fim:    '10/04/2026',
      questoes: [],
      ...quiz,
    },
  };
}

test('buildQuizXml: timelimit padrão é 7200 segundos (2 horas)', () => {
  const xml = buildQuizXml(1000, 2000, makeAula(), NOW);
  assert.match(xml, /<timelimit>7200<\/timelimit>/);
  assert.doesNotMatch(xml, /<timelimit>3600<\/timelimit>/);
});

test('buildQuestionsXml (múltipla escolha): usa o feedback do arquivo quando presente', () => {
  const aulas = [makeAula({
    questoes: [{
      tipo: 'multipla_escolha',
      numero: 1,
      enunciado: 'Qual é a capital do Brasil?',
      pontuacao: 2,
      itens: [
        { texto: 'São Paulo', isCorrect: false, feedback: 'Errado: SP é a maior cidade, não a capital.' },
        { texto: 'Brasília',  isCorrect: true,  feedback: 'Correto! Brasília é a capital desde 1960.' },
      ],
    }],
  })];
  const aulaIds = [{ quizId: 5000, quizCtx: 6000 }];
  const xml = buildQuestionsXml(aulas, aulaIds, NOW);

  assert.match(xml, /Errado: SP é a maior cidade, não a capital\./);
  assert.match(xml, /Correto! Brasília é a capital desde 1960\./);
  assert.doesNotMatch(xml, /Opção correta\. Parabéns!/);
  assert.doesNotMatch(xml, /Opção incorreta\./);
});

test('buildQuestionsXml (múltipla escolha): cai no texto fixo quando não há feedback no arquivo', () => {
  const aulas = [makeAula({
    questoes: [{
      tipo: 'multipla_escolha',
      numero: 1,
      enunciado: 'Quanto é 2 + 2?',
      pontuacao: 1,
      itens: [
        { texto: '3', isCorrect: false },
        { texto: '4', isCorrect: true  },
      ],
    }],
  })];
  const aulaIds = [{ quizId: 5000, quizCtx: 6000 }];
  const xml = buildQuestionsXml(aulas, aulaIds, NOW);

  assert.match(xml, /Opção correta\. Parabéns!/);
  assert.match(xml, /Opção incorreta\./);
});

test('buildQuestionsXml (múltipla escolha): mistura feedbacks — usa do arquivo se houver, fixo se não', () => {
  const aulas = [makeAula({
    questoes: [{
      tipo: 'multipla_escolha',
      numero: 1,
      enunciado: 'Mistura',
      pontuacao: 1,
      itens: [
        { texto: 'A', isCorrect: false, feedback: 'Comentário customizado A' },
        { texto: 'B', isCorrect: true  }, // sem feedback → fallback
      ],
    }],
  })];
  const aulaIds = [{ quizId: 5000, quizCtx: 6000 }];
  const xml = buildQuestionsXml(aulas, aulaIds, NOW);

  assert.match(xml, /Comentário customizado A/);
  assert.match(xml, /Opção correta\. Parabéns!/);
});

test('buildQuestionsXml (múltipla escolha): sanitiza HTML perigoso vindo do feedback do arquivo', () => {
  const aulas = [makeAula({
    questoes: [{
      tipo: 'multipla_escolha',
      numero: 1,
      enunciado: 'XSS test',
      pontuacao: 1,
      itens: [
        { texto: 'A', isCorrect: true, feedback: '<script>alert("x")</script> & "aspas"' },
      ],
    }],
  })];
  const aulaIds = [{ quizId: 5000, quizCtx: 6000 }];
  const xml = buildQuestionsXml(aulas, aulaIds, NOW);

  assert.doesNotMatch(xml, /<script>/);
  assert.match(xml, /&lt;script&gt;/);
  assert.match(xml, /&amp;/);
  assert.match(xml, /&quot;aspas&quot;/);
});

test('buildQuestionsXml (dissertativa): generalfeedback continua usando q.feedback', () => {
  const aulas = [makeAula({
    questoes: [{
      tipo: 'dissertativa',
      numero: 1,
      enunciado: 'Disserte sobre algo.',
      pontuacao: 3,
      feedback: 'Gabarito: cite os 3 pontos principais.',
    }],
  })];
  const aulaIds = [{ quizId: 5000, quizCtx: 6000 }];
  const xml = buildQuestionsXml(aulas, aulaIds, NOW);

  assert.match(xml, /<generalfeedback>.*Gabarito: cite os 3 pontos principais\..*<\/generalfeedback>/s);
});

test('PROMPT_QUIZ_BATCH: schema documenta feedback opcional por alternativa em multipla_escolha', () => {
  assert.match(PROMPT_QUIZ_BATCH, /multipla_escolha/);
  assert.match(PROMPT_QUIZ_BATCH, /"feedback":\s*"comentário do arquivo/);
  assert.match(PROMPT_QUIZ_BATCH, /transcreva-o LITERALMENTE/);
  assert.match(PROMPT_QUIZ_BATCH, /omita o campo "feedback"/);
});

test('PROMPT_SCHEMA: orienta a buscar datas das aulas em qualquer local textual (não só cronograma)', () => {
  // Não pode mais existir a regra antiga e simplista
  assert.doesNotMatch(PROMPT_SCHEMA, /^- Datas: extraia do cronograma\/calendário\. Use null se não encontrar\.$/m);
  // Deve cobrir os locais alternativos
  assert.match(PROMPT_SCHEMA, /título ou subtítulo da aula/);
  assert.match(PROMPT_SCHEMA, /descrição\/apresentação da aula/);
  // Deve aceitar formatos variados e normalizar
  assert.match(PROMPT_SCHEMA, /normalize SEMPRE para .DD\/MM\/YYYY./);
  // Deve dizer pra herdar ano do contexto
  assert.match(PROMPT_SCHEMA, /herde do contexto/);
  // Atividades herdam datas da aula quando não têm próprias
  assert.match(PROMPT_SCHEMA, /herde data_inicio\/data_fim da aula/);
});
