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
import type { AiChatRequest, AiChatResponse, AiAction, PendingAction } from './types';
import type { ICacheService } from '../../services/types';
import { parseAiActions, classifyAction } from './parser';
import { executeTool } from './executor';

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
- Execute read-only tools immediately to answer data questions
- Propose write actions as pending for admin confirmation
- Help troubleshoot issues and explain features

## Guidelines
- Reply in the SAME language the admin uses (Persian/Farsi or English)
- For read-only questions, use the appropriate tool to fetch live data
- For write operations (create, update, delete), output the action block and let the admin confirm
- Keep responses concise and professional
- If you don't have enough information, ask for clarification
- Always include conversational text before and/or after action blocks

## Tool Usage

You have access to tools that can read and write data. Use the \`<ai_action>\` output protocol to invoke them.

### Output Protocol

When you need to call a tool, output a JSON block wrapped in \`<ai_action>\` tags:

\`\`\`
<ai_action>
{"tool": "toolName", "params": {"param1": "value1", "param2": "value2"}}
</ai_action>
\`\`\`

- You can output MULTIPLE action blocks if needed (one per tool call)
- Always include conversational text (Persian or English) before or after the blocks
- Read tools execute immediately; write tools become pending for admin approval
- Malformed JSON or missing tool names are silently ignored

### Available Tools

READ TOOLS (execute immediately):

1. getSettings — Get current settings (all or by key list)
   Parameters: keys (string[], optional) — specific setting keys to retrieve

2. listProducts — List all products (read-only, fetched from cache/D1)

3. listCategories — List all categories (read-only, fetched from cache/D1)

4. getMenuConfig — Get menu configuration (read-only, fetched from cache/D1)

WRITE TOOLS (require admin confirmation):

5. createProduct — Create a new product in the database
   Parameters: name (string, required), categoryId (number, required), price (number), stock (number, default 0), unit (string: item|cup|kg|g|slice|piece), description (string), available (boolean, default true), featured (boolean, default false), isSeasonal (boolean, default false), priceOnRequest (boolean, default false), imageUrl (string)

6. updateProduct — Update an existing product
   Parameters: id (number, required), name (string), categoryId (number), price (number), stock (number), unit (string: item|cup|kg|g|slice|piece), description (string), available (boolean), featured (boolean), isSeasonal (boolean), priceOnRequest (boolean), imageUrl (string)

7. deleteProduct — Delete a product by ID
   Parameters: id (number, required)

8. batchUpdateProducts — Update or delete multiple products at once
   Parameters: ids (number[], required), action (string: update|delete, required), updateData (object)

9. createCategory — Create a new category
   Parameters: name (string, required), emoji (string), description (string), sortOrder (number)

10. updateCategory — Update an existing category
    Parameters: id (number, required), name (string), emoji (string), description (string), sortOrder (number)

11. deleteCategory — Delete a category by ID
    Parameters: id (number, required)

12. reorderCategories — Reorder categories by providing the new ID sequence
    Parameters: orderedIds (number[], required)

13. updateSetting — Update a setting value (upsert by key)
    Parameters: key (string, required), value (string, required)

14. updateMenuConfig — Update menu configuration for a category (upsert by categoryId)
    Parameters: categoryId (number, required), menuSection (string), displayOrder (number), isVisible (boolean), buttonLabel (string), specialMessage (string)

15. invalidateCache — Invalidate KV cache for specific resource prefixes
    Parameters: prefix (string, required: products|categories|settings|menu-config|all)
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
      pendingActions: [],
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
          pendingActions: [],
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
        pendingActions: [],
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
        pendingActions: [],
        conversationId,
      };
    }

    const choice = data.choices?.[0];
    if (!choice) {
      return {
        reply: 'متأسفانه پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.',
        actions: allActions,
        pendingActions: [],
        conversationId,
      };
    }

    finalReply = choice.message.content || '';
  }

  // Parse <ai_action> blocks from model output
  const { actions: parsedActions, cleanText } = parseAiActions(finalReply);
  finalReply = cleanText; // Use cleaned text (blocks stripped) as the reply

  // Classify actions: reads execute immediately, writes become pending
  const readActions: AiAction[] = [];
  const pendingActions: PendingAction[] = [];

  for (const parsed of parsedActions) {
    const classification = classifyAction(parsed);

    if (classification === 'read') {
      // Execute read tools immediately
      try {
        const result = await executeTool(parsed.tool, parsed.params, { db, cache });
        readActions.push(result);
      } catch (err) {
        readActions.push({
          type: parsed.tool,
          result: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // Write tools become pending actions for admin confirmation
      pendingActions.push({
        tool: parsed.tool,
        params: parsed.params,
        description: generateDescription(parsed.tool, parsed.params),
      });
    }
  }

  // Second round: if reads executed but no write actions were generated,
  // feed the tool results back so the model can complete the request
  // (e.g., "list products" → see results → "update product #3").
  if (readActions.length > 0 && pendingActions.length === 0) {
    try {
      const toolContext = readActions
        .map((a) => `Tool ${a.type} result:\n${JSON.stringify(a.details)}`)
        .join('\n\n');

      messages.push(
        { role: 'assistant', content: finalReply },
        {
          role: 'user',
          content: `نتایج ابزارها:\n${toolContext}\n\nحالا بر اساس این اطلاعات، درخواست اصلی کاربر را کامل کنید. اگر نیاز به تغییر داده دارید، حتماً <ai_action> تولید کنید.`,
        },
      );

      const secondResponse = await callOpenCodeApi(apiKey, messages);

      if (secondResponse.ok) {
        const secondData = await secondResponse.json();
        const secondChoice = (secondData as { choices?: OpenAiChoice[] })?.choices?.[0];
        if (secondChoice) {
          const secondText = secondChoice.message.content || '';
          const { actions: secondParsed } = parseAiActions(secondText);

          for (const parsed of secondParsed) {
            const classification = classifyAction(parsed);
            if (classification === 'write') {
              pendingActions.push({
                tool: parsed.tool,
                params: parsed.params,
                description: generateDescription(parsed.tool, parsed.params),
              });
            }
          }

          // Append second-round conversational text to the reply
          const secondClean = secondText.replace(/<ai_action>[\s\S]*?<\/ai_action>/g, '').trim();
          if (secondClean) {
            finalReply = finalReply ? `${finalReply}\n\n${secondClean}` : secondClean;
          }
        }
      }
    } catch (err) {
      // Second-round failure is non-fatal — return first-round results
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          operation: 'ai-chat-second-round-error',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  return {
    reply: finalReply,
    actions: readActions,
    pendingActions,
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

/**
 * Generate a human-readable Persian description for a pending write action.
 * Used in the confirmation UI so admins understand what they're approving.
 */
function generateDescription(tool: string, params: Record<string, unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- params are JSON primitives from the model
  const name = (k: string) => String(params[k] ?? '');
  switch (tool) {
    case 'createProduct':
      return `ایجاد محصول جدید: ${name('name')}`;
    case 'updateProduct':
      return `ویرایش محصول #${name('id')}`;
    case 'deleteProduct':
      return `حذف محصول #${name('id')}`;
    case 'batchUpdateProducts':
      return `به‌روزرسانی گروهی ${Array.isArray(params.ids) ? params.ids.length : ''} محصول`;
    case 'createCategory':
      return `ایجاد دسته‌بندی جدید: ${name('name')}`;
    case 'updateCategory':
      return `ویرایش دسته‌بندی #${name('id')}`;
    case 'deleteCategory':
      return `حذف دسته‌بندی #${name('id')}`;
    case 'reorderCategories':
      return `تغییر ترتیب دسته‌بندی‌ها`;
    case 'updateSetting':
      return `تغییر تنظیم ${name('key')}`;
    case 'updateMenuConfig':
      return `به‌روزرسانی تنظیمات منو برای دسته #${name('categoryId')}`;
    case 'invalidateCache':
      return `پاکسازی کش ${name('prefix')}`;
    default:
      return `اجرای ${tool}`;
  }
}
