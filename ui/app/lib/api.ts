const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function extractJson(matrizFile: File, quizFiles: File[] = []): Promise<object> {
  const formData = new FormData();
  formData.append('matriz', matrizFile);
  for (const f of quizFiles) formData.append('quizzes', f);

  const res = await fetch(`${API}/preview`, {
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

  const body = await res.json();

  if (!body.success) {
    throw new Error(body.error || 'Falha ao extrair dados da matriz.');
  }

  return body.data as object;
}

export async function generateMbz(
  matrizJson: string,
  quizFiles: File[],
  tarefaFiles: File[]
): Promise<void> {
  const formData = new FormData();
  formData.append('matrizJson', matrizJson);

  for (const file of quizFiles) {
    formData.append('quizzes', file);
  }

  for (const file of tarefaFiles) {
    formData.append('tarefas', file);
  }

  const res = await fetch(`${API}/generate`, {
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

  // Try to get filename from Content-Disposition header
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
