/* Client-side uploads.
 *
 * On Vercel the routes can't receive more than 4.5 MB, so files go straight
 * from the browser to Blob and only URLs travel to the API. Locally there is no
 * store and no limit, so callers keep posting the files themselves. */

import { upload } from '@vercel/blob/client';
import { getGeminiKey } from './apiKeys';

export type RemoteFile = { url: string; name: string };

/** Acima disso a Vercel recomenda multipart (retomada por parte, envio paralelo). */
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

let availability: Promise<boolean> | null = null;

/** Cached: the answer can't change while the page is open. */
export function blobUploadsAvailable(): Promise<boolean> {
  availability ??= fetch('/api/health', { cache: 'no-store' })
    .then(res => (res.ok ? res.json() : { blobEnabled: false }))
    .then(body => !!body?.blobEnabled)
    .catch(() => false);
  return availability;
}

export async function uploadToBlob(files: File[], prefix: string): Promise<RemoteFile[]> {
  // A chave viaja para a nossa própria rota de token, que a usa como controle
  // de acesso antes de assinar o upload.
  const clientPayload = getGeminiKey() ?? '';

  return Promise.all(
    files.map(async file => {
      const blob = await upload(`${prefix}/${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',
        clientPayload,
        multipart: file.size > MULTIPART_THRESHOLD,
      });
      return { url: blob.url, name: file.name };
    }),
  );
}
