// ---------------------------------------------------------------------------
// AI Admin Assistant — chat handler
//
// Receives admin chat messages, calls the OpenCode API for conversational
// responses, and returns structured results. Designed as a stateless handler
// — conversation history is not persisted across requests (future enhancement).
//
// NOTE: mimo-v2.5 does not support OpenAI function calling, so tools are
// disabled. The model responds conversationally. If function calling support
// is added in the future, re-enable the tool loop (see git history for the
// original implementation).
// ---------------------------------------------------------------------------

import type { D1Database } from '@cloudflare/workers-types';
import type { AiChatRequest, AiChatResponse, AiAction } from './types';
import type { ICacheService } from '../../services/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENCODE_API_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENCODE_MODEL = 'mimo-v2.5';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_MESSAGE_LENGTH = 2000;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the Admin Assistant for Azadi Coffee Roastery (روستری قهوه آزادی). You help store administrators manage their menu, products, categories, settings, and cache.

## Your Role
- Help admins understand their data and guide them on how to manage it
- Answer questions about products, categories, settings, and menu configuration
- Provide guidance on using the Admin Mini App for data operations
- Help troubleshoot issues and explain features

## Guidelines
- Reply in the SAME language the admin uses (Persian/Farsi or English)
- For data operations (create, update, delete), guide the admin to use the Admin Mini App
- For read-only questions (list products, check settings, etc.), provide helpful information
- Keep responses concise and professional
- If you don't have enough information, ask for clarification

## What You Can Help With
- Answering questions about the shop's products, categories, and settings
- Explaining how to use the Admin Mini App features
- Providing guidance on best practices for menu management
- Troubleshooting common issues
`;

// ---------------------------------------------------------------------------
// Response types (internal, matches OpenAI function calling format)
// ---------------------------------------------------------------------------

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAiChoice {
  message: OpenAiMessage;
  finish_reason: string;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Handle an AI chat message from the admin panel.
 *
 * @param request   - Parsed chat request with message text and optional conversationId
 * @param apiKey    - OpenCode API key from env.OPENCODE_API_KEY
 * @param db        - D1 database binding
 * @param cache     - Optional KV cache service
 * @returns AiChatResponse with reply text, executed actions, and conversationId
 */
export async function handleAiChat(
  request: AiChatRequest,
  apiKey: string,
  _db: D1Database,
  _cache?: ICacheService,
): Promise<AiChatResponse> {
  const conversationId = request.conversationId || generateConversationId();
  const message = request.message?.trim();

  if (!message) {
    return {
      reply: 'لطفاً پیامی ارسال کنید.',
      actions: [],
      conversationId,
    };
  }

  // Truncate to prevent abuse
  const truncatedMessage =
    message.length > MAX_MESSAGE_LENGTH ? message.slice(0, MAX_MESSAGE_LENGTH) : message;

  const messages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: truncatedMessage },
  ];

  // NOTE: mimo-v2.5 does not support OpenAI function calling — sending tools
  // causes the model to output XML tool-call markup as text. We skip tools
  // entirely and let the model respond conversationally. If the model gains
  // function calling support in the future, re-enable by passing `tools` here.
  const allActions: AiAction[] = [];
  let finalReply = '';

  // Single-round: no tool loop needed when tools are disabled.
  {
    let data: {
      choices?: OpenAiChoice[];
      error?: { message?: string };
    };

    try {
      const response = await callOpenCodeApi(apiKey, messages);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            operation: 'ai-chat-api-error',
            status: response.status,
            statusText: response.statusText,
            errorBody: errorBody.slice(0, 500),
            model: OPENCODE_MODEL,
            messageCount: messages.length,
          }),
        );

        // Surface API error details to the admin for debugging
        let detail = '';
        try {
          const parsed = JSON.parse(errorBody) as Record<string, unknown>;
          const errObj = parsed.error as Record<string, unknown> | undefined;
          const msg = errObj?.message;
          const typ = parsed.type;
          detail = typeof msg === 'string' ? msg : typeof typ === 'string' ? typ : '';
        } catch {
          detail = errorBody.slice(0, 200);
        }
        return {
          reply: `متأسفانه در پاسخگویی مشکلی پیش آمد.${detail ? ` (${detail})` : ''} لطفاً دوباره تلاش کنید.`,
          actions: allActions,
          conversationId,
        };
      }

      data = await response.json();
    } catch (err: unknown) {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          operation: 'ai-chat-fetch-error',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return {
        reply: 'متأسفانه در اتصال به سرویس AI مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
        actions: allActions,
        conversationId,
      };
    }

    if (data.error) {
      const errMsg = data.error.message || 'Unknown error';
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          operation: 'ai-chat-api-body-error',
          error: errMsg,
          model: OPENCODE_MODEL,
        }),
      );
      return {
        reply: `متأسفانه در پردازش درخواست مشکلی پیش آمد. (${errMsg})`,
        actions: allActions,
        conversationId,
      };
    }

    const choice = data.choices?.[0];
    if (!choice) {
      return {
        reply: 'متأسفانه پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.',
        actions: allActions,
        conversationId,
      };
    }

    finalReply = choice.message.content || '';
  }

  return {
    reply: finalReply,
    actions: allActions,
    conversationId,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Call the OpenCode chat completions API.
 *
 * NOTE: mimo-v2.5 does not support OpenAI function calling. Sending tools
 * causes the model to output XML tool-call markup as text. We skip tools
 * entirely and let the model respond conversationally. If the model gains
 * function calling support in the future, re-enable by accepting `tools` here.
 */
async function callOpenCodeApi(apiKey: string, messages: OpenAiMessage[]): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(OPENCODE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        messages,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate a pseudo-unique conversation ID.
 * Uses timestamp + random suffix — not a UUID, but sufficient for
 * correlating requests within a session.
 */
function generateConversationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `conv_${timestamp}_${random}`;
}
