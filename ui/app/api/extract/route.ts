import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { processMatriz } from '../../../server/parser';
import {
  extractDataWithGemini,
  extractAllQuizzes,
} from '../../../server/extractor';

export const runtime = 'nodejs';
// Vercel Hobby with Fluid Compute supports up to 300 seconds.
export const maxDuration = 300;

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function getApiKey(req: NextRequest): string | null {
  return req.headers.get('x-gemini-key')?.trim() || process.env.GEMINI_KEY?.trim() || null;
}

function assertValidDoc(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name}: o limite é 20 MB por arquivo.`);
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error(`${file.name}: apenas arquivos .docx são suportados para extração.`);
  }
}

async function persistUpload(file: File, prefix: string): Promise<string> {
  assertValidDoc(file);
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(os.tmpdir(), `${prefix}_${crypto.randomUUID()}_${safeName}`);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
  return filePath;
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Configure a chave do Gemini nas configurações ou defina GEMINI_KEY no servidor.' },
      { status: 401 },
    );
  }

  const temporaryFiles: string[] = [];
  try {
    const formData = await req.formData();
    const matriz = formData.get('matriz');
    const quizzes = formData.getAll('quizzes').filter((entry): entry is File => entry instanceof File);

    let matrizPath: string | null = null;
    if (matriz instanceof File) {
      matrizPath = await persistUpload(matriz, 'matriz');
      temporaryFiles.push(matrizPath);
    }

    const quizPaths: string[] = [];
    for (const quiz of quizzes) {
      const quizPath = await persistUpload(quiz, 'quiz');
      temporaryFiles.push(quizPath);
      quizPaths.push(quizPath);
    }
    // Matriz e quizzes são independentes: execute as chamadas ao Gemini em paralelo.
    const matrizPromise: Promise<Record<string, unknown> | null> = matrizPath
      ? processMatriz(matrizPath).then(text => extractDataWithGemini(text, apiKey))
      : Promise.resolve(null);
    const quizzesPromise: Promise<Array<{ questoes?: unknown[] }>> = quizPaths.length
      ? extractAllQuizzes(quizPaths, apiKey)
      : Promise.resolve([]);

    const [matrizResult, quizzesResult] = await Promise.allSettled([
      matrizPromise,
      quizzesPromise,
    ]);

    if (matrizResult.status === 'rejected') throw matrizResult.reason;
    const data = matrizResult.value;
    let extractedQuizzes: Array<{ questoes?: unknown[] }> = [];
    if (quizzesResult.status === 'fulfilled') {
      extractedQuizzes = quizzesResult.value;
    } else if (!data) {
      throw quizzesResult.reason;
    } else {
      console.warn('A matriz foi extraída, mas os quizzes falharam:', quizzesResult.reason);
    }

    if (data) {
      let quizIndex = 0;
      const aulas = Array.isArray(data.aulas) ? data.aulas as Array<Record<string, unknown>> : [];
      for (const aula of aulas) {
        if (aula.quiz && quizIndex < extractedQuizzes.length) {
          (aula.quiz as Record<string, unknown>).questoes = extractedQuizzes[quizIndex]?.questoes || [];
          quizIndex++;
        }
      }
    }

    return NextResponse.json(data ? { data } : { quizzes: extractedQuizzes });
  } catch (error: unknown) {
    console.error('Falha na extração com Gemini:', error);
    const rawMessage = error instanceof Error ? error.message : '';
    const message = rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')
      ? 'O limite de uso do Gemini foi atingido. Tente novamente mais tarde.'
      : rawMessage.includes('API key') || rawMessage.includes('401') || rawMessage.includes('403')
        ? 'A chave do Gemini é inválida ou não tem permissão para usar o modelo.'
        : rawMessage.startsWith('Arquivo') || rawMessage.includes('20 MB') || rawMessage.includes('.docx')
          ? rawMessage
          : 'Não foi possível extrair os documentos com o Gemini.';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    for (const filePath of temporaryFiles) {
      fs.rmSync(filePath, { force: true });
    }
  }
}
