'use client';

import { useEffect, useRef, useState } from 'react';
import {
  putFile, removeFile, listMeta, hydrateFiles, clearAll, FileKind,
} from './fileStore';

type Persisted = { file: File; id: string };

/** Aceita a lista pronta ou uma função sobre a lista atual, como os setters do
 * React. A forma de função é a correta para remover: ela resolve contra o
 * estado mais recente, não contra o que o componente viu no último render. */
export type FilesUpdater = File[] | ((prev: File[]) => File[]);

export type PersistedFiles = {
  hydrated:    boolean;
  matrizFile:  File | null;
  quizFiles:   File[];
  tarefaFiles: File[];
  setMatrizFile:  (file: File | null) => Promise<void>;
  setQuizFiles:   (next: FilesUpdater) => Promise<void>;
  setTarefaFiles: (next: FilesUpdater) => Promise<void>;
  clearAllFiles:  () => Promise<void>;
};

export function usePersistedFiles(): PersistedFiles {
  const [matriz,   setMatriz]   = useState<Persisted | null>(null);
  const [quizzes,  setQuizzes]  = useState<Persisted[]>([]);
  const [tarefas,  setTarefas]  = useState<Persisted[]>([]);
  const [hydrated, setHydrated] = useState(false);

  /* Espelho síncrono do estado. As gravações no IndexedDB são assíncronas: sem
   * isto, dois cliques seguidos no × resolvem a lista contra o render antigo e
   * o arquivo removido no primeiro clique reaparece. */
  const matrizRef  = useRef<Persisted | null>(null);
  const quizzesRef = useRef<Persisted[]>([]);
  const tarefasRef = useRef<Persisted[]>([]);

  /* Serializa as operações para que duas chamadas não se intercalem no meio de
   * um await e gravem entradas duplicadas. */
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  function enqueue(task: () => Promise<void>): Promise<void> {
    // Encadeia nos dois lados para que uma falha não trave a fila.
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  }

  function commitMatriz(next: Persisted | null) {
    matrizRef.current = next;
    setMatriz(next);
  }
  function commitQuizzes(next: Persisted[]) {
    quizzesRef.current = next;
    setQuizzes(next);
  }
  function commitTarefas(next: Persisted[]) {
    tarefasRef.current = next;
    setTarefas(next);
  }

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

      if (latest) commitMatriz({ file: latest.file, id: latest.meta.id });
      commitQuizzes(quizPersisted.map(x => ({ file: x.file, id: x.meta.id })));
      commitTarefas(tarefaPersisted.map(x => ({ file: x.file, id: x.meta.id })));
      setHydrated(true);
    })().catch(() => setHydrated(true));
  }, []);

  function resolveFiles(next: FilesUpdater, current: Persisted[]): File[] {
    return typeof next === 'function' ? next(current.map(p => p.file)) : next;
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

  function setMatrizFile(file: File | null): Promise<void> {
    return enqueue(async () => {
      const current = matrizRef.current;
      if (current) await removeFile(current.id);
      if (!file) {
        commitMatriz(null);
        return;
      }
      const meta = await putFile(file, 'matriz');
      commitMatriz({ file, id: meta.id });
    });
  }

  function setQuizFiles(next: FilesUpdater): Promise<void> {
    return enqueue(async () => {
      const current = quizzesRef.current;
      commitQuizzes(await syncList('quiz', current, resolveFiles(next, current)));
    });
  }

  function setTarefaFiles(next: FilesUpdater): Promise<void> {
    return enqueue(async () => {
      const current = tarefasRef.current;
      commitTarefas(await syncList('tarefa', current, resolveFiles(next, current)));
    });
  }

  function clearAllFiles(): Promise<void> {
    return enqueue(async () => {
      await clearAll();
      commitMatriz(null);
      commitQuizzes([]);
      commitTarefas([]);
    });
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
