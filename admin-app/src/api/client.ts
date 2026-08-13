import { retrieveLaunchParams } from '@telegram-apps/sdk';

export const API_BASE =
  import.meta.env.VITE_API_BASE || 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api';

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
  return apiFetch<Message[]>('/messages');
}

export async function replyToMessage(id: number, replyText: string): Promise<{ success: boolean }> {
  return apiFetch(`/messages/${id}/reply`, {
    method: 'POST',
    body: { replyText },
  });
}
