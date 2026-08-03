import { cookies } from 'next/headers';
import { Sessao } from '../../server/moodle/http';
import { COOKIE, decifra } from '../../server/moodle/auth';

export const MOODLE_URL = process.env.MOODLE_URL ?? 'https://ead.ifce.edu.br/';

export type Autenticado = { sessao: Sessao; usuario: string; nome: string };

/* Reconstrói a sessão do Moodle a partir do cookie httpOnly.
 *
 * O cookie guarda o MoodleSession cifrado; nada aqui volta a pedir senha. Se o
 * token estiver ausente, vencido ou adulterado, devolve null e a rota responde
 * 401 — a tela então mostra o login de novo. */
export async function sessaoDoCookie(): Promise<Autenticado | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const dados = decifra(token);
  if (!dados) return null;

  return {
    sessao: new Sessao(MOODLE_URL, { cookies: dados.cookies }),
    usuario: dados.usuario,
    nome: dados.nome,
  };
}

export function naoAutenticado() {
  return Response.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 });
}
