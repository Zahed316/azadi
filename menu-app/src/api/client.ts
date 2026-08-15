const PROD_API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api/public';

if (
  !import.meta.env.VITE_API_BASE &&
  !import.meta.env.PROD &&
  !import.meta.env.MODE // vitest sets MODE to 'test'
) {
  throw new Error(
    'Missing VITE_API_BASE environment variable. ' +
      'Copy .env.example to .env and set the API base URL.',
  );
}

export const API_BASE = (import.meta.env.VITE_API_BASE as string) || PROD_API_BASE;

/**
 * Fetch from the public API and unwrap the response envelope.
 *
 * The Worker wraps all responses in `{ key: [...] }` objects — pass the
 * `envelopeKey` to extract the inner value. Without it the raw envelope
 * is returned (for endpoints that don't use one, like `/menu`).
 */
export async function apiFetch<T = unknown>(path: string, envelopeKey?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return (envelopeKey ? json[envelopeKey] : json) as T;
}
