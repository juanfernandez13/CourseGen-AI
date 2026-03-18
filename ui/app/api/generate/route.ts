import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateMBZ } from '../../../server/mbzGenerator';
import { extractAllQuizzes } from '../../../server/extractor';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_KEY;

  const formData = await req.formData();

  const matrizJsonRaw = formData.get('matrizJson') as string | null;
  if (!matrizJsonRaw) {
    return NextResponse.json({ error: 'matrizJson não enviado.' }, { status: 400 });
  }

  let matrizData: Record<string, unknown>;
  try {
    matrizData = JSON.parse(matrizJsonRaw);
  } catch (e: unknown) {
    return NextResponse.json({ error: `JSON inválido: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }

  const quizEntries = formData.getAll('quizzes') as File[];
  const quizFiles = quizEntries.sort((a, b) => {
    const na = parseInt((a.name.match(/(\d+)/) || ['0', '0'])[1]);
    const nb = parseInt((b.name.match(/(\d+)/) || ['0', '0'])[1]);
    return na - nb;
  });

  const tarefaEntries = formData.getAll('tarefas') as File[];

  const tmpDir = os.tmpdir();
  const quizTmpPaths: string[] = [];
  const tarefaTmpPaths: { filePath: string; filename: string }[] = [];
  let mbzPath: string | null = null;

  try {
    for (const qf of quizFiles) {
      const qPath = path.join(tmpDir, `quiz_${Date.now()}_${qf.name}`);
      fs.writeFileSync(qPath, Buffer.from(await qf.arrayBuffer()));
      quizTmpPaths.push(qPath);
    }

    for (const tf of tarefaEntries) {
      const tPath = path.join(tmpDir, `tarefa_${Date.now()}_${tf.name}`);
      fs.writeFileSync(tPath, Buffer.from(await tf.arrayBuffer()));
      tarefaTmpPaths.push({ filePath: tPath, filename: tf.name });
    }

    if (quizTmpPaths.length > 0) {
      try {
        const allQuizzes = await extractAllQuizzes(quizTmpPaths, apiKey);
        let quizIdx = 0;
        const aulas = (matrizData.aulas as Array<Record<string, unknown>>) || [];
        for (const aula of aulas) {
          if (aula.quiz && quizIdx < allQuizzes.length) {
            (aula.quiz as Record<string, unknown>).questoes = allQuizzes[quizIdx].questoes || [];
            quizIdx++;
          }
        }
      } catch (e: unknown) {
        console.warn(`  Erro ao processar quizzes: ${e instanceof Error ? e.message : e}`);
      }
    }

    const tarefaFilesMap: Record<number, { filePath: string; filename: string }[]> = {};
    for (const tf of tarefaTmpPaths) {
      const match = tf.filename.match(/tarefa[_-]?(\d+)/i);
      if (match) {
        const num = parseInt(match[1]);
        if (!tarefaFilesMap[num]) tarefaFilesMap[num] = [];
        tarefaFilesMap[num].push(tf);
      }
    }
    let tarefaCounter = 0;
    for (const aula of (matrizData.aulas as Array<Record<string, unknown>>) || []) {
      if (aula.tarefa) {
        tarefaCounter++;
        if (tarefaFilesMap[tarefaCounter]) {
          (aula.tarefa as Record<string, unknown>).arquivos = tarefaFilesMap[tarefaCounter];
        }
      }
    }

    mbzPath = await generateMBZ(matrizData);
    const filename = `curso_${(matrizData.disciplina as Record<string, unknown>)?.codigo || 'moodle'}.mbz`;
    const mbzBuffer = fs.readFileSync(mbzPath);

    return new Response(mbzBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } finally {
    for (const p of quizTmpPaths) fs.unlink(p, () => {});
    for (const tf of tarefaTmpPaths) fs.unlink(tf.filePath, () => {});
    if (mbzPath) fs.unlink(mbzPath, () => {});
  }
}
