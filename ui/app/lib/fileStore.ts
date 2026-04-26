/* IndexedDB store for uploaded files (matriz/quizzes/tarefas).
 * Keeps the binary Blobs across page reloads. Metadata (name/size/kind/id)
 * lives in localStorage so we can list files synchronously on first paint. */

const DB_NAME    = 'coursegen';
const DB_VERSION = 1;
const STORE      = 'files';

export type FileKind = 'matriz' | 'quiz' | 'tarefa';

export type StoredFileMeta = {
  id:   string;
  kind: FileKind;
  name: string;
  size: number;
  type: string;
  ts:   number;
};

const META_KEY = 'coursegen.files.v1';

/* ─── IndexedDB plumbing ────────────────────────────────────────────────── */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx  = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/* ─── Metadata index in localStorage ────────────────────────────────────── */

function readMeta(): StoredFileMeta[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as StoredFileMeta[]) : [];
  } catch {
    return [];
  }
}

function writeMeta(metas: StoredFileMeta[]) {
  localStorage.setItem(META_KEY, JSON.stringify(metas));
}

/* ─── Public API ────────────────────────────────────────────────────────── */

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function putFile(file: File, kind: FileKind): Promise<StoredFileMeta> {
  const id: string = makeId();
  await withStore('readwrite', s => s.put(file, id));
  const meta: StoredFileMeta = {
    id, kind, name: file.name, size: file.size, type: file.type, ts: Date.now(),
  };
  writeMeta([...readMeta(), meta]);
  return meta;
}

export async function getFile(id: string): Promise<File | null> {
  try {
    const blob = await withStore<Blob | undefined>('readonly', s => s.get(id) as IDBRequest<Blob | undefined>);
    if (!blob) return null;
    const meta = readMeta().find(m => m.id === id);
    return new File([blob], meta?.name ?? 'arquivo', { type: meta?.type ?? blob.type });
  } catch {
    return null;
  }
}

export async function removeFile(id: string): Promise<void> {
  try {
    await withStore('readwrite', s => s.delete(id));
  } catch { /* ignore */ }
  writeMeta(readMeta().filter(m => m.id !== id));
}

export async function clearAll(): Promise<void> {
  try {
    await withStore('readwrite', s => s.clear());
  } catch { /* ignore */ }
  writeMeta([]);
}

export function listMeta(kind?: FileKind): StoredFileMeta[] {
  const all = readMeta();
  return kind ? all.filter(m => m.kind === kind) : all;
}

/** Hydrate File objects for a list of metadata entries.
 * Returns ONLY the entries whose Blob is still present in IndexedDB. */
export async function hydrateFiles(metas: StoredFileMeta[]): Promise<{ meta: StoredFileMeta; file: File }[]> {
  const out: { meta: StoredFileMeta; file: File }[] = [];
  for (const m of metas) {
    const f = await getFile(m.id);
    if (f) out.push({ meta: m, file: f });
  }
  return out;
}
