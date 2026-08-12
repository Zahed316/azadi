export const API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api/public';

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
