/**
 * Types for the AI admin assistant chat API.
 *
 * Matches the JSON shapes returned by the Worker REST API endpoints:
 * - POST /api/ai/chat
 * - GET  /api/ai/history
 */

// ---------------------------------------------------------------------------
// Chat request / response (POST /ai/chat)
// ---------------------------------------------------------------------------

/** Outbound request to the AI chat endpoint. */
export interface AiChatRequest {
  message: string;
  conversationId?: string;
}

/** A single action executed by the AI tool executor. */
export interface AiAction {
  type: string;
  result: 'success' | 'error';
  details?: Record<string, unknown>;
  error?: string;
}

/** Response returned after processing an AI chat message. */
export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  conversationId: string;
}

// ---------------------------------------------------------------------------
// History query params (GET /ai/history)
// ---------------------------------------------------------------------------

/** Query parameters for the AI history endpoint. */
export interface AiHistoryParams {
  /** Max number of logs to return (1-200, default 50). */
  limit?: number;
  /** Filter logs by Telegram user ID. */
  userId?: string;
}
