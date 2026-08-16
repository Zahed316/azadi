import { retrieveRawInitData } from '@tma.js/sdk';

const PROD_API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api';

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

function getAuthHeader(): Record<string, string> {
  try {
    // @tma.js/sdk v3 uses retrieveRawInitData() — the old retrieveLaunchParams().initDataRaw
    // property was removed in the SDK migration from @telegram-apps/sdk → @tma.js/sdk.
    const initDataRaw = retrieveRawInitData();
    return { Authorization: `Telegram ${initDataRaw || ''}` };
  } catch {
    return { Authorization: '' };
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Message {
  id: number;
  telegramId: string;
  senderName: string | null;
  senderEmail: string | null;
  content: string;
  rating: number | null;
  isAnonymous: boolean;
  isRead: boolean;
  replied: boolean;
  replyText: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export async function fetchMessages(): Promise<Message[]> {
  const data = await apiFetch<{ messages: Message[] }>('/messages');
  return data.messages;
}

export async function replyToMessage(id: number, replyText: string): Promise<{ success: boolean }> {
  return apiFetch(`/messages/${id}/reply`, {
    method: 'POST',
    body: { replyText },
  });
}
