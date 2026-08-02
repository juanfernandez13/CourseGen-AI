import { authHeaders } from './apiKeys';
import { blobUploadsAvailable, uploadToBlob } from './uploads';

export type QuizExtraction = { questoes: Array<Record<string, unknown>> };

export async function checkServerHealth(): Promise<{ serverFallbackAvailable: boolean }> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return { serverFallbackAvailable: false };
    return await res.json();
  } catch {
    return { serverFallbackAvailable: false };
  }
}

export async function extractJson(matrizFile: File, quizFiles: File[] = []): Promise<object> {
  const body = await postExtraction(matrizFile, quizFiles);
  return body.data as object;
}

export async function extractQuizzes(quizFiles: File[]): Promise<QuizExtraction[]> {
  if (quizFiles.length === 0) return [];
  const body = await postExtraction(null, quizFiles);
  return (body.quizzes || []) as QuizExtraction[];
}

async function postExtraction(
  matrizFile: File | null,
  quizFiles: File[],
): Promise<Record<string, unknown>> {
  const res = (await blobUploadsAvailable())
    ? await postExtractionViaBlob(matrizFile, quizFiles)
    : await postExtractionDirect(matrizFile, quizFiles);

  if (!res.ok) throw new Error(await readError(res));
  return await res.json();
}

/** Vercel: os arquivos já estão no Blob, a rota recebe só as URLs. */
async function postExtractionViaBlob(matrizFile: File | null, quizFiles: File[]): Promise<Response> {
  const [matriz] = matrizFile ? await uploadToBlob([matrizFile], 'matriz') : [null];
  const quizzes = quizFiles.length ? await uploadToBlob(quizFiles, 'quiz') : [];

  return fetch('/api/extract', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ matriz, quizzes }),
  });
}

/** Local: sem store conectado e sem limite de corpo, envia os arquivos direto. */
async function postExtractionDirect(matrizFile: File | null, quizFiles: File[]): Promise<Response> {
  const formData = new FormData();
  if (matrizFile) formData.append('matriz', matrizFile);
  for (const file of quizFiles) formData.append('quizzes', file);

  return fetch('/api/extract', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
}

export async function generateMbz(
  matrizJson: string,
  _quizFiles: File[],
  tarefaFiles: File[]
): Promise<void> {
  const res = (await blobUploadsAvailable())
    ? await postGenerateViaBlob(matrizJson, tarefaFiles)
    : await postGenerateDirect(matrizJson, tarefaFiles);

  if (!res.ok) throw new Error(await readError(res));

  await downloadResponse(res);
}

async function postGenerateViaBlob(matrizJson: string, tarefaFiles: File[]): Promise<Response> {
  const tarefas = tarefaFiles.length ? await uploadToBlob(tarefaFiles, 'tarefa') : [];

  return fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matrizJson, tarefas }),
  });
}

async function postGenerateDirect(matrizJson: string, tarefaFiles: File[]): Promise<Response> {
  const formData = new FormData();
  formData.append('matrizJson', matrizJson);
  for (const file of tarefaFiles) formData.append('tarefas', file);

  return fetch('/api/generate', { method: 'POST', body: formData });
}

async function readError(res: Response): Promise<string> {
  let message = `Erro ${res.status}: ${res.statusText}`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
    else if (body?.message) message = body.message;
  } catch { /* resposta sem JSON */ }
  return message;
}

async function downloadResponse(res: Response): Promise<void> {
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
