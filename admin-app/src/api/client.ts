import { retrieveLaunchParams } from '@telegram-apps/sdk';

export const API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api';

function getAuthHeader(): Record<string, string> {
  try {
    const { initDataRaw } = retrieveLaunchParams();
    return { Authorization: `Telegram ${initDataRaw || ''}` };
  } catch {
    return { Authorization: '' };
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { method = 'GET', body } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json();
}

