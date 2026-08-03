/* Ponte entre a tela e o núcleo.
 *
 * `montaLinhas` mora em server/moodle/cadencia.js para ficar coberta por
 * `yarn test`; aqui ficam só os ajustes de formato do <input>. */

export { montaLinhas } from '../../../server/moodle/cadencia';

/** "2026-09-15 23:59" ↔ "2026-09-15T23:59" do <input type="datetime-local">. */
export const paraInput = (valor: string) => (valor ? valor.replace(' ', 'T') : '');
export const doInput = (valor: string) => (valor ? valor.replace('T', ' ').slice(0, 16) : '');

/* O relatório traz também marcadores como "(desativado)" e "(sem restrição)" no
 * lugar de uma data; só formata o que de fato é data. */
export function formataCurto(valor: string) {
  if (!valor) return '—';

  const casou = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})$/.exec(valor);
  if (!casou) return valor;

  const [, ano, mes, dia, hora] = casou;
  return `${dia}/${mes}/${ano.slice(2)} ${hora}`;
}
