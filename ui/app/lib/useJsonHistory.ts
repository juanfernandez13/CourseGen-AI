'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'ifce-json-history';
const MAX_VERSIONS = 20;

export type JsonVersion = {
  id: string;
  json: string;
  label: string;
  timestamp: number;
};

function loadVersions(): JsonVersion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Grava o que couber e devolve exatamente o que ficou salvo.
 *
 * A versão anterior engolia o erro de cota: quando a escrita falhava, o
 * localStorage continuava com a lista antiga — incluindo a versão que o usuário
 * acabara de remover — enquanto a tela mostrava a lista nova. A remoção parecia
 * ter funcionado e desfazia-se sozinha no recarregamento.
 */
function persistVersions(versions: JsonVersion[]): JsonVersion[] {
  let candidate = versions.slice(0, MAX_VERSIONS);

  while (candidate.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
      return candidate;
    } catch {
      // Cota estourada: descarta a versão mais antiga e tenta de novo.
      candidate = candidate.slice(0, -1);
    }
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* storage indisponível */ }
  return [];
}

export function useJsonHistory() {
  const [versions, setVersions] = useState<JsonVersion[]>([]);
  /* Espelho síncrono: as ações leem daqui em vez do closure do render, que pode
   * estar desatualizado quando dois cliques acontecem em sequência. */
  const versionsRef = useRef<JsonVersion[]>([]);

  /* Mantém tela e storage sempre iguais — o estado passa a ser o que de fato
   * foi gravado, nunca o que se pretendia gravar. */
  const commit = useCallback((next: JsonVersion[]) => {
    const persisted = persistVersions(next);
    versionsRef.current = persisted;
    setVersions(persisted);
  }, []);

  useEffect(() => {
    const loaded = loadVersions();
    versionsRef.current = loaded;
    setVersions(loaded);
  }, []);

  const save = useCallback((json: string, label: string) => {
    const entry: JsonVersion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      json,
      label,
      timestamp: Date.now(),
    };
    commit([entry, ...versionsRef.current]);
  }, [commit]);

  const remove = useCallback((id: string) => {
    commit(versionsRef.current.filter(v => v.id !== id));
  }, [commit]);

  const clear = useCallback(() => {
    versionsRef.current = [];
    setVersions([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* storage indisponível */ }
  }, []);

  return { versions, save, remove, clear };
}
