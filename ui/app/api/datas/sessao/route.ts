import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { Sessao } from '../../../../server/moodle/http';
import { login, sessaoViva } from '../../../../server/moodle/login';
import { COOKIE, criaToken, opcoesCookie, configurado } from '../../../../server/moodle/auth';
import { MOODLE_URL, sessaoDoCookie } from '../../../lib/moodleServer';

export const runtime = 'nodejs';

/* Autenticação da aba de datas.
 *
 * As credenciais entram uma vez, são usadas para abrir sessão no Moodle e são
 * descartadas: o que fica guardado é o cookie de sessão do Moodle, cifrado
 * dentro de um cookie httpOnly desta aplicação. Nem o JavaScript da página nem
 * o dono do navegador conseguem lê-lo. */

/** Situação atual — a tela usa para decidir entre login e formulário. */
export async function GET() {
  // avisa já na abertura da tela, em vez de esperar o usuário tentar entrar
  const config = configurado();
  if (!config.ok) {
    return NextResponse.json({ autenticado: false, configuracao: config.motivo });
  }

  const atual = await sessaoDoCookie();
  if (!atual) return NextResponse.json({ autenticado: false });

  // o cookie pode estar válido para nós e já ter caído no Moodle
  const viva = await sessaoViva(atual.sessao).catch(() => false);
  if (!viva) {
    (await cookies()).delete(COOKIE);
    return NextResponse.json({ autenticado: false });
  }

  return NextResponse.json({ autenticado: true, usuario: atual.usuario, nome: atual.nome });
}

export async function POST(req: NextRequest) {
  try {
    /* Antes de qualquer coisa: sem chave de cifra não há como guardar a sessão.
     * Checar aqui evita autenticar no Moodle — gastando um login de verdade —
     * para só então falhar ao gravar o cookie, com um erro que o usuário leria
     * como problema de senha. */
    const config = configurado();
    if (!config.ok) {
      console.error('[moodle] configuração ausente:', config.motivo);
      return NextResponse.json({ error: config.motivo, configuracao: true }, { status: 503 });
    }

    const { usuario, senha } = await req.json();

    if (!usuario || !senha) {
      return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 });
    }

    const sessao = new Sessao(MOODLE_URL);
    const { nome } = await login(sessao, { usuario, senha });

    (await cookies()).set(
      COOKIE,
      criaToken({ cookies: sessao.serializaCookies(), usuario, nome }),
      opcoesCookie,
    );

    return NextResponse.json({ autenticado: true, usuario, nome });
  } catch (error: unknown) {
    const mensagem = error instanceof Error ? error.message : 'Não foi possível entrar.';
    // credencial errada é 401; o resto (Moodle fora do ar, rede) é 502
    const credencial = /inválid|usuário|senha/i.test(mensagem);

    if (!credencial) console.error('Falha ao autenticar no Moodle:', error);
    return NextResponse.json({ error: mensagem }, { status: credencial ? 401 : 502 });
  }
}

export async function DELETE() {
  (await cookies()).delete(COOKIE);
  return NextResponse.json({ autenticado: false });
}
