import { NextRequest, NextResponse } from 'next/server';
import { executa } from '../../../../server/moodle';
import { sessaoDoCookie, naoAutenticado } from '../../../lib/moodleServer';

export const runtime = 'nodejs';
export const maxDuration = 300;

/* Simula ou aplica as datas de UMA turma.
 *
 * Uma turma por requisição de propósito: a tela percorre a lista chamando esta
 * rota por vez. Assim cada execução cabe no limite de duração da função, o
 * usuário vê progresso turma a turma, e uma falha isolada não derruba o lote.
 *
 * As linhas chegam com as datas já resolvidas por aula. A cadência é calculada
 * na tela — se ela também vivesse aqui, seriam duas cópias da mesma regra
 * podendo divergir. */
export async function POST(req: NextRequest) {
  const atual = await sessaoDoCookie();
  if (!atual) return naoAutenticado();

  try {
    const body = await req.json();
    const curso = body?.curso;
    const linhas = Array.isArray(body?.linhas) ? body.linhas : [];
    const simular = body?.simular !== false; // só aplica quando pedido explicitamente

    if (!curso) {
      return NextResponse.json({ error: 'Informe a turma.' }, { status: 400 });
    }
    if (!linhas.length) {
      return NextResponse.json({ error: 'Nenhuma aula selecionada.' }, { status: 400 });
    }

    const invalida = linhas.find(
      (l: { aula: number; inicio?: string; fim?: string }) =>
        !Number.isInteger(l?.aula) || (!l?.inicio && !l?.fim),
    );
    if (invalida) {
      return NextResponse.json(
        { error: 'Cada aula precisa de um número e ao menos uma data.' },
        { status: 400 },
      );
    }

    const relatorio = await executa(atual.sessao, { cursos: [curso], linhas, simular });
    return NextResponse.json({ relatorio, simulado: simular });
  } catch (error: unknown) {
    console.error('Falha ao aplicar as datas:', error);
    const mensagem = error instanceof Error ? error.message : 'Não foi possível aplicar as datas.';
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
