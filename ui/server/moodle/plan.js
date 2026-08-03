'use strict';

/* Onde cada tipo guarda "início" e "fim".
 *
 * Não há um campo universal: tarefa e questionário têm seletores próprios,
 * fórum e glossário só têm restrição de acesso. O planejador esconde essa
 * diferença atrás de dois conceitos — início e fim. */

const { camposDeData, leData, paraTimestamp, deTimestamp, FUSO_PADRAO } = require('./dates');
const { analisaRestricoes, defineRestricaoDeData, dataAtual, serializa } = require('./availability');

const CAMPO_RESTRICOES = 'availabilityconditionsjson';

const REGRAS = {
  assign:   { inicio: { datas: ['allowsubmissionsfromdate'] }, fim: { datas: ['duedate', 'cutoffdate'] } },
  quiz:     { inicio: { datas: ['timeopen'] },                 fim: { datas: ['timeclose'] } },
  forum:    { inicio: { restricao: '>=' },                     fim: { restricao: '<' } },
  glossary: { inicio: { restricao: '>=' },                     fim: { restricao: '<' } },
};

/* A seção recebe só o início. Pôr um "até" no bloco esconderia a aula inteira
 * do aluno depois do prazo — inclusive o material já entregue —, que é
 * diferente de fechar a entrega de uma atividade. */
const REGRA_SECAO = { inicio: { restricao: '>=' } };

const TIPOS_SUPORTADOS = Object.keys(REGRAS);

function aplicaLado(campos, lado, valor, fuso, mudancas, rotulo) {
  if (!lado || !valor) return;

  if (lado.datas) {
    for (const prefixo of lado.datas) {
      if (!campos.tem(`${prefixo}[enabled]`) && !campos.tem(`${prefixo}[year]`)) continue;

      const antes = leData(campos, prefixo);
      if (antes === valor) continue;

      for (const [nome, conteudo] of camposDeData(prefixo, valor)) campos.define(nome, conteudo);
      mudancas.push({ campo: prefixo, rotulo, de: antes ?? '(desativado)', para: valor });
    }
    return;
  }

  const restricoes = analisaRestricoes(campos.obtem(CAMPO_RESTRICOES));
  const timestamp = paraTimestamp(valor, fuso);
  const anterior = dataAtual(restricoes, lado.restricao);
  if (anterior === timestamp) return;

  const { restricoes: novas } = defineRestricaoDeData(restricoes, { direcao: lado.restricao, timestamp });
  campos.define(CAMPO_RESTRICOES, serializa(novas));

  mudancas.push({
    campo: `restrição ${lado.restricao}`,
    rotulo,
    de: anterior ? deTimestamp(anterior, fuso) : '(sem restrição)',
    para: valor,
  });
}

/** Aplica início/fim sobre os campos e devolve o que mudou. Não envia nada. */
function planeja(campos, regra, { inicio, fim }, fuso = FUSO_PADRAO) {
  const mudancas = [];
  aplicaLado(campos, regra.inicio, inicio, fuso, mudancas, 'início');
  aplicaLado(campos, regra.fim, fim, fuso, mudancas, 'fim');
  return mudancas;
}

function planejaAtividade(campos, tipo, datas, fuso) {
  const regra = REGRAS[tipo];
  return regra ? planeja(campos, regra, datas, fuso) : [];
}

function planejaSecao(campos, datas, fuso) {
  return planeja(campos, REGRA_SECAO, { inicio: datas.inicio }, fuso);
}

/** Datas atuais de uma atividade, para a prévia mostrar o "de". */
function leDatasAtuais(campos, tipo, fuso = FUSO_PADRAO) {
  const regra = REGRAS[tipo];
  if (!regra) return { inicio: null, fim: null };

  const ler = lado => {
    if (!lado) return null;
    if (lado.datas) return leData(campos, lado.datas[0]);
    const ts = dataAtual(analisaRestricoes(campos.obtem(CAMPO_RESTRICOES)), lado.restricao);
    return ts ? deTimestamp(ts, fuso) : null;
  };

  return { inicio: ler(regra.inicio), fim: ler(regra.fim) };
}

module.exports = { REGRAS, REGRA_SECAO, TIPOS_SUPORTADOS, planeja, planejaAtividade, planejaSecao, leDatasAtuais };
