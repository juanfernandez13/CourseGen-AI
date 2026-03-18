import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { extractAllQuizzes } from '../../../server/extractor';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_KEY não configurada no .env' }, { status: 500 });
  }

  const formData = await req.formData();
  const quizEntries = formData.getAll('quizzes') as File[];
  if (quizEntries.length === 0) {
    return NextResponse.json({ quizzes: [] });
  }

  const quizFiles = quizEntries.sort((a, b) => {
    const na = parseInt((a.name.match(/(\d+)/) || ['0', '0'])[1]);
    const nb = parseInt((b.name.match(/(\d+)/) || ['0', '0'])[1]);
    return na - nb;
  });

  const tmpDir = os.tmpdir();
  const quizTmpPaths: string[] = [];

  try {
    for (const qf of quizFiles) {
      const qPath = path.join(tmpDir, `quiz_${Date.now()}_${qf.name}`);
      fs.writeFileSync(qPath, Buffer.from(await qf.arrayBuffer()));
      quizTmpPaths.push(qPath);
    }

    const quizzes = await extractAllQuizzes(quizTmpPaths, apiKey);
    return NextResponse.json({ quizzes });
  } finally {
    for (const p of quizTmpPaths) fs.unlink(p, () => {});
  }
}
