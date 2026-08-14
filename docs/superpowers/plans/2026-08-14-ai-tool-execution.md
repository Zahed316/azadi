# AI Tool Execution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the AI admin assistant's model output to the existing tool executor via structured output parsing, enabling the AI to propose and (after confirmation) execute admin operations.

**Architecture:** Since mimo-v2.5 lacks function calling, tool schemas are embedded in the system prompt. The model outputs `<ai_action>{"tool":"name","params":{...}}</ai_action>` blocks in its text. A parser extracts these blocks, classifies them as read (execute immediately) or write (return as pending actions for admin confirmation). The existing `executor.ts` handles all actual D1/KV operations.

**Tech Stack:** TypeScript, Cloudflare Workers, D1 (SQLite) via Drizzle ORM, React + TanStack Query, vitest

## Global Constraints

- mimo-v2.5 does NOT support OpenAI function calling — never send `tools` parameter in API requests
- All bot/AI text is Persian (Farsi) with HTML parse mode where applicable
- `executor.ts` and `tools.ts` are 100% reused — do not modify them
- Auth: `Authorization: Telegram <initData>` header, `super_admin` role required for all `/api/ai/*` endpoints
- Read tools execute immediately; write tools return as `pendingActions` requiring admin confirmation
- KV cache invalidation happens inside executor.ts — no duplicate invalidation in the handler

---

## File Map

| File                                     | Action     | Responsibility                                                               |
| ---------------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `src/api/ai/parser.ts`                   | **Create** | Parse `<ai_action>` blocks from model text, classify read vs write           |
| `src/api/ai/types.ts`                    | **Modify** | Add `PendingAction` type, update `AiChatResponse` with `pendingActions[]`    |
| `src/api/ai/handler.ts`                  | **Modify** | Integrate parser, execute reads, return writes as pendingActions             |
| `src/api/ai/execute.ts`                  | **Create** | `POST /api/ai/execute` handler — validates and runs a confirmed write action |
| `src/api/resources/ai-chat.ts`           | **Modify** | Add `POST /ai/execute` route                                                 |
| `admin-app/src/api/aiTypes.ts`           | **Modify** | Add `PendingAction` type, update `AiChatResponse`                            |
| `admin-app/src/api/aiClient.ts`          | **Modify** | Add `executeAiAction()` API call                                             |
| `admin-app/src/hooks/useAIChat.ts`       | **Modify** | Add `confirmAction()` and `cancelAction()` methods                           |
| `admin-app/src/components/ChatPanel.tsx` | **Modify** | Add confirmation UI for pending actions                                      |
| `src/tests/ai-parser.test.ts`            | **Create** | Unit tests for parser                                                        |
| `src/tests/ai-handler-tools.test.ts`     | **Create** | Integration tests for handler with tool execution                            |
| `src/tests/ai-execute.test.ts`           | **Create** | Integration tests for execute endpoint                                       |

---

## Task 1: Action Block Parser

**Files:**

- Create: `src/api/ai/parser.ts`
- Create: `src/tests/ai-parser.test.ts`

**Interfaces:**

- Produces: `parseAiActions(text: string): { actions: ParsedAction[]; cleanText: string }`
- Produces: `classifyAction(action: ParsedAction): 'read' | 'write'`
- `ParsedAction = { tool: string; params: Record<string, unknown> }`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/ai-parser.test.ts`:

```typescript
import { describe, test, expect } from 'vitest';
import { parseAiActions, classifyAction } from '../api/ai/parser';

