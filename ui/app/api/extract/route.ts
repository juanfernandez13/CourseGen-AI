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
import { discardBlobs, downloadToTmp, isRemoteFile, type RemoteFile } from '../../../server/blobStore';
import { listQuizFiles } from '../../../server/taskFileMapper';

export const runtime = 'nodejs';
// Vercel Hobby with Fluid Compute supports up to 300 seconds.
export const maxDuration = 300;

function getApiKey(req: NextRequest): string | null {
  return req.headers.get('x-gemini-key')?.trim() || process.env.GEMINI_KEY?.trim() || null;
}

function assertDocx(name: string) {
  if (!name.toLowerCase().endsWith('.docx')) {
    throw new Error(`${name}: apenas arquivos .docx são suportados para extração.`);
  }
}

async function persistUpload(file: File, prefix: string): Promise<string> {
  assertDocx(file.name);
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(os.tmpdir(), `${prefix}_${crypto.randomUUID()}_${safeName}`);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
  return filePath;
}

type QuizEntry = { filePath: string; filename: string };

type Inputs = {
  matrizPath: string | null;
  quizzes: QuizEntry[];
  /** URLs a apagar do storage depois do processamento. */
  blobUrls: string[];
};

/**
 * Uploads chegam como URLs do Blob (Vercel) ou como o arquivo em si (local).
 *
 * `assumirBlobs` é chamado assim que as URLs são conhecidas, antes de validar ou
 * baixar. Sem isso, uma falha aqui deixaria os blobs órfãos no storage: o
 * `finally` da rota só apaga o que já tiver sido registrado.
 */
async function collectInputs(
  req: NextRequest,
  assumirBlobs: (urls: string[]) => void,
): Promise<Inputs> {
  const isJson = req.headers.get('content-type')?.includes('application/json');
  if (!isJson) return collectFromFormData(req);

  const body = await req.json();
  const matriz = isRemoteFile(body?.matriz) ? (body.matriz as RemoteFile) : null;
  const quizzes = Array.isArray(body?.quizzes) ? body.quizzes.filter(isRemoteFile) : [];

  const blobUrls = [...(matriz ? [matriz.url] : []), ...quizzes.map((q: RemoteFile) => q.url)];
  assumirBlobs(blobUrls);

  if (matriz) assertDocx(matriz.name);
  for (const quiz of quizzes) assertDocx(quiz.name);

  return {
    matrizPath: matriz ? await downloadToTmp(matriz, 'matriz') : null,
    quizzes: await Promise.all(quizzes.map(async (q: RemoteFile) => ({
      filePath: await downloadToTmp(q, 'quiz'),
      filename: q.name,
    }))),
    blobUrls,
  };
}

async function collectFromFormData(req: NextRequest): Promise<Inputs> {
  const formData = await req.formData();
  const matriz = formData.get('matriz');
  const quizzes = formData.getAll('quizzes').filter((entry): entry is File => entry instanceof File);

  return {
    matrizPath: matriz instanceof File ? await persistUpload(matriz, 'matriz') : null,
    quizzes: await Promise.all(quizzes.map(async quiz => ({
      filePath: await persistUpload(quiz, 'quiz'),
      filename: quiz.name,
    }))),
    blobUrls: [],
  };
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Configure a chave do Gemini nas configurações ou defina GEMINI_KEY no servidor.' },
      { status: 401 },
    );
  }

  let inputs: Inputs = { matrizPath: null, quizzes: [], blobUrls: [] };
  try {
    inputs = await collectInputs(req, urls => { inputs.blobUrls = urls; });
    const { matrizPath } = inputs;

    /* Número no nome ("Quiz 3", "Questionário 3") define a qual questionário o
     * arquivo pertence; sem número, vale a ordem natural do nome. Antes disso a
     * associação dependia da ordem de seleção no navegador.
     * Com matriz, um número = um quiz (o primeiro arquivo). Sem matriz — modo "só
     * questionários" — cada arquivo é um questionário. */
    const quizEntries = listQuizFiles(inputs.quizzes, { umPorNumero: !!matrizPath });
    const numerosQuiz = quizEntries.map(q => q.numero);
    const quizPaths = quizEntries.map(q => q.file.filePath);

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
      // extractedQuizzes[i] corresponde a numerosQuiz[i].
      const porNumero = new Map(numerosQuiz.map((n, i) => [n, extractedQuizzes[i]]));
      let quizIndex = 0;
      const aulas = Array.isArray(data.aulas) ? data.aulas as Array<Record<string, unknown>> : [];
      for (const aula of aulas) {
        if (aula.quiz) {
          quizIndex++;
          const extraido = porNumero.get(quizIndex);
          if (extraido) (aula.quiz as Record<string, unknown>).questoes = extraido.questoes || [];
        }
      }
    }

    /* Sem matriz, o modo "só questionários" precisa saber a que arquivo e a que
     * número cada resultado pertence: `arquivos[i]` descreve `quizzes[i]`. */
    const arquivos = quizEntries.map(q => ({ numero: q.numero, nome: q.file.filename }));
    return NextResponse.json(data ? { data } : { quizzes: extractedQuizzes, arquivos });
  } catch (error: unknown) {
    console.error('Falha na extração com Gemini:', error);
    const rawMessage = error instanceof Error ? error.message : '';
    const message = rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')
      ? 'O limite de uso do Gemini foi atingido. Tente novamente mais tarde.'
      : rawMessage.includes('504') || rawMessage.includes('DEADLINE_EXCEEDED')
      ? 'O Gemini demorou demais para responder. Tente de novo; se continuar, envie menos arquivos de cada vez.'
      : rawMessage.includes('503') || rawMessage.includes('UNAVAILABLE')
      ? 'O Gemini está sobrecarregado agora. Tentamos mais de uma vez e mais de um modelo; aguarde alguns minutos e tente de novo.'
      : rawMessage.includes('API key') || rawMessage.includes('401') || rawMessage.includes('403')
        ? 'A chave do Gemini é inválida ou não tem permissão para usar o modelo.'
        : rawMessage.includes('.docx') || rawMessage.includes('storage')
          ? rawMessage
          : 'Não foi possível extrair os documentos com o Gemini.';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    for (const filePath of [inputs.matrizPath, ...inputs.quizzes.map(q => q.filePath)]) {
      if (filePath) fs.rmSync(filePath, { force: true });
    }
    await discardBlobs(inputs.blobUrls);
  }
}
