'use client';

import { useEffect, useState } from 'react';
import {
  putFile, removeFile, listMeta, hydrateFiles, clearAll, FileKind,
} from './fileStore';

type Persisted = { file: File; id: string };

export type PersistedFiles = {
  hydrated:    boolean;
  matrizFile:  File | null;
  quizFiles:   File[];
  tarefaFiles: File[];
  setMatrizFile:  (file: File | null) => Promise<void>;
  setQuizFiles:   (files: File[]) => Promise<void>;
  setTarefaFiles: (files: File[]) => Promise<void>;
  clearAllFiles:  () => Promise<void>;
};

export function usePersistedFiles(): PersistedFiles {
  const [matriz,   setMatriz]   = useState<Persisted | null>(null);
  const [quizzes,  setQuizzes]  = useState<Persisted[]>([]);
  const [tarefas,  setTarefas]  = useState<Persisted[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      const matrizPersisted = await hydrateFiles(listMeta('matriz'));
      const quizPersisted   = await hydrateFiles(listMeta('quiz'));
      const tarefaPersisted = await hydrateFiles(listMeta('tarefa'));

      // Matriz: keep only the latest entry; clean up any older orphans.
      const latest = matrizPersisted[matrizPersisted.length - 1] ?? null;
      for (let i = 0; i < matrizPersisted.length - 1; i++) {
        await removeFile(matrizPersisted[i].meta.id);
      }

      if (latest) setMatriz({ file: latest.file, id: latest.meta.id });
      setQuizzes(quizPersisted.map(x => ({ file: x.file, id: x.meta.id })));
      setTarefas(tarefaPersisted.map(x => ({ file: x.file, id: x.meta.id })));
      setHydrated(true);
    })().catch(() => setHydrated(true));
  }, []);

  async function setMatrizFile(file: File | null): Promise<void> {
    if (matriz) await removeFile(matriz.id);
    if (!file) {
      setMatriz(null);
      return;
    }
    const meta = await putFile(file, 'matriz');
    setMatriz({ file, id: meta.id });
  }

  async function syncList(
    kind: FileKind,
    current: Persisted[],
    next: File[],
  ): Promise<Persisted[]> {
    const nextSet = new Set(next);
    for (const p of current) {
      if (!nextSet.has(p.file)) await removeFile(p.id);
    }
    const result: Persisted[] = [];
    for (const f of next) {
      const existing = current.find(p => p.file === f);
      if (existing) {
        result.push(existing);
      } else {
        const meta = await putFile(f, kind);
        result.push({ file: f, id: meta.id });
      }
    }
    return result;
  }

  async function setQuizFiles(next: File[]): Promise<void> {
    setQuizzes(await syncList('quiz', quizzes, next));
  }

  async function setTarefaFiles(next: File[]): Promise<void> {
    setTarefas(await syncList('tarefa', tarefas, next));
  }

  async function clearAllFiles(): Promise<void> {
    await clearAll();
    setMatriz(null);
    setQuizzes([]);
    setTarefas([]);
  }

  return {
    hydrated,
    matrizFile:  matriz?.file ?? null,
    quizFiles:   quizzes.map(p => p.file),
    tarefaFiles: tarefas.map(p => p.file),
    setMatrizFile,
    setQuizFiles,
    setTarefaFiles,
    clearAllFiles,
  };
}