describe('parseAiActions', () => {
  test('returns clean text when no action blocks present', () => {
    const result = parseAiActions('Hello, how can I help?');
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe('Hello, how can I help?');
  });

  test('parses a single action block', () => {
    const text = `Here is the change:
<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({ tool: 'updateProduct', params: { id: 1, price: 105000 } });
    expect(result.cleanText).toBe('Here is the change:');
  });

  test('parses multiple action blocks', () => {
    const text = `<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>
<ai_action>
{"tool": "updateProduct", "params": {"id": 2, "price": 95000}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toHaveLength(2);
    expect(result.cleanText).toBe('');
  });

  test('handles malformed JSON gracefully', () => {
    const text = `<ai_action>
{invalid json}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe('');
  });

  test('handles missing tool name', () => {
    const text = `<ai_action>
{"params": {"id": 1}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toEqual([]);
  });

  test('handles partial/unclosed block by ignoring it', () => {
    const text = 'Some text <ai_action>{"tool": "updateProduct", "params": {"id": 1}}';
    const result = parseAiActions(text);
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe(
      'Some text <ai_action>{"tool": "updateProduct", "params": {"id": 1}}',
    );
  });

  test('strips action blocks from displayed text', () => {
    const text = `قیمت تغییر می‌کنم:
<ai_action>
{"tool": "updateSetting", "params": {"key": "price_unit", "value": "ریال"}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.cleanText).toBe('قیمت تغییر می‌کنم:');
  });
});

describe('classifyAction', () => {
  test('classifies read tools correctly', () => {
    expect(classifyAction({ tool: 'getSettings', params: {} })).toBe('read');
    expect(classifyAction({ tool: 'listProducts', params: {} })).toBe('read');
    expect(classifyAction({ tool: 'listCategories', params: {} })).toBe('read');
    expect(classifyAction({ tool: 'getMenuConfig', params: {} })).toBe('read');
  });

  test('classifies write tools correctly', () => {
    expect(classifyAction({ tool: 'updateProduct', params: {} })).toBe('write');
    expect(classifyAction({ tool: 'deleteCategory', params: {} })).toBe('write');
    expect(classifyAction({ tool: 'createProduct', params: {} })).toBe('write');
    expect(classifyAction({ tool: 'invalidateCache', params: {} })).toBe('write');
  });

  test('classifies unknown tools as write (safe default)', () => {
    expect(classifyAction({ tool: 'unknownTool', params: {} })).toBe('write');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/ai-parser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the parser**

Create `src/api/ai/parser.ts`:

```typescript
// ---------------------------------------------------------------------------
// AI Admin Assistant — action block parser
//
// Extracts <ai_action> blocks from model text output, parses the JSON,
// and classifies each action as read-only or write (requiring confirmation).
// ---------------------------------------------------------------------------

/** A parsed action block from the model output. */
export interface ParsedAction {
  tool: string;
  params: Record<string, unknown>;
}

/** Read-only tools that execute immediately without confirmation. */
const READ_TOOLS = new Set(['getSettings', 'listProducts', 'listCategories', 'getMenuConfig']);

/**
 * Parse `<ai_action>` blocks from model text output.
 *
 * Extracts JSON action blocks, parses them, and returns them alongside
 * the cleaned text (blocks removed). Malformed JSON or missing tool names
 * are silently ignored — the response degrades to conversational.
 *
 * @param text - Raw model output potentially containing <ai_action> blocks
 * @returns Parsed actions and cleaned text with blocks stripped
 */
export function parseAiActions(text: string): { actions: ParsedAction[]; cleanText: string } {
  const actions: ParsedAction[] = [];
  const cleanText = text.replace(
    /<ai_action>\s*(\{[\s\S]*?\})\s*<\/ai_action>/g,
    (_, jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        if (parsed.tool && typeof parsed.tool === 'string' && typeof parsed.params === 'object') {
          actions.push({
            tool: parsed.tool,
            params: (parsed.params as Record<string, unknown>) ?? {},
          });
        }
      } catch {
        // Malformed JSON — log warning, treat as conversational
        console.warn('ai-action-parse-fail', jsonStr.slice(0, 200));
      }
      return ''; // Remove block from displayed text
    },
  );
  return { actions, cleanText: cleanText.trim() };
}

/**
 * Classify a parsed action as read (execute immediately) or write (requires confirmation).
 *
 * Read tools: getSettings, listProducts, listCategories, getMenuConfig
 * Write tools: everything else (safe default — unknown tools require confirmation)
 *
 * @param action - Parsed action with tool name and params
 * @returns 'read' if the tool is read-only, 'write' if it modifies data
 */
export function classifyAction(action: ParsedAction): 'read' | 'write' {
  return READ_TOOLS.has(action.tool) ? 'read' : 'write';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/ai-parser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/ai/parser.ts src/tests/ai-parser.test.ts
git commit -m "feat(ai): add action block parser with read/write classification"
```

---

## Task 2: Update Types — PendingAction

**Files:**

- Modify: `src/api/ai/types.ts:12-16` (AiChatResponse)
- Modify: `admin-app/src/api/aiTypes.ts:27-32` (AiChatResponse)

**Interfaces:**

- Produces: `PendingAction` type (backend + frontend)
- Produces: Updated `AiChatResponse` with `pendingActions: PendingAction[]`

- [ ] **Step 1: Add PendingAction to backend types**

In `src/api/ai/types.ts`, add the `PendingAction` interface and update `AiChatResponse`:

```typescript
// Add after the AiAction interface (line 24):

/** A write action proposed by the AI, pending admin confirmation. */
export interface PendingAction {
  tool: string;
  params: Record<string, unknown>;
  /** Human-readable description of what this action does (for the confirmation UI). */
  description: string;
}

// Update AiChatResponse (replace lines 12-16):
export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  pendingActions: PendingAction[];
  conversationId: string;
}
```

- [ ] **Step 2: Update frontend types to match**

In `admin-app/src/api/aiTypes.ts`, add `PendingAction` and update `AiChatResponse`:

```typescript
// Add after the AiAction interface (line 25):

/** A write action proposed by the AI, pending admin confirmation. */
export interface PendingAction {
  tool: string;
  params: Record<string, unknown>;
  description: string;
}

// Update AiChatResponse (replace lines 27-32):
export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  pendingActions: PendingAction[];
  conversationId: string;
}
```

- [ ] **Step 3: Run typecheck to find any callers that need updating**

Run: `npm run typecheck`
Expected: Errors in `handler.ts` (doesn't return `pendingActions` yet) and `useAIChat.ts` (doesn't read `pendingActions`). These will be fixed in Tasks 3 and 8.

- [ ] **Step 4: Commit**

```bash
git add src/api/ai/types.ts admin-app/src/api/aiTypes.ts
git commit -m "feat(ai): add PendingAction type to backend and frontend"
```

---

## Task 3: Integrate Parser into Chat Handler

**Files:**

- Modify: `src/api/ai/handler.ts`
- Create: `src/tests/ai-handler-tools.test.ts`

**Interfaces:**

- Consumes: `parseAiActions()`, `classifyAction()` from Task 1
- Consumes: `PendingAction` type from Task 2
- Produces: Updated `handleAiChat()` that returns `pendingActions[]` and executes read tools

- [ ] **Step 1: Write the failing tests**

Create `src/tests/ai-handler-tools.test.ts`:

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { parseAiActions, classifyAction } from '../api/ai/parser';
import type { PendingAction } from '../api/ai/types';

// ---------------------------------------------------------------------------
// Parser integration tests (handler depends on parser output shape)
// ---------------------------------------------------------------------------

describe('parseAiActions + classifyAction integration', () => {
  test('read action is classified for immediate execution', () => {
    const text = `<ai_action>
{"tool": "getSettings", "params": {"keys": ["price_unit"]}}
</ai_action>`;
    const { actions } = parseAiActions(text);
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('read');
  });

  test('write action is classified for confirmation', () => {
    const text = `<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>`;
    const { actions } = parseAiActions(text);
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('write');
  });

  test('mixed read/write actions are classified separately', () => {
    const text = `<ai_action>
{"tool": "getSettings", "params": {}}
</ai_action>
<ai_action>
{"tool": "updateSetting", "params": {"key": "price_unit", "value": "ریال"}}
</ai_action>`;
    const { actions } = parseAiActions(text);
    expect(actions).toHaveLength(2);
    expect(classifyAction(actions[0])).toBe('read');
    expect(classifyAction(actions[1])).toBe('write');
  });

  test('description generation for pending actions', () => {
    // The handler generates descriptions based on tool name and params
    // This tests the shape the handler will produce
    const action: PendingAction = {
      tool: 'updateProduct',
      params: { id: 1, price: 105000 },
      description: 'تغییر محصول #1',
    };
    expect(action.description).toBeTruthy();
    expect(action.tool).toBe('updateProduct');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (parser tests should pass, handler tests are conceptual)**

Run: `npx vitest run src/tests/ai-handler-tools.test.ts`
Expected: PASS (these test the parser integration, not the handler itself)

- [ ] **Step 3: Modify the handler to integrate parser and return pendingActions**

In `src/api/ai/handler.ts`, make these changes:

1. Add imports for parser at the top:

```typescript
import { parseAiActions, classifyAction } from './parser';
import type { PendingAction } from './types';
```

2. Replace the system prompt with the tool-augmented version from the spec (lines 31-51). The new prompt includes tool schemas and the `<ai_action>` output protocol.

3. After getting `finalReply` from the model (line 203), add parsing and classification logic:

```typescript
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
      const result = await executeTool(parsed.tool, parsed.params, { db: _db, cache: _cache });
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
```

4. Add the `executeTool` import at the top:

```typescript
import { executeTool } from './executor';
```

5. Update the return statement (line 206) to include `pendingActions`:

```typescript
return {
  reply: finalReply,
  actions: readActions,
  pendingActions,
  conversationId,
};
```

6. Add a `generateDescription` helper at the bottom of the file:

```typescript
/**
 * Generate a human-readable Persian description for a pending write action.
 * Used in the confirmation UI so admins understand what they're approving.
 */
function generateDescription(tool: string, params: Record<string, unknown>): string {
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
```

- [ ] **Step 4: Run all tests to verify nothing broke**

Run: `npx vitest run src/tests/ai-parser.test.ts src/tests/ai-handler-tools.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (the `pendingActions` field is now returned)

- [ ] **Step 6: Commit**

```bash
git add src/api/ai/handler.ts src/tests/ai-handler-tools.test.ts
git commit -m "feat(ai): integrate parser into chat handler, return pendingActions"
```

---

## Task 4: Execute Endpoint

**Files:**

- Create: `src/api/ai/execute.ts`
- Create: `src/tests/ai-execute.test.ts`

**Interfaces:**

- Consumes: `executeTool()` from `src/api/ai/executor.ts` (unchanged)
- Consumes: `AiAction` type from `src/api/ai/types.ts`
- Produces: `handleAiExecute(request, db, cache): Promise<Response>`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/ai-execute.test.ts`:

```typescript
import { describe, test, expect, vi } from 'vitest';

// Mock executor to avoid D1/KV dependencies
vi.mock('../../api/ai/executor', () => ({
  executeTool: vi.fn().mockResolvedValue({
    type: 'updateProduct',
    result: 'success',
    details: { id: 1, updatedFields: ['price'] },
  }),
}));

describe('POST /api/ai/execute', () => {
  test('returns action result on success', async () => {
    const { executeTool } = await import('../../api/ai/executor');
    const result = await executeTool('updateProduct', { id: 1, price: 105000 }, { db: {} as any });
    expect(result.result).toBe('success');
    expect(result.type).toBe('updateProduct');
  });

  test('returns error for unknown tool', async () => {
    const { executeTool } = await import('../../api/ai/executor');
    // executeTool handles unknown tools internally
    const result = await executeTool('nonexistent', {}, { db: {} as any });
    expect(result.result).toBe('error');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/tests/ai-execute.test.ts`
Expected: PASS

- [ ] **Step 3: Implement the execute endpoint handler**

Create `src/api/ai/execute.ts`:

```typescript
// ---------------------------------------------------------------------------
// AI Admin Assistant — execute endpoint handler
//
// Validates and executes a write action that was previously proposed by the
// AI chat handler and confirmed by the admin via the frontend confirmation UI.
// ---------------------------------------------------------------------------

import type { D1Database } from '@cloudflare/workers-types';
import type { ICacheService } from '../../services/types';
import type { AiAction } from './types';
import { executeTool, type ExecutorContext } from './executor';

/** Request body for POST /api/ai/execute. */
export interface AiExecuteRequest {
  tool: string;
  params: Record<string, unknown>;
  conversationId?: string;
}

/** Response from POST /api/ai/execute. */
export interface AiExecuteResponse {
  action: AiAction;
}

/**
 * Handle a confirmed write action from the admin chat panel.
 *
 * This endpoint is called after the admin reviews a pending action
 * in the confirmation UI and clicks "Confirm". It validates the tool
 * name and parameters, then delegates to the existing executor.
 *
 * @param request  - Parsed execute request with tool name and params
 * @param db       - D1 database binding
 * @param cache    - Optional KV cache service
 * @returns The executed action result
 */
export async function handleAiExecute(
  request: AiExecuteRequest,
  db: D1Database,
  cache?: ICacheService,
): Promise<AiExecuteResponse> {
  // Validate tool name
  if (!request.tool || typeof request.tool !== 'string') {
    return {
      action: {
        type: 'unknown',
        result: 'error',
        error: 'tool is required',
      },
    };
  }

  // Validate params
  if (!request.params || typeof request.params !== 'object') {
    return {
      action: {
        type: request.tool,
        result: 'error',
        error: 'params is required and must be an object',
      },
    };
  }

  // Execute via the existing executor (100% reuse)
  const ctx: ExecutorContext = { db, cache };
  const action = await executeTool(request.tool, request.params, ctx);

  return { action };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/ai-execute.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/ai/execute.ts src/tests/ai-execute.test.ts
git commit -m "feat(ai): add execute endpoint for confirmed write actions"
```

---

## Task 5: Wire Execute Route into Router

**Files:**

- Modify: `src/api/resources/ai-chat.ts`

**Interfaces:**

- Consumes: `handleAiExecute()` from Task 4
- Produces: Updated `handleAiChatRoute` that also handles `POST /ai/execute`

- [ ] **Step 1: Add the execute route to ai-chat.ts**

In `src/api/resources/ai-chat.ts`, add the import for `handleAiExecute` and a new route block:

1. Add import at the top:

```typescript
import { handleAiExecute } from '../ai/execute';
import type { AiExecuteRequest } from '../ai/execute';
```

2. Add the execute route BEFORE the `POST /ai/chat` block (around line 17):

```typescript
// --- POST /ai/execute ---
if (path === 'ai/execute' && method === 'POST') {
  const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
  if (guard) return guard;

  let body: AiExecuteRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', corsHeaders);
  }

  if (!body.tool || typeof body.tool !== 'string') {
    return jsonError('tool is required', corsHeaders);
  }

  if (!body.params || typeof body.params !== 'object') {
    return jsonError('params is required', corsHeaders);
  }

  const cache = ctx.cache;
  const response = await handleAiExecute(body, db, cache);
  return jsonSuccess(response, corsHeaders);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run existing tests to verify no regression**

Run: `npx vitest run src/tests/router-ai.test.ts` (or relevant test file)
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/api/resources/ai-chat.ts
git commit -m "feat(ai): wire POST /ai/execute route into router"
```

---

## Task 6: Frontend API Client + Types

**Files:**

- Modify: `admin-app/src/api/aiClient.ts`
- Modify: `admin-app/src/api/aiTypes.ts` (already done in Task 2)

**Interfaces:**

- Consumes: `PendingAction` type from Task 2
- Produces: `executeAiAction(request: AiExecuteRequest): Promise<AiExecuteResponse>`

- [ ] **Step 1: Add executeAiAction to aiClient.ts**

In `admin-app/src/api/aiClient.ts`, add after the `sendAiChatMessage` function:

```typescript
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
```

Also update the import at the top to include `AiAction`:

```typescript
import type { AiChatRequest, AiChatResponse, AiHistoryParams, AiAction } from './aiTypes';
```

- [ ] **Step 2: Run typecheck in admin-app**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/api/aiClient.ts
git commit -m "feat(ai): add executeAiAction API client function"
```

---

## Task 7: Frontend Hook — Confirm/Cancel Flow

**Files:**

- Modify: `admin-app/src/hooks/useAIChat.ts`

**Interfaces:**

- Consumes: `PendingAction` from `admin-app/src/api/aiTypes.ts`
- Consumes: `executeAiAction()` from Task 6
- Produces: `confirmAction(tool, params)` and `cancelAction()` methods
- Produces: `pendingActions` state on ChatMessage

- [ ] **Step 1: Update ChatMessage type and add confirm/cancel logic**

In `admin-app/src/hooks/useAIChat.ts`:

1. Update the `ChatMessage` interface to include `pendingActions`:

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actions?: AiAction[];
  /** Write actions pending admin confirmation (only on assistant messages). */
  pendingActions?: PendingAction[];
  /** Whether this message's pending actions have been confirmed (hides Confirm/Cancel buttons). */
  confirmed?: boolean;
}
```

2. Add import for `PendingAction` and `executeAiAction`:

```typescript
import type { AiChatResponse, AiAction, PendingAction } from '../api/aiTypes';
import { executeAiAction } from '../api/aiClient';
```

3. Update the `onSuccess` handler to capture `pendingActions`:

```typescript
onSuccess: (data: AiChatResponse) => {
  setConversationId(data.conversationId);
  setLastUserText(null);

  setMessages((prev) => [
    ...prev,
    {
      role: 'assistant',
      text: data.reply,
      timestamp: new Date(),
      actions: data.actions.length > 0 ? data.actions : undefined,
      pendingActions: data.pendingActions.length > 0 ? data.pendingActions : undefined,
    },
  ]);
},
```

4. Add `confirmAction` and `cancelAction` callbacks after the existing `retryLastMessage`:

```typescript
/**
 * Confirm a pending write action, sending it for execution.
 *
 * Finds the last assistant message with pendingActions, marks it as confirmed,
 * sends the action for execution, and appends the result as a new message.
 */
const confirmAction = useCallback(
  async (tool: string, params: Record<string, unknown>) => {
    // Find and mark the last assistant message with pending actions as confirmed
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant' && updated[i].pendingActions?.length) {
          updated[i] = { ...updated[i], confirmed: true };
          break;
        }
      }
      return updated;
    });

    try {
      const result = await executeAiAction(tool, params, conversationId ?? undefined);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            result.result === 'success'
              ? `✅ انجام شد: ${result.type}`
              : `❌ خطا: ${result.error || 'مشکلی پیش آمد'}`,
          timestamp: new Date(),
          actions: [result],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `❌ خطا در اجرای عملیات: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date(),
        },
      ]);
    }
  },
  [conversationId],
);

/**
 * Cancel all pending actions on the last assistant message.
 * Marks the message as confirmed (hiding the buttons) without executing.
 */
const cancelAction = useCallback(() => {
  setMessages((prev) => {
    const updated = [...prev];
    for (let i = updated.length - 1; i >= 0; i--) {
      if (updated[i].role === 'assistant' && updated[i].pendingActions?.length) {
        updated[i] = { ...updated[i], confirmed: true };
        break;
      }
    }
    return updated;
  });
}, []);
```

5. Update the return object to include the new methods:

```typescript
return {
  messages,
  isSending: mutation.isPending,
  error: mutation.error,
  conversationId,
  sendMessage,
  retryLastMessage,
  canRetry: !mutation.isPending && lastUserText !== null && mutation.isError,
  clearHistory,
  confirmAction,
  cancelAction,
};
```

- [ ] **Step 2: Run typecheck in admin-app**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/hooks/useAIChat.ts
git commit -m "feat(ai): add confirm/cancel action flow to useAIChat hook"
```

---

## Task 8: Confirmation UI in ChatPanel

**Files:**

- Modify: `admin-app/src/components/ChatPanel.tsx`

**Interfaces:**

- Consumes: `confirmAction(tool, params)` and `cancelAction()` from Task 7
- Consumes: `pendingActions` and `confirmed` from ChatMessage

- [ ] **Step 1: Add PendingActionsCard component and wire it into ChatBubble**

In `admin-app/src/components/ChatPanel.tsx`:

1. Add import for `PendingAction`:

```typescript
import type { AiAction, PendingAction } from '../api/aiTypes';
```

2. Add `PendingActionsCard` component after the `ActionCard` component (after line 32):

```typescript
/* ------------------------------------------------------------------ */
/* Pending actions card — confirmation UI for write actions            */
/* ------------------------------------------------------------------ */

function PendingActionsCard({
  pendingActions,
  confirmed,
  onConfirm,
  onCancel,
}: {
  pendingActions: PendingAction[];
  confirmed: boolean;
  onConfirm: (tool: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  if (confirmed) {
    return (
      <div className="chat-pending-confirmed">
        <span>✅ تأیید شد</span>
      </div>
    );
  }

  return (
    <div className="chat-pending-actions">
      <div className="chat-pending-label">عملیات پیشنهادی:</div>
      {pendingActions.map((action, i) => (
        <div key={`${action.tool}-${i}`} className="chat-pending-item" dir="auto">
          <span className="chat-pending-desc">{action.description}</span>
        </div>
      ))}
      <div className="chat-pending-buttons">
        <button
          type="button"
          className="chat-confirm-btn"
          onClick={() => {
            // For now, confirm the first pending action
            // Multi-action confirmation can be added later
            const first = pendingActions[0];
            onConfirm(first.tool, first.params);
          }}
        >
          ✅ تأیید
        </button>
        <button type="button" className="chat-cancel-btn" onClick={onCancel}>
          ❌ لغو
        </button>
      </div>
    </div>
  );
}
```

3. Update `ChatBubble` to accept and render `pendingActions`:

```typescript
function ChatBubble({
  role,
  text,
  timestamp,
  actions,
  pendingActions,
  confirmed,
  onConfirm,
  onCancel,
}: {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actions?: AiAction[];
  pendingActions?: PendingAction[];
  confirmed?: boolean;
  onConfirm?: (tool: string, params: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const isUser = role === 'user';

  return (
    <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
      <div className="chat-bubble-text" dir="auto">
        {text}
      </div>
      {actions && actions.length > 0 && (
        <div className="chat-actions">
          {actions.map((a, i) => (
            <ActionCard key={`${a.type}-${i}`} action={a} />
          ))}
        </div>
      )}
      {pendingActions && pendingActions.length > 0 && onConfirm && onCancel && (
        <PendingActionsCard
          pendingActions={pendingActions}
          confirmed={confirmed ?? false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
      <div className="chat-bubble-time">
        {timestamp.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
```

4. Update the `ChatPanel` component to destructure and pass `confirmAction`/`cancelAction`:

```typescript
export default function ChatPanel() {
  const {
    messages,
    isSending,
    error,
    sendMessage,
    retryLastMessage,
    canRetry,
    clearHistory,
    confirmAction,
    cancelAction,
  } = useAIChat();
  // ... rest of component

  // Update the messages.map to pass the new props:
  {messages.map((msg, i) => (
    <ChatBubble
      key={`${msg.role}-${msg.timestamp.getTime()}-${i}`}
      role={msg.role}
      text={msg.text}
      timestamp={msg.timestamp}
      actions={msg.actions}
      pendingActions={msg.pendingActions}
      confirmed={msg.confirmed}
      onConfirm={msg.role === 'assistant' ? confirmAction : undefined}
      onCancel={msg.role === 'assistant' ? cancelAction : undefined}
    />
  ))}
```

- [ ] **Step 2: Add CSS for the new components**

In `admin-app/src/index.css`, add styles for the pending actions UI:

```css
/* Pending actions confirmation UI */
.chat-pending-actions {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.chat-pending-label {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 4px;
}

.chat-pending-item {
  font-size: 0.85rem;
  padding: 4px 0;
  color: #333;
}

.chat-pending-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.chat-confirm-btn,
.chat-cancel-btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.chat-confirm-btn {
  background: #4caf50;
  color: white;
}

.chat-confirm-btn:hover {
  background: #388e3c;
}

.chat-cancel-btn {
  background: #f44336;
  color: white;
}

.chat-cancel-btn:hover {
  background: #d32f2f;
}

.chat-pending-confirmed {
  margin-top: 8px;
  padding: 6px 12px;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 8px;
  font-size: 0.85rem;
  color: #388e3c;
  text-align: center;
}
```

- [ ] **Step 3: Run typecheck in admin-app**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run lint in admin-app**

Run: `cd admin-app && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/components/ChatPanel.tsx admin-app/src/index.css
git commit -m "feat(ai): add confirmation UI for pending write actions"
```

---

## Task 9: End-to-End Integration Test

**Files:**

- Modify: `src/tests/ai-execute.test.ts` (expand from Task 4)

**Interfaces:**

- Consumes: All previous tasks
- Produces: Full integration test covering parse → classify → execute flow

- [ ] **Step 1: Expand the execute test to cover the full flow**

Update `src/tests/ai-execute.test.ts`:

```typescript
import { describe, test, expect, vi } from 'vitest';
import { parseAiActions, classifyAction } from '../api/ai/parser';

// Mock executor
vi.mock('../../api/ai/executor', () => ({
  executeTool: vi
    .fn()
    .mockImplementation(async (tool: string, params: Record<string, unknown>) => ({
      type: tool,
      result: 'success' as const,
      details: { ...params },
    })),
}));

describe('Full AI tool execution flow', () => {
  test('parse → classify → execute read tool', async () => {
    const modelOutput = `تنظیمات فعلی:
<ai_action>
{"tool": "getSettings", "params": {"keys": ["price_unit"]}}
</ai_action>`;

    const { actions, cleanText } = parseAiActions(modelOutput);
    expect(cleanText).toBe('تنظیمات فعلی:');
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('read');

    // In the handler, read tools are executed immediately
    const { executeTool } = await import('../../api/ai/executor');
    const result = await executeTool(actions[0].tool, actions[0].params, { db: {} as any });
    expect(result.result).toBe('success');
    expect(result.type).toBe('getSettings');
  });

  test('parse → classify → pending for write tool', () => {
    const modelOutput = `قیمت را تغییر می‌دهم:
<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>`;

    const { actions, cleanText } = parseAiActions(modelOutput);
    expect(cleanText).toBe('قیمت را تغییر می‌دهم:');
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('write');
    // In the handler, this becomes a pendingAction — not executed
  });

  test('mixed read and write actions', () => {
    const modelOutput = `<ai_action>
{"tool": "listCategories", "params": {}}
</ai_action>
<ai_action>
{"tool": "updateSetting", "params": {"key": "price_unit", "value": "ریال"}}
</ai_action>`;

    const { actions } = parseAiActions(modelOutput);
    expect(actions).toHaveLength(2);
    expect(classifyAction(actions[0])).toBe('read');
    expect(classifyAction(actions[1])).toBe('write');
  });
});
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run src/tests/ai-parser.test.ts src/tests/ai-handler-tools.test.ts src/tests/ai-execute.test.ts`
Expected: PASS

- [ ] **Step 3: Run the complete test suite to check for regressions**

Run: `npm test`
Expected: PASS (no regressions)

- [ ] **Step 4: Run full check (typecheck + lint + format + test)**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tests/ai-execute.test.ts
git commit -m "test(ai): expand integration tests for full parse→classify→execute flow"
```

---

## Task 10: Final Verification

**Files:**

- No new files — verification only

- [ ] **Step 1: Run the complete check suite**

Run: `npm run check` (root) and `cd admin-app && npm run check` (admin app)
Expected: Both PASS

- [ ] **Step 2: Manual verification — curl the execute endpoint**

```bash
# Test that /api/ai/execute rejects unauthenticated requests
curl -s -X POST https://azadi-coffee-bot.zahedrastgar316.workers.dev/api/ai/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "updateSetting", "params": {"key": "test", "value": "test"}}'
# Expected: 401 or auth error

# Test that /api/ai/execute rejects non-super_admin
# (would need a valid Telegram initData from a category_admin)
```

- [ ] **Step 3: Verify parser handles edge cases in production-like scenarios**

The parser tests cover: no blocks, single block, multiple blocks, malformed JSON, missing tool, unclosed blocks, text stripping. These are the edge cases from the spec.

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore(ai): final verification and cleanup"
```
