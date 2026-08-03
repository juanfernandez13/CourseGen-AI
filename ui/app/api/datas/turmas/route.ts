import { NextRequest, NextResponse } from 'next/server';
import { lerTurma } from '../../../../server/moodle';
import { sessaoDoCookie, naoAutenticado } from '../../../lib/moodleServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* Estrutura das turmas: aulas (seções) e as atividades de cada uma.
 *
 * A tela precisa disso antes de montar as linhas de data — é o que mostra ao
 * usuário quantas aulas existem e o que será atingido pelo range. */
export async function POST(req: NextRequest) {
  const atual = await sessaoDoCookie();
  if (!atual) return naoAutenticado();

  try {
    const body = await req.json();
    const cursos: string[] = Array.isArray(body?.cursos) ? body.cursos : [];

    if (!cursos.length) {
      return NextResponse.json({ error: 'Informe ao menos um id de turma.' }, { status: 400 });
    }

    const turmas = [];
    for (const cursoId of cursos.slice(0, 40)) {
      try {
        turmas.push(await lerTurma(atual.sessao, cursoId));
      } catch (error: unknown) {
        turmas.push({
          cursoId,
          nome: '',
          secoes: [],
          erro: error instanceof Error ? error.message : 'Não foi possível ler a turma.',
        });
      }
    }

    return NextResponse.json({ turmas });
  } catch (error: unknown) {
    console.error('Falha ao ler as turmas:', error);
    return NextResponse.json({ error: 'Não foi possível ler as turmas.' }, { status: 500 });
  }
}
