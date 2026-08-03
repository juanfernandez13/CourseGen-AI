'use strict';

/* Restrições de acesso do Moodle.
 *
 * Atividade e seção guardam tudo num único campo escondido,
 * availabilityconditionsjson:
 *
 *   {"op":"&","c":[{"type":"date","d":"<","t":1783738500}],"showc":[true]}
 *
 * "d" é a direção: ">=" (a partir de) ou "<" (até). "t" é o timestamp unix.
 *
 * A condição é localizada pela DIREÇÃO, nunca pela posição. O bot anterior
 * escolhia pelo índice na tela (`availabilityItems[1]`) e podia editar a
 * restrição errada quando a atividade tinha mais de uma. */

const VAZIO = { op: '&', c: [], showc: [] };

function analisaRestricoes(bruto) {
  if (!bruto || bruto === 'null') return structuredClone(VAZIO);

  try {
    const dados = JSON.parse(bruto);
    if (!dados || typeof dados !== 'object') return structuredClone(VAZIO);

    return {
      op: dados.op ?? '&',
      c: Array.isArray(dados.c) ? dados.c : [],
      showc: Array.isArray(dados.showc) ? dados.showc : [],
      ...(dados.show !== undefined ? { show: dados.show } : {}),
    };
  } catch {
    return structuredClone(VAZIO);
  }
}

/** Define a data de uma direção preservando as demais condições (grupo, nota,
 *  perfil). Se já existe condição naquela direção, só o timestamp muda. */
function defineRestricaoDeData(restricoes, { direcao, timestamp }) {
  const atualizadas = {
    ...restricoes,
    c: restricoes.c.map(cond => ({ ...cond })),
    showc: [...restricoes.showc],
  };

  const indice = atualizadas.c.findIndex(cond => cond.type === 'date' && cond.d === direcao);

  if (indice >= 0) {
    const anterior = atualizadas.c[indice].t;
    atualizadas.c[indice].t = timestamp;
    return { restricoes: atualizadas, anterior, criada: false };
  }

  atualizadas.c.push({ type: 'date', d: direcao, t: timestamp });
  atualizadas.showc.push(false); // showc acompanha c posição a posição
  return { restricoes: atualizadas, anterior: null, criada: true };
}

function dataAtual(restricoes, direcao) {
  return restricoes.c.find(cond => cond.type === 'date' && cond.d === direcao)?.t ?? null;
}

module.exports = { analisaRestricoes, defineRestricaoDeData, dataAtual, serializa: JSON.stringify };
