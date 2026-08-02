/* Vercel Blob adapter.
 *
 * Vercel Functions reject request bodies over 4.5 MB at the edge, before the
 * handler runs. Uploads therefore go from the browser straight to Blob, and the
 * routes receive only URLs. Locally there is no such limit, so when no store is
 * connected the app keeps posting the files directly to the routes. */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { del } from '@vercel/blob';

export type RemoteFile = { url: string; name: string };

/** A connected store is what tells the two upload paths apart. */
export function isBlobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function isRemoteFile(value: unknown): value is RemoteFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.url === 'string' && typeof candidate.name === 'string';
}

/** Only accept URLs our own store issued — the routes fetch whatever we hand
 * them, so an arbitrary URL here would turn the backend into a proxy. */
export function assertOwnBlobUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL de upload inválida.');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    throw new Error('URL de upload não pertence ao storage do projeto.');
  }
}

/** Downloads a blob into os.tmpdir() and returns the local path. */
export async function downloadToTmp(file: RemoteFile, prefix: string): Promise<string> {
  assertOwnBlobUrl(file.url);
  const response = await fetch(file.url);
  if (!response.ok) {
    throw new Error(`Não foi possível ler ${file.name} do storage.`);
  }
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = path.join(os.tmpdir(), `${prefix}_${crypto.randomUUID()}_${safeName}`);
  fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  return filePath;
}

/** Uploads are disposable once the course is generated. Deletes are free and
 * keep the store near zero, which is what keeps usage inside the free tier. */
export async function discardBlobs(urls: string[]): Promise<void> {
  if (!urls.length || !isBlobEnabled()) return;
  try {
    await del(urls);
  } catch (error) {
    // Cleanup must never fail the request the user is waiting on.
    console.warn('Falha ao limpar blobs do storage:', error);
  }
}
