'use strict';

/* Autenticação no Moodle do IFCE.
 *
 * O tema renomeia os ids dos campos (#inputName/#inputPassword), mas os
 * atributos `name` continuam sendo os do Moodle padrão — o POST é o clássico
 * username/password/logintoken em /login/index.php. */

const cheerio = require('cheerio');

/** O sesskey aparece no M.cfg embutido na página e também nos links de ação. */
function extraiSesskey(html) {
  return (
    html.match(/"sesskey"\s*:\s*"([^"]+)"/)?.[1] ??
    html.match(/sesskey=([A-Za-z0-9]+)/)?.[1] ??
    null
  );
}

async function login(sessao, { usuario, senha }) {
  if (!usuario || !senha) throw new Error('Informe usuário e senha do Moodle.');

  // a primeira visita cria o MoodleSession ao qual o logintoken está amarrado
  const paginaInicial = await sessao.texto('/');
  const logintoken = cheerio.load(paginaInicial)('input[name="logintoken"]').attr('value') ?? '';

  const resposta = await sessao.postaForm('/login/index.php', [
    ['anchor', ''],
    ['logintoken', logintoken],
    ['username', usuario],
    ['password', senha],
  ]);

  const html = await resposta.text();
  const sesskey = extraiSesskey(html);

  if (!sesskey || html.includes('name="logintoken"')) {
    const erro = cheerio.load(html)('.loginerrors, .alert-danger, #loginerrormessage')
      .first().text().trim();
    throw new Error(erro || 'Usuário ou senha inválidos.');
  }

  return { sesskey, nome: extraiNome(html) };
}

function extraiNome(html) {
  const $ = cheerio.load(html);
  return (
    $('.usertext, .userbutton .usertext').first().text().trim() ||
    $('a[href*="/user/profile.php"]').first().text().trim() ||
    ''
  );
}

/** Confere se os cookies guardados ainda valem, sem reenviar credenciais. */
async function sessaoViva(sessao) {
  const html = await sessao.texto('/my/');
  return Boolean(extraiSesskey(html)) && !html.includes('name="logintoken"');
}

module.exports = { login, extraiSesskey, sessaoViva };
