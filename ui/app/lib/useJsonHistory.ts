'use client';

import { useCallback, useEffect, useState } from 'react';

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

function persistVersions(versions: JsonVersion[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions.slice(0, MAX_VERSIONS)));
  } catch {
    // storage full — drop oldest
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(versions.slice(0, 5)));
    } catch { /* give up */ }
  }
}

export function useJsonHistory() {
  const [versions, setVersions] = useState<JsonVersion[]>([]);

  useEffect(() => {
    setVersions(loadVersions());
  }, []);

  const save = useCallback((json: string, label: string) => {
    const entry: JsonVersion = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      json,
      label,
      timestamp: Date.now(),
    };
    setVersions(prev => {
      const next = [entry, ...prev].slice(0, MAX_VERSIONS);
      persistVersions(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setVersions(prev => {
      const next = prev.filter(v => v.id !== id);
      persistVersions(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setVersions([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { versions, save, remove, clear };
}
