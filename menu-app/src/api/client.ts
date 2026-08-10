export const API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api/public';

export async function apiFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json();
}
