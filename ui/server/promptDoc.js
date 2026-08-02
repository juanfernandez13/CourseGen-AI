'use strict';

/* Monta a versão "para humanos" do prompt de extração: o mesmo texto que a
 * aplicação envia ao Gemini, mais um exemplo de saída real. Usado pela rota
 * /api/prompt (botão "copiar prompt") e pelo script `yarn prompt`.
 *
 * A fonte do texto é sempre PROMPT_SCHEMA — nunca uma cópia — para que o prompt
 * distribuído não fique defasado do que o extractor realmente usa. */

const { PROMPT_SCHEMA } = require('./extractor');
/* require (em vez de fs.readFileSync) para o bundler incluir o arquivo no
 * output da Vercel; __dirname não aponta para o código-fonte depois do build. */
const exemploMatriz = require('./exemploMatriz.json');

/* O schema termina neste marcador porque o backend concatena o documento logo
 * depois. No uso manual, o exemplo precisa entrar antes dele. */
const MARCADOR = 'Matriz DE:';

function buildManualPrompt() {
  const exemplo = JSON.stringify(exemploMatriz, null, 2);
  const corpo = PROMPT_SCHEMA.slice(0, PROMPT_SCHEMA.lastIndexOf(MARCADOR)).trimEnd();

  const prompt = [
    corpo,
    '',
    'EXEMPLO DE SAÍDA ESPERADA (outra disciplina, apenas como referência de formato):',
    exemplo,
    '',
    'Responda com o JSON da matriz abaixo, no mesmo formato do exemplo.',
    '',
    MARCADOR,
  ].join('\n');

  return { prompt, exemplo };
}

module.exports = { buildManualPrompt };
