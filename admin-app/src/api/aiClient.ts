import { apiFetch } from './client';
import type { AiAction, AiChatRequest, AiChatResponse, AiHistoryParams } from './aiTypes';
import type { AiLogsResponse } from './types';

/**
 * AI chat API client for the admin assistant.
 *
 * Wraps the two AI endpoints exposed by the Worker:
 * - POST /api/ai/chat   — send a message, receive reply + actions
 * - GET  /api/ai/history — query conversation logs
 */

/** Timeout for AI chat requests (30 seconds). AI responses can be slow. */
const AI_CHAT_TIMEOUT_MS = 30_000;

/**
 * Send a message to the AI assistant.
 *
 * @param request - The chat message (and optional conversationId for multi-turn).
 * @returns The AI reply, any tool actions executed, and a conversationId.
 * @throws Error with a user-friendly Persian message on timeout or network failure.
 */
export async function sendAiChatMessage(request: AiChatRequest): Promise<AiChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_CHAT_TIMEOUT_MS);

  try {
    return await apiFetch<AiChatResponse>('/ai/chat', {
      method: 'POST',
      body: request,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('پاسخ دیر شد — لطفاً دوباره تلاش کنید');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Timeout for AI execute requests (30 seconds). */
const AI_EXECUTE_TIMEOUT_MS = 30_000;

/**
 * Execute a confirmed write action from the AI assistant.
 *
 * Called after the admin confirms a pending action in the chat panel.
 * Sends the tool name + params to POST /api/ai/execute for execution.
 *
 * @param tool    - The tool name (e.g., 'updateProduct')
 * @param params  - The tool parameters
 * @param conversationId - Optional conversation ID for logging
 * @returns The executed action result
 */
export async function executeAiAction(
  tool: string,
  params: Record<string, unknown>,
  conversationId?: string,
): Promise<AiAction> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_EXECUTE_TIMEOUT_MS);

  try {
    const response = await apiFetch<{ action: AiAction }>('/ai/execute', {
      method: 'POST',
      body: { tool, params, conversationId },
      signal: controller.signal,
    });
    return response.action;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('درخواست دیر شد — لطفاً دوباره تلاش کنید');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch recent AI conversation logs.
 *
 * @param params - Optional filters: limit (1-200) and userId.
 * @returns An object containing the logs array.
 */
export async function fetchAiHistory(params?: AiHistoryParams): Promise<AiLogsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params?.userId !== undefined) {
    searchParams.set('userId', params.userId);
  }
  const qs = searchParams.toString();
  return apiFetch<AiLogsResponse>(`/ai/history${qs ? `?${qs}` : ''}`);
}
