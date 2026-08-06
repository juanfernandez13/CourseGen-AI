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

const MINIMO_SEGREDO = 16;

const FALTA_SEGREDO =
  'MOODLE_SESSION_SECRET não está configurada no servidor. '
  + 'Defina essa variável de ambiente (no painel da Vercel, em Settings → '
  + 'Environment Variables) com pelo menos 16 caracteres e faça um novo deploy. '
  + 'Sem ela a sessão do Moodle não pode ser cifrada.';

/**
 * Diz se dá para cifrar sessões, sem lançar. As rotas checam ANTES de pedir
 * qualquer coisa ao Moodle: se falhar só na hora de gravar o cookie, o usuário
 * já digitou a senha e já autenticou lá — gasta um login para receber um erro
 * que nada tem a ver com credencial.
 *
 * @returns {{ok: true} | {ok: false, motivo: string}}
 */
function configurado() {
  const segredo = (process.env.MOODLE_SESSION_SECRET ?? '').trim();

  if (process.env.NODE_ENV !== 'production') return { ok: true };
  if (!segredo) return { ok: false, motivo: FALTA_SEGREDO };

  if (segredo.length < MINIMO_SEGREDO) {
    return {
      ok: false,
      motivo: `MOODLE_SESSION_SECRET tem ${segredo.length} caracteres; use pelo menos ${MINIMO_SEGREDO}.`,
    };
  }
  return { ok: true };
}

let avisou = false;

function chave() {
  const segredo = process.env.MOODLE_SESSION_SECRET;
  if (segredo) return crypto.createHash('sha256').update(segredo).digest();

  if (process.env.NODE_ENV === 'production') throw new Error(FALTA_SEGREDO);

  /* Desenvolvimento sem segredo configurado.
   *
   * A chave é DERIVADA da máquina, não sorteada. Uma chave aleatória guardada
   * em variável de módulo parece mais segura e na prática quebra o login: o
   * Next recompila o grafo de módulos da rota editada, cada rota acaba com sua
   * própria instância deste arquivo, e o cookie cifrado por uma rota vira lixo
   * para a outra — 401 a cada hot reload, sem explicação visível.
   *
   * Isto não protege nada de verdade; é só para não trafegar a sessão do
   * Moodle em texto claro enquanto se desenvolve. Em produção o caminho acima
   * é obrigatório. */
  if (!avisou) {
    console.warn('[moodle] MOODLE_SESSION_SECRET ausente; usando chave derivada de desenvolvimento.');
    avisou = true;
  }

  return crypto
    .createHash('sha256')
    .update(`coursegen-dev:${require('os').hostname()}:${process.cwd()}`)
    .digest();
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

module.exports = { COOKIE, VALIDADE_S, criaToken, decifra, opcoesCookie, configurado, FALTA_SEGREDO };
