'use strict';

/* Sessão do Moodle guardada num cookie httpOnly da própria aplicação.
 *
 * O cookie carrega o `MoodleSession` — que É a credencial: quem tem aquele
 * valor está logado como o usuário. Guardar no navegador é o que permite rodar
 * em serverless sem Redis nem banco, já que cada invocação é um processo novo e
 * não há memória compartilhada.
 *
 * Duas formas, escolhidas pela presença de MOODLE_SESSION_SECRET:
 *
 *   com segredo  →  "c." + AES-256-GCM   (recomendado)
 *   sem segredo  →  "p." + base64url     (padrão, funciona sem configurar nada)
 *
 * O que a cifra acrescenta: sem ela, quem abre o DevTools ou copia o perfil do
 * navegador lê o valor e usa a sessão do Moodle fora daqui, sem senha. O
 * `httpOnly` cobre XSS, não acesso à máquina. Foi uma escolha explícita rodar
 * assim por padrão, para não exigir configuração; definir o segredo fecha essa
 * porta e não muda mais nada.
 *
 * As credenciais nunca são guardadas — são usadas uma vez para autenticar e
 * descartadas. */

const crypto = require('crypto');

const COOKIE = 'moodle_sessao';
const VALIDADE_S = 2 * 60 * 60; // sessão do Moodle costuma cair antes disso
const ALGORITMO = 'aes-256-gcm';

const CIFRADO = 'c';
const PLANO = 'p';

let avisou = false;

/** Chave de cifra, ou null quando não há segredo configurado. */
function chave() {
  const segredo = (process.env.MOODLE_SESSION_SECRET ?? '').trim();
  if (segredo) return crypto.createHash('sha256').update(segredo).digest();

  if (!avisou) {
    console.warn(
      '[moodle] MOODLE_SESSION_SECRET ausente: a sessão do Moodle vai no cookie '
      + 'sem cifra (ainda httpOnly). Defina a variável para cifrar.',
    );
    avisou = true;
  }
  return null;
}

function empacota(dados) {
  const texto = JSON.stringify(dados);
  const chaveAtual = chave();

  if (!chaveAtual) {
    return `${PLANO}.${Buffer.from(texto, 'utf8').toString('base64url')}`;
  }

  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv(ALGORITMO, chaveAtual, iv);
  const corpo = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);

  return [CIFRADO, iv, cifrador.getAuthTag(), corpo]
    .map(p => (Buffer.isBuffer(p) ? p.toString('base64url') : p))
    .join('.');
}

function desempacota(token) {
  const partes = String(token).split('.');
  const marca = partes[0];

  if (marca === PLANO) {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
  }

  if (marca === CIFRADO) {
    const chaveAtual = chave();
    // cookie cifrado e segredo removido depois: não há como ler, refaz o login
    if (!chaveAtual) return null;

    const [iv, tag, corpo] = partes.slice(1).map(p => Buffer.from(p, 'base64url'));
    const decifrador = crypto.createDecipheriv(ALGORITMO, chaveAtual, iv);
    decifrador.setAuthTag(tag);

    return JSON.parse(
      Buffer.concat([decifrador.update(corpo), decifrador.final()]).toString('utf8'),
    );
  }

  return null; // formato desconhecido (cookie antigo, lixo)
}

function decifra(token) {
  if (!token) return null;

  try {
    const dados = desempacota(token);
    if (!dados?.cookies || !dados?.expiraEm || Date.now() > dados.expiraEm) return null;
    return dados;
  } catch {
    // tag inválida, chave trocada ou cookie corrompido — tratar como deslogado
    return null;
  }
}

function criaToken({ cookies, usuario, nome }) {
  return empacota({ cookies, usuario, nome, expiraEm: Date.now() + VALIDADE_S * 1000 });
}

/** True quando a sessão está sendo cifrada. Só para diagnóstico. */
function cifrando() {
  return Boolean((process.env.MOODLE_SESSION_SECRET ?? '').trim());
}

const opcoesCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: VALIDADE_S,
};

module.exports = { COOKIE, VALIDADE_S, criaToken, decifra, opcoesCookie, cifrando };
