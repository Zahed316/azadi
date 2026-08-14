// ---------------------------------------------------------------------------
// AI Admin Assistant — chat handler
//
// Receives admin chat messages, calls the OpenCode API with tool definitions,
// processes any tool calls via the executor in a loop, and returns structured
// results. Designed as a stateless handler — conversation history is not
// persisted across requests (future enhancement).
// ---------------------------------------------------------------------------

import type { D1Database } from '@cloudflare/workers-types';
import type { AiChatRequest, AiChatResponse, AiAction } from './types';
import { AI_TOOLS } from './tools';
import { executeTool } from './executor';
import type { ExecutorContext } from './executor';
import type { ICacheService } from '../../services/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENCODE_API_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENCODE_MODEL = 'mimo-v2.5';
const MAX_TOOL_ROUNDS = 10;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_MESSAGE_LENGTH = 2000;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the Admin Assistant for Azadi Coffee Roastery (روستری قهوه آزادی). You help store administrators manage their menu, products, categories, settings, and cache through natural language.

## Your Role
- Help admins manage the coffee shop's backend data through conversation
- Translate natural language requests into tool calls to create, update, delete, or query data
- Confirm actions before executing destructive operations (deletes, batch updates)
- Provide clear feedback about what was done

## Guidelines
- Reply in the SAME language the admin uses (Persian/Farsi or English)
- When the admin asks to create or update something, use the appropriate tool
- When unsure about parameters, ask for clarification before calling a tool
- For destructive actions (delete, batch update), confirm with the admin first
- Always report the result of tool executions clearly
- Keep responses concise and professional

## Available Tools
You have access to tools for managing products, categories, settings, menu configuration, and cache. Use them when the admin's request involves any of these operations.
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
  db: D1Database,
  cache?: ICacheService,
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

  const executorCtx: ExecutorContext = { db, cache };
  const messages: OpenAiMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: truncatedMessage },
  ];

  const tools = formatToolsForApi();
  const allActions: AiAction[] = [];
  let finalReply = '';

  // Tool-call loop: the model may request multiple tool calls per turn.
  // We execute each, append the results, and re-call the model until it
  // produces a plain text reply (no more tool calls).
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let data: {
      choices?: OpenAiChoice[];
      error?: { message?: string };
    };

    try {
      const response = await callOpenCodeApi(apiKey, messages, tools);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            operation: 'ai-chat-api-error',
            status: response.status,
            statusText: response.statusText,
            errorBody: errorBody.slice(0, 200),
          }),
        );
        return {
          reply: 'متأسفانه در پاسخگویی مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
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
      console.error('[AiChat] API returned error:', data.error.message);
      return {
        reply: 'متأسفانه در پردازش درخواست مشکلی پیش آمد.',
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

    const assistantMessage = choice.message;

    // No tool calls — the model produced a final text reply
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      finalReply = assistantMessage.content || '';
      // Append assistant message to history for context
      messages.push(assistantMessage);
      break;
    }

    // Execute each tool call and collect results
    messages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      const { name, arguments: argsString } = toolCall.function;

      let params: Record<string, unknown>;
      try {
        params = JSON.parse(argsString) as Record<string, unknown>;
      } catch {
        const errorAction: AiAction = {
          type: name,
          result: 'error',
          error: `Invalid JSON parameters for tool ${name}`,
        };
        allActions.push(errorAction);
        messages.push({
          role: 'tool',
          content: JSON.stringify({ error: errorAction.error }),
          tool_call_id: toolCall.id,
        });
        continue;
      }

      const action = await executeTool(name, params, executorCtx);
      allActions.push(action);
      messages.push({
        role: 'tool',
        content: JSON.stringify(action),
        tool_call_id: toolCall.id,
      });
    }
  }

  // Fallback if the loop exhausted all rounds without a text reply
  if (!finalReply) {
    finalReply =
      allActions.length > 0
        ? `عملیات انجام شد (${allActions.length} عملیات).`
        : 'متأسفانه پاسخی تولید نشد. لطفاً دوباره تلاش کنید.';
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
 */
async function callOpenCodeApi(
  apiKey: string,
  messages: OpenAiMessage[],
  tools: Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>,
): Promise<Response> {
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
        tools,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Convert AI_TOOLS (flat parameters) to OpenAI function calling format
 * with `type: "function"` wrapper and `parameters.properties` structure.
 */
function formatToolsForApi(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return AI_TOOLS.map((tool) => {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, param] of Object.entries(tool.parameters)) {
      const prop: Record<string, unknown> = { type: param.type };
      if (param.description) prop.description = param.description;
      if (param.enum) prop.enum = param.enum;
      if (param.default !== undefined) prop.default = param.default;
      properties[key] = prop;
      if (param.required) required.push(key);
    }

    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
        },
      },
    };
  });
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
