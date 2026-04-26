/* User-provided AI provider keys, persisted in localStorage.
 * Keys are sent to /api/* via the X-Gemini-Key header — never to third parties. */

const KEY = {
  gemini: 'coursegen.key.gemini',
} as const;

export function getGeminiKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(KEY.gemini);
}

export function setGeminiKey(value: string): void {
  localStorage.setItem(KEY.gemini, value.trim());
}

export function clearGeminiKey(): void {
  localStorage.removeItem(KEY.gemini);
}

export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}

/** Headers to attach to fetch() calls. Empty when no user key — server uses .env. */
export function authHeaders(): Record<string, string> {
  const k = getGeminiKey();
  return k ? { 'X-Gemini-Key': k } : {};
}
