# Menu Lifecycle Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all remaining bare `catch` blocks on `editMessageText` across message flow handlers, replacing them with `handleEditFailure` for consistent stack management.

**Architecture:** Add an optional `newState` parameter to `handleEditFailure` so callers can specify the correct stack state (instead of the hardcoded `'fallback'`). Then refactor 5 bare-catch handlers in `message.ts` and 1 in `callbackQuery.ts` to use `handleEditFailure`.

**Tech Stack:** TypeScript, grammY Telegram bot framework, Cloudflare Workers, vitest

## Global Constraints

- All bot text is Persian (Farsi) with HTML parse mode
- `handleEditFailure` (from `src/utils/menuLifecycle.ts`) pops the active message, deletes it from Telegram, replies with new text, and pushes the new message onto the stack
- `getActiveMessage` returns `MenuStackEntry | null` (has `chatId`, `messageId`, `state`)
- `pushMessage(session, chatId, messageId, state)` returns evicted entry or null
- Message handlers (`bot.on('message:text')`) don't have `answerCallbackQuery` — `handleEditFailure` handles this gracefully (`.catch(() => {})`)
- `npm run check` = typecheck + lint + format:check + test (all must pass)
- Tests: `npx vitest run` (230 tests, 30s timeout for dynamic imports)

---

## File Structure

| File                               | Change                                                    |
| ---------------------------------- | --------------------------------------------------------- |
| `src/utils/menuLifecycle.ts`       | Add optional `newState` param to `handleEditFailure`      |
| `src/handlers/message.ts`          | Refactor 5 bare-catch handlers to use `handleEditFailure` |
| `src/handlers/callbackQuery.ts`    | Refactor `msg:confirm` handler to use Pattern A           |
| `src/tests/menu-lifecycle.test.ts` | Add test for `newState` parameter                         |

---

### Task 1: Add `newState` parameter to `handleEditFailure`

**Files:**

- Modify: `src/utils/menuLifecycle.ts:97-133`
- Test: `src/tests/menu-lifecycle.test.ts`

**Interfaces:**

- Produces: `handleEditFailure(ctx, content, opts, error, newState?)` — optional 5th param, defaults to `'fallback'`

**Why this is needed:** Currently `handleEditFailure` hardcodes `pushMessage(..., 'fallback')` on line 125. Message flow steps need to preserve their step state (e.g., `'name'`, `'content'`, `'rating'`) so the stack accurately reflects where the user is in the flow.

- [ ] **Step 1: Add the `newState` parameter**

In `src/utils/menuLifecycle.ts`, change the function signature on line 97 from:

```typescript
export async function handleEditFailure(
  ctx: {
    api?: { deleteMessage: (chatId: number, messageId: number) => Promise<unknown> };
    answerCallbackQuery: (opts?: { text?: string; show_alert?: boolean }) => Promise<unknown>;
    reply: (text: string, opts?: Record<string, unknown>) => Promise<{ message_id: number }>;
    session?: SessionData;
    chat?: { id: number };
  },
  newContent: string,
  opts: Record<string, unknown>,
  error: unknown,
): Promise<void> {
```

to:

```typescript
export async function handleEditFailure(
  ctx: {
    api?: { deleteMessage: (chatId: number, messageId: number) => Promise<unknown> };
    answerCallbackQuery: (opts?: { text?: string; show_alert?: boolean }) => Promise<unknown>;
    reply: (text: string, opts?: Record<string, unknown>) => Promise<{ message_id: number }>;
    session?: SessionData;
    chat?: { id: number };
  },
  newContent: string,
  opts: Record<string, unknown>,
  error: unknown,
  newState: string = 'fallback',
): Promise<void> {
```

Then change line 125 from:

```typescript
pushMessage(ctx.session, ctx.chat.id, sent.message_id, 'fallback');
```

to:

```typescript
pushMessage(ctx.session, ctx.chat.id, sent.message_id, newState);
```

- [ ] **Step 2: Add test for `newState` parameter**

In `src/tests/menu-lifecycle.test.ts`, add a test that verifies `handleEditFailure` uses the provided `newState` instead of `'fallback'`:

```typescript
test('handleEditFailure uses custom newState when provided', async () => {
  const session = { menuStack: [{ chatId: 1, messageId: 100, state: 'old', timestamp: 1 }] };
  const ctx = {
    api: { deleteMessage: vi.fn().mockResolvedValue({}) },
    answerCallbackQuery: vi.fn().mockResolvedValue({}),
    reply: vi.fn().mockResolvedValue({ message_id: 200 }),
    session,
    chat: { id: 1 },
  };
  const error = new Error('Bad request');

  await handleEditFailure(ctx, 'new text', { parse_mode: 'HTML' }, error, 'name');

  expect(pushMessage).toHaveBeenCalledWith(session, 1, 200, 'name');
});
```

