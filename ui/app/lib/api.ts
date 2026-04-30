import { authHeaders, getGeminiKey } from './apiKeys';
import {
  extractMatrizFromFile,
  extractAllQuizzes as extractAllQuizzesClient,
  type QuizExtraction,
} from './extractor.client';

export async function checkServerHealth(): Promise<{ serverFallbackAvailable: boolean }> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return { serverFallbackAvailable: false };
    return await res.json();
  } catch {
    return { serverFallbackAvailable: false };
  }
}

function requireApiKey(): string {
  const key = getGeminiKey();
  if (!key) {
    throw new Error('Configure sua chave do Gemini em ⚙ Configurações antes de continuar.');
  }
  return key;
}

export async function extractJson(matrizFile: File, quizFiles: File[] = []): Promise<object> {
  const apiKey = requireApiKey();

  const matrizData = await extractMatrizFromFile(matrizFile, apiKey) as {
    aulas?: Array<{ quiz?: { questoes?: unknown[] } & Record<string, unknown> }>;
    [k: string]: unknown;
  };

  if (quizFiles.length > 0) {
    try {
      const allQuizzes = await extractAllQuizzesClient(quizFiles, apiKey);
      let quizIdx = 0;
      for (const aula of matrizData.aulas || []) {
        if (aula.quiz && quizIdx < allQuizzes.length) {
          aula.quiz.questoes = allQuizzes[quizIdx].questoes || [];
          quizIdx++;
        }
      }
    } catch (e: unknown) {
      console.warn(`Erro ao processar quizzes: ${e instanceof Error ? e.message : e}`);
    }
  }

  return matrizData;
}

export async function extractQuizzes(quizFiles: File[]): Promise<QuizExtraction[]> {
  if (quizFiles.length === 0) return [];
  const apiKey = requireApiKey();
  return extractAllQuizzesClient(quizFiles, apiKey);
}

export async function generateMbz(
  matrizJson: string,
  _quizFiles: File[],
  tarefaFiles: File[]
): Promise<void> {
  const formData = new FormData();
  formData.append('matrizJson', matrizJson);

  for (const file of tarefaFiles) {
    formData.append('tarefas', file);
  }

  const res = await fetch(`/api/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    let message = `Erro ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;

  const disposition = res.headers.get('content-disposition');
  let filename = 'curso.mbz';
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, '');
    }
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
