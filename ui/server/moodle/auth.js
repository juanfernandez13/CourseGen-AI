'use strict';

/* Sessão do Moodle guardada num cookie httpOnly da própria aplicação.
 *
 * O que viaja é o cookie de sessão do Moodle CIFRADO (AES-256-GCM). Motivos:
 *
 *   - httpOnly tira o valor do alcance de JavaScript, então XSS não o lê;
 *   - cifrado, nem o dono do navegador consegue extrair a sessão do Moodle do
 *     próprio cookie e usá-la fora da aplicação;
 *   - sem estado no servidor, que é o que permite rodar em serverless sem
 *     depender de Redis ou banco.
 *
 * As credenciais nunca são guardadas — são usadas uma vez para autenticar e
 * descartadas. */

const crypto = require('crypto');

const COOKIE = 'moodle_sessao';
const VALIDADE_S = 2 * 60 * 60; // sessão do Moodle costuma cair antes disso
const ALGORITMO = 'aes-256-gcm';

let chaveEfemera = null;

function chave() {
  const segredo = process.env.MOODLE_SESSION_SECRET;
  if (segredo) return crypto.createHash('sha256').update(segredo).digest();

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MOODLE_SESSION_SECRET não configurada — a sessão não pode ser cifrada.');
  }

  // Em desenvolvimento seguimos com uma chave de processo: reiniciar o servidor
  // derruba as sessões, o que é aceitável e melhor que não cifrar.
  if (!chaveEfemera) {
    chaveEfemera = crypto.randomBytes(32);
    console.warn('[moodle] MOODLE_SESSION_SECRET ausente; usando chave efêmera de desenvolvimento.');
  }
  return chaveEfemera;
}

function cifra(dados) {
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv(ALGORITMO, chave(), iv);
  const corpo = Buffer.concat([cifrador.update(JSON.stringify(dados), 'utf8'), cifrador.final()]);

  return [iv, cifrador.getAuthTag(), corpo].map(b => b.toString('base64url')).join('.');
}

function decifra(token) {
  try {
    const [iv, tag, corpo] = String(token).split('.').map(p => Buffer.from(p, 'base64url'));
    if (!iv || !tag || !corpo) return null;

    const decifrador = crypto.createDecipheriv(ALGORITMO, chave(), iv);
    decifrador.setAuthTag(tag);

    const texto = Buffer.concat([decifrador.update(corpo), decifrador.final()]).toString('utf8');
    const dados = JSON.parse(texto);

    if (!dados?.cookies || !dados?.expiraEm || Date.now() > dados.expiraEm) return null;
    return dados;
  } catch {
    // tag inválida, chave trocada ou cookie corrompido — tratar como deslogado
    return null;
  }
}

function criaToken({ cookies, usuario, nome }) {
  return cifra({ cookies, usuario, nome, expiraEm: Date.now() + VALIDADE_S * 1000 });
}

const opcoesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: VALIDADE_S,
};

module.exports = { COOKIE, VALIDADE_S, criaToken, decifra, opcoesCookie };
