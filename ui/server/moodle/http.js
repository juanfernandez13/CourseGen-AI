'use strict';

/* Camada HTTP contra o Moodle.
 *
 * Não usamos navegador: o que a tela de edição de atividade faz é um POST de
 * formulário, e o formulário inteiro cabe num fetch. Isso é o que torna esta
 * funcionalidade viável em serverless — Chromium não caberia no tempo nem no
 * tamanho de uma Vercel Function.
 *
 * Os redirects são seguidos na mão porque o fetch nativo não expõe os
 * Set-Cookie dos saltos intermediários, e é justamente no redirect do
 * /login/index.php que o Moodle troca o MoodleSession. */

const AGENTE =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* Guarda pares nome=valor. O Moodle só precisa do MoodleSession, então não há
 * motivo para tratar domínio/path/expiração com rigor de RFC. */
class PoteDeCookies {
  constructor(serializado = '') {
    this.cookies = new Map();
    for (const par of serializado.split('; ').filter(Boolean)) {
      const corte = par.indexOf('=');
      if (corte > 0) this.cookies.set(par.slice(0, corte), par.slice(corte + 1));
    }
  }

  absorve(resposta) {
    for (const cabecalho of resposta.headers.getSetCookie?.() ?? []) {
      const [par] = cabecalho.split(';');
      const corte = par.indexOf('=');
      if (corte === -1) continue;

      const nome = par.slice(0, corte).trim();
      const valor = par.slice(corte + 1).trim();

      // "deleted" é o marcador que o Moodle usa ao invalidar a sessão
      if (!valor || valor === 'deleted') this.cookies.delete(nome);
      else this.cookies.set(nome, valor);
    }
  }

  get header() {
    return [...this.cookies].map(([n, v]) => `${n}=${v}`).join('; ');
  }

  get vazio() {
    return this.cookies.size === 0;
  }
}

class Sessao {
  constructor(base, { cookies = '', atrasoMs = 120 } = {}) {
    if (!base) throw new Error('MOODLE_URL não configurada.');
    this.base = base.endsWith('/') ? base : `${base}/`;
    this.pote = new PoteDeCookies(cookies);
    this.atrasoMs = atrasoMs;
  }

  /** Cookies em texto, para guardar no cookie httpOnly da aplicação. */
  serializaCookies() {
    return this.pote.header;
  }

  url(caminho) {
    return new URL(caminho, this.base).toString();
  }

  async bruto(url, opcoes = {}) {
    const headers = { 'User-Agent': AGENTE, 'Accept-Language': 'pt-BR,pt;q=0.9', ...opcoes.headers };
    if (!this.pote.vazio) headers.Cookie = this.pote.header;

    const resposta = await fetch(url, { ...opcoes, headers, redirect: 'manual' });
    this.pote.absorve(resposta);
    return resposta;
  }

  async requisita(caminho, opcoes = {}, saltos = 10) {
    if (this.atrasoMs) await new Promise(r => setTimeout(r, this.atrasoMs));

    let url = caminho.startsWith('http') ? caminho : this.url(caminho);
    let atual = opcoes;

    for (let salto = 0; salto <= saltos; salto++) {
      const resposta = await this.bruto(url, atual);

      if (resposta.status < 300 || resposta.status > 399) {
        resposta.urlFinal = url;
        return resposta;
      }

      const destino = resposta.headers.get('location');
      if (!destino) {
        resposta.urlFinal = url;
        return resposta;
      }

      url = new URL(destino, url).toString();
      atual = { headers: opcoes.headers }; // redirect vira GET sem corpo
    }

    throw new Error(`Excesso de redirects em ${caminho}`);
  }

  async texto(caminho, opcoes) {
    const resposta = await this.requisita(caminho, opcoes);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${resposta.urlFinal}`);
    return resposta.text();
  }

  async postaForm(caminho, campos, opcoes = {}) {
    const corpo = new URLSearchParams();
    for (const [nome, valor] of campos) corpo.append(nome, valor);

    return this.requisita(caminho, {
      ...opcoes,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...opcoes.headers },
      body: corpo.toString(),
    });
  }
}

module.exports = { Sessao, PoteDeCookies };
