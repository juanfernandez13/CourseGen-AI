import { NextRequest, NextResponse } from 'next/server';
import { montarCsvPorCurso } from '../../../../server/alunos';

export const runtime = 'nodejs';

/* Registros revisados → um CSV por curso.
 *
 * Devolve JSON com todos os arquivos em vez de um download direto: a geração é
 * múltipla e o usuário escolhe o que baixar na tela seguinte. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const alunos = Array.isArray(body?.alunos) ? body.alunos : null;
    const cursos = Array.isArray(body?.cursos) ? body.cursos : [];

    if (!alunos?.length) {
      return NextResponse.json({ error: 'Nenhum aluno para exportar.' }, { status: 400 });
    }

    const base = String(body?.base ?? 'alunos').replace(/[^a-zA-Z0-9._-]/g, '_');
    const arquivos = montarCsvPorCurso(alunos, cursos, base);

    if (!arquivos.length) {
      return NextResponse.json(
        { error: 'Informe ao menos um curso para gerar os arquivos.' },
        { status: 400 },
      );
    }

    return NextResponse.json({ arquivos });
  } catch (error: unknown) {
    console.error('Falha ao montar os CSVs de alunos:', error);
    return NextResponse.json({ error: 'Não foi possível gerar os CSVs.' }, { status: 500 });
  }
}