(Adjust the import/mock setup to match the existing test file's patterns.)

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run src/tests/menu-lifecycle.test.ts`
Expected: All tests pass including the new one.

- [ ] **Step 4: Commit**

```bash
git add src/utils/menuLifecycle.ts src/tests/menu-lifecycle.test.ts
git commit -m "feat: handleEditFailure accepts optional newState parameter"
```

---

### Task 2: Refactor `message.ts` message flow handlers

**Files:**

- Modify: `src/handlers/message.ts:100-208`

**Interfaces:**

- Consumes: `handleEditFailure` (already imported on line 16)
- Consumes: `pushMessage` (already imported on line 16)

**Why:** The name, content, rating, and confirm steps all have bare `catch` blocks that silently fall through to `ctx.reply()` without cleaning up the stack. This creates orphaned messages when edit fails.

- [ ] **Step 1: Refactor the `name` step (lines 112-124)**

Change from:

```typescript
const active = getActiveMessage(ctx.session);
if (active) {
  try {
    await ctx.api.editMessageText(active.chatId, active.messageId, body, {
      reply_markup: cancelKb,
    });
    return;
  } catch {
    // Edit failed — fall through to reply
  }
}
await ctx.reply(body, { reply_markup: cancelKb });
return;
```

to:

```typescript
const active = getActiveMessage(ctx.session);
if (active) {
  try {
    await ctx.api.editMessageText(active.chatId, active.messageId, body, {
      reply_markup: cancelKb,
    });
    return;
  } catch (e) {
    await handleEditFailure(ctx, body, { reply_markup: cancelKb }, e, 'name');
    return;
  }
}
await ctx.reply(body, { reply_markup: cancelKb });
return;
```

- [ ] **Step 2: Refactor the `content` step (lines 140-152)**

Same pattern — replace `catch { // Edit failed }` with `catch (e) { await handleEditFailure(ctx, body, { reply_markup: ratingKb }, e, 'content'); return; }`

- [ ] **Step 3: Refactor the `rating` retry step (lines 173-185)**

Same pattern — replace `catch { // Edit failed }` with `catch (e) { await handleEditFailure(ctx, retryBody, { reply_markup: retryKb }, e, 'rating'); return; }`

- [ ] **Step 4: Refactor the `confirm` step (lines 194-206)**

Same pattern — replace `catch { // Edit failed }` with `catch (e) { await handleEditFailure(ctx, preview, { parse_mode: 'HTML', reply_markup: confirmKb }, e, 'confirm'); return; }`

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All 230 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/handlers/message.ts
git commit -m "fix: message flow steps use handleEditFailure — prevent orphaned messages"
```

---

### Task 3: Refactor `callbackQuery.ts` `msg:confirm` handler

**Files:**

- Modify: `src/handlers/callbackQuery.ts:688-755`

**Interfaces:**

- Consumes: `getActiveMessage`, `handleEditFailure`, `pushMessage` (already imported on lines 16-20)

**Why:** The `msg:confirm` handler (line 707-715) uses `ctx.editMessageText().catch(() => ctx.reply())` — the same broken Pattern B that was fixed everywhere else. When edit succeeds, the stack isn't updated. When edit fails, the old message isn't cleaned up.

- [ ] **Step 1: Replace the bare catch with Pattern A**

Change lines 706-715 from:

```typescript
const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
await ctx
  .editMessageText('✅ پیام شما با موفقیت ارسال شد!\nادمین به زودی پاسخ خواهد داد.', {
    reply_markup: kb,
  })
  .catch(() =>
    ctx.reply('✅ پیام شما با موفقیت ارسال شد!\nادمین به زودی پاسخ خواهد داد.', {
      reply_markup: kb,
    }),
  );
```

to:

```typescript
const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
const body = '✅ پیام شما با موفقیت ارسال شد!\nادمین به زودی پاسخ خواهد داد.';
const active = getActiveMessage(ctx.session);
if (active) {
  try {
    await ctx.api.editMessageText(active.chatId, active.messageId, body, {
      reply_markup: kb,
    });
    active.state = 'sent';
    // fall through to admin notifications
  } catch (e) {
    await handleEditFailure(ctx, body, { reply_markup: kb }, e, 'sent');
    // fall through to admin notifications
  }
} else {
  const sent = await ctx.reply(body, { reply_markup: kb });
  const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'sent');
  if (evicted) {
    await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
  }
}
```

Note: Unlike other handlers, this one does NOT `return` after the edit — the admin notification code below must still execute. The edit/reply is just updating the user-facing message; the notification logic runs regardless.

- [ ] **Step 2: Run tests**

Run: `npx vitest run`
Expected: All 230 tests pass.

- [ ] **Step 3: Run full check**

Run: `npm run check`
Expected: typecheck✅ lint✅ format✅ test✅

- [ ] **Step 4: Commit**

```bash
git add src/handlers/callbackQuery.ts
git commit -m "fix: msg:confirm handler uses Pattern A — consistent stack management"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full check**

Run: `npm run check`
Expected: typecheck✅ lint✅ format✅ test✅ (230/230)

- [ ] **Step 2: Verify no remaining bare catches**

Run: `grep -rn 'catch {' src/handlers/ src/menus/` — should return no matches (all bare catches on editMessageText should be gone).

- [ ] **Step 3: Final commit if formatting changed**

```bash
git add -A && git commit -m "chore: formatting cleanup after menu lifecycle fixes"
```
