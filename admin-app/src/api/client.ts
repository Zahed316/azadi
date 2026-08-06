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

export async function apiUpload<T = unknown>(
  path: string,
  file: File,
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: formData,
    // Don't set Content-Type — fetch sets it with boundary automatically
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json();
}
