'use strict';

/* Configuração da tela → datas explícitas por aula.
 *
 * Vive no núcleo, e não no componente, por dois motivos: fica coberto por
 * `yarn test` (a UI não tem cobertura automática) e existe em um lugar só. Foi
 * assim que a tela do livro de notas divergiu do gerador — duas cópias da mesma
 * regra, a tela mostrando uma coisa e o arquivo saindo com outra. */

const { somaDias } = require('./dates');

/**
 * @param config { modo: 'unica'|'cadencia', aulaInicio, aulaFim, inicio, fim, intervaloDias }
 * @returns [{ aula, inicio, fim }] — o servidor nunca recalcula cadência.
 */
function montaLinhas(config) {
  const { modo, aulaInicio, aulaFim, inicio, fim, intervaloDias } = config;

  if (!Number.isInteger(aulaInicio) || !Number.isInteger(aulaFim)) return [];
  if (aulaFim < aulaInicio || aulaInicio < 0) return [];

  const passo = modo === 'cadencia' ? Number(intervaloDias) : 0;
  if (modo === 'cadencia' && (!Number.isFinite(passo) || passo < 0)) return [];

  return Array.from({ length: aulaFim - aulaInicio + 1 }, (_, i) => ({
    aula: aulaInicio + i,
    inicio: inicio ? somaDias(inicio, i * passo) : '',
    fim: fim ? somaDias(fim, i * passo) : '',
  }));
}

module.exports = { montaLinhas };
