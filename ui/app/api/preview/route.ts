import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { processMatriz } from '../../../server/parser';
import { extractDataWithGemini, extractAllQuizzes } from '../../../server/extractor';

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-gemini-key')?.trim() || process.env.GEMINI_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Nenhuma chave do Gemini disponível. Configure em ⚙ Configurações ou no .env do servidor.' },
      { status: 401 },
    );
  }

  const formData = await req.formData();

  const matrizFile = formData.get('matriz') as File | null;
  if (!matrizFile) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
  }

  const quizEntries = formData.getAll('quizzes') as File[];
  const quizFiles = quizEntries.sort((a, b) => {
    const na = parseInt((a.name.match(/(\d+)/) || ['0', '0'])[1]);
    const nb = parseInt((b.name.match(/(\d+)/) || ['0', '0'])[1]);
    return na - nb;
  });

  const tmpDir = os.tmpdir();
  const matrizTmpPath = path.join(tmpDir, `matriz_${Date.now()}_${matrizFile.name}`);
  const quizTmpPaths: string[] = [];

  try {
    fs.writeFileSync(matrizTmpPath, Buffer.from(await matrizFile.arrayBuffer()));

    for (const qf of quizFiles) {
      const qPath = path.join(tmpDir, `quiz_${Date.now()}_${qf.name}`);
      fs.writeFileSync(qPath, Buffer.from(await qf.arrayBuffer()));
      quizTmpPaths.push(qPath);
    }

    const fullText = await processMatriz(matrizTmpPath);
    const matrizData = await extractDataWithGemini(fullText, apiKey);

    if (quizTmpPaths.length > 0) {
      try {
        const allQuizzes = await extractAllQuizzes(quizTmpPaths, apiKey);
        let quizIdx = 0;
        for (const aula of (matrizData.aulas || [])) {
          if (aula.quiz && quizIdx < allQuizzes.length) {
            aula.quiz.questoes = allQuizzes[quizIdx].questoes || [];
            quizIdx++;
          }
        }
      } catch (e: unknown) {
        console.warn(`  Erro ao processar quizzes: ${e instanceof Error ? e.message : e}`);
      }
    }

    return NextResponse.json({ success: true, data: matrizData });
  } finally {
    fs.unlink(matrizTmpPath, () => {});
    for (const p of quizTmpPaths) fs.unlink(p, () => {});
  }
}
