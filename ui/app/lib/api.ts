import { authHeaders } from './apiKeys';

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
  const formData = new FormData();
  formData.append('matriz', matrizFile);
  for (const file of quizFiles) formData.append('quizzes', file);

  const body = await postExtraction(formData);
  return body.data as object;
}

export async function extractQuizzes(quizFiles: File[]): Promise<QuizExtraction[]> {
  if (quizFiles.length === 0) return [];
  const formData = new FormData();
  for (const file of quizFiles) formData.append('quizzes', file);
  const body = await postExtraction(formData);
  return (body.quizzes || []) as QuizExtraction[];
}

async function postExtraction(formData: FormData): Promise<Record<string, unknown>> {
  const res = await fetch('/api/extract', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) {
    let message = `Erro ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* resposta sem JSON */ }
    throw new Error(message);
  }
  return await res.json();
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
