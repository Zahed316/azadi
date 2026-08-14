# Menu Duplication Fix — Contact/Cancel Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix menu duplication bugs where pressing contact then cancel leaves orphaned main menu messages, and audit all menu handlers for consistent message lifecycle management.

**Architecture:** Two root causes: (1) the contact flow sends a new message without cleaning up the main menu, and (2) several grammY menu handlers use `editMessageText().catch(() => ctx.reply())` which skips stack tracking when the edit succeeds. The fix standardizes on Pattern A (getActiveMessage → editMessageText with handleEditFailure fallback) everywhere, and adds pop+delete before new messages in non-menu contexts.

**Tech Stack:** TypeScript, grammY bot framework, Cloudflare Workers, D1 session storage

## Global Constraints

- All bot text is Persian (Farsi) with HTML parse mode
- Menu navigation uses `editMessageText` in-place with fresh-reply fallback
- `menuStack` in session tracks up to 4 messages (FIFO eviction)
- `handleEditFailure` pops the active message before creating fallback
- Tests: `src/tests/*.test.ts`, vitest with 30s timeout
- Do NOT use `drizzle-kit push` — D1 uses wrangler migrations

---

## Task 1: Fix contact flow — clean up main menu before sending contact prompt

**Files:**

- Modify: `src/menus/mainMenu.ts:89-111`

**Interfaces:**

- Consumes: `getActiveMessage`, `popMessage` from `src/utils/menuLifecycle.ts`
- Produces: Contact prompt message tracked on stack, main menu message deleted

The `✉️ پیام به ما` button handler currently calls `ctx.reply()` (new message) without cleaning up the main menu. This leaves the main menu visible below the contact prompt.

- [ ] **Step 1: Read the current contact handler**

Read `src/menus/mainMenu.ts` lines 89-111. Verify the handler sends a new message via `ctx.reply()` without any `getActiveMessage` / `popMessage` / `deleteMessage` calls.

- [ ] **Step 2: Add imports for popMessage**

In `src/menus/mainMenu.ts`, add `popMessage` to the import from `'../utils/menuLifecycle'`:

```typescript
import {
  pushMessage,
  getActiveMessage,
  handleEditFailure,
  popMessage,
} from '../utils/menuLifecycle';
```

- [ ] **Step 3: Add pop+delete before contact reply**

Replace the contact handler body (lines 91-110) with:

```typescript
async (ctx: MyContext) => {
  try {
    if (!(await isMenuVisible(ctx.dataService, 'messages'))) {
      await ctx.reply(HIDDEN_MESSAGE, {
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
      return;
    }
    ctx.session.messageFlow = { step: 'name' };

    // Pop and delete the current menu message from Telegram before
    // sending the contact prompt — prevents the orphaned-menu-below bug.
    const active = getActiveMessage(ctx.session);
    if (active) {
      popMessage(ctx.session);
      await ctx.api.deleteMessage(active.chatId, active.messageId).catch(() => {});
    }

    const sent = await ctx.reply('نام شما چیست؟', {
      reply_markup: new InlineKeyboard()
        .text('⏭ ناشناس ارسال کن', 'rate:skip')
        .text('❌ انصراف', 'msg:cancel'),
    });
    const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'contact');
    if (evicted) {
      await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    await ctx.reply('خطا در ارتباط با سرور.');
  }
},
```

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run src/tests/menu-lifecycle.test.ts`
Expected: All existing tests pass (no behavior change to menuLifecycle itself).

- [ ] **Step 5: Commit**

```bash
git add src/menus/mainMenu.ts
git commit -m "fix: contact flow cleans up main menu before sending prompt

Pop and delete the active menu message before sending the contact
prompt. Prevents orphaned main menu message below the contact flow."
```

---

## Task 2: Fix favorites flow — same orphaned-menu bug as contact

**Files:**

- Modify: `src/menus/mainMenu.ts:32-81`

**Interfaces:**

- Consumes: `getActiveMessage`, `popMessage` from `src/utils/menuLifecycle.ts`
- Produces: Favorites list message tracked on stack, main menu message deleted

The `⭐ منوهای من` (Favorites) button has the same bug — it sends new messages via `ctx.reply()` when items exist, without cleaning up the main menu.

- [ ] **Step 1: Read the favorites handler**

Read `src/menus/mainMenu.ts` lines 32-81. Verify the handler sends a new message when `items.length > 0` without any `popMessage` / `deleteMessage` calls.

- [ ] **Step 2: Add pop+delete before favorites reply**

Replace the favorites handler body (lines 33-80) with:

```typescript
async (ctx: MyContext) => {
  try {
    if (!(await isMenuVisible(ctx.dataService, 'favorites'))) {
      await ctx.reply(HIDDEN_MESSAGE, {
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
      return;
    }
    if (!ctx.from?.id) return;
    const items = await ctx.dataService.list(String(ctx.from.id));
    if (items.length === 0) {
      await ctx.reply('📭 هنوز محصولی به علاقمندی‌ها اضافه نکرده‌اید.', {
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
      return;
    }
    const kb = new InlineKeyboard();
    for (let i = 0; i < items.length; i++) {
      kb.text(items[i].name, `product:${items[i].id}`);
      if (i % 2 === 1 || i === items.length - 1) kb.row();
    }
    kb.row();
    kb.text('🔙 بازگشت به منو', 'back:main');
    const body = `<b>⭐ منوهای من</b> (${toPersianDigits(items.length)} مورد)\n\nبرای دیدن جزئیات هر مورد، روی آن بزنید.`;

    // Pop and delete the current menu message before sending favorites
    const active = getActiveMessage(ctx.session);
    if (active) {
      popMessage(ctx.session);
      await ctx.api.deleteMessage(active.chatId, active.messageId).catch(() => {});
    }

    const sent = await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'favorites');
    if (evicted) {
      await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
    }
  } catch (e) {
    console.error(e);
  }
},
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/tests/menu-lifecycle.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/menus/mainMenu.ts
git commit -m "fix: favorites flow cleans up main menu before sending list

Pop and delete the active menu message before sending the favorites
list. Prevents orphaned main menu message below the favorites view."
```

---

## Task 3: Fix info menu handlers — edit-then-push desync

**Files:**

- Modify: `src/menus/infoMenu.ts:12-111`

**Interfaces:**

- Consumes: `getActiveMessage`, `pushMessage` from `src/utils/menuLifecycle.ts`
- Produces: Stack stays in sync after successful edits

The `infoMenu` handlers use `ctx.editMessageText().catch(() => ctx.reply(...))` then `pushMessage()`. When `editMessageText` succeeds, it returns `True` (not a message object), so the `typeof sent === 'object'` check fails and nothing is pushed — the stack is now desynced from the actual Telegram message.

The fix: adopt Pattern A (getActiveMessage → editMessageText with handleEditFailure fallback) like `drinksNavMenu` does.

- [ ] **Step 1: Update imports**

In `src/menus/infoMenu.ts`, replace the import line:

```typescript
import { pushMessage, getActiveMessage, handleEditFailure } from '../utils/menuLifecycle';
```

- [ ] **Step 2: Fix the "درباره ما" (About) handler**

Replace lines 13-55 with:

```typescript
.text('🏠 درباره ما', async (ctx) => {
  try {
    if (!(await isMenuVisible(ctx.dataService, 'branches'))) {
      const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, HIDDEN_MESSAGE, {
            parse_mode: 'HTML',
            reply_markup: backKb,
          });
          active.state = 'hidden:branches';
          return;
        } catch (e) {
          await handleEditFailure(ctx, HIDDEN_MESSAGE, { parse_mode: 'HTML', reply_markup: backKb }, e);
          return;
        }
      }
      await ctx.reply(HIDDEN_MESSAGE, { reply_markup: backKb });
      return;
    }
    const [aboutText, branches] = await Promise.all([
      ctx.dataService.getSetting('about'),
      ctx.dataService.getAllBranches(),
    ]);
    const kb = new InlineKeyboard();
    const activeBranches = branches.filter(
      (b: typeof branchesTable.$inferSelect) => b.isActive !== false,
    );
    for (let i = 0; i < activeBranches.length; i++) {
      kb.text(`📍 ${activeBranches[i].name}`, `branch:${activeBranches[i].id}`);
      if (i % 2 === 1 || i === activeBranches.length - 1) kb.row();
    }
    kb.row();
    kb.text('🔙 بازگشت به منو', 'back:main');
    const body = aboutText
      ? `<b>🏠 درباره ما</b>\n\n${escapeHtml(aboutText)}`
      : '<b>🏠 درباره ما</b>\n\nاطلاعاتی ثبت نشده است.';
    const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
    const active = getActiveMessage(ctx.session);
    if (active) {
      try {
        await ctx.api.editMessageText(active.chatId, active.messageId, body, msgOpts);
        active.state = 'about';
        return;
      } catch (e) {
        await handleEditFailure(ctx, body, msgOpts, e);
        return;
      }
    }
    const sent = await ctx.reply(body, msgOpts);
    const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'about');
    if (evicted) {
      await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود.' }).catch(() => {});
  }
})
```

- [ ] **Step 3: Fix the "سوالات متداول" (FAQ) handler**

Replace lines 57-97 with:

```typescript
.text('❓ سوالات متداول', async (ctx: MyContext) => {
  try {
    if (!(await isMenuVisible(ctx.dataService, 'faq'))) {
      const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, HIDDEN_MESSAGE, {
            parse_mode: 'HTML',
            reply_markup: backKb,
          });
          active.state = 'hidden:faq';
          return;
        } catch (e) {
          await handleEditFailure(ctx, HIDDEN_MESSAGE, { parse_mode: 'HTML', reply_markup: backKb }, e);
          return;
        }
      }
      await ctx.reply(HIDDEN_MESSAGE, { reply_markup: backKb });
      return;
    }
    const faqs = await ctx.dataService.getAllFaqs();
    if (faqs.length === 0) {
      const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, '📭 هنوز سوالی ثبت نشده است.', {
            parse_mode: 'HTML',
            reply_markup: backKb,
          });
          active.state = 'empty:faq';
          return;
        } catch (e) {
          await handleEditFailure(ctx, '📭 هنوز سوالی ثبت نشده است.', { parse_mode: 'HTML', reply_markup: backKb }, e);
          return;
        }
      }
      await ctx.reply('📭 هنوز سوالی ثبت نشده است.', { reply_markup: backKb });
      return;
    }
    const page = buildListPage(faqs, 0, 5);
    const text = page.items.map((f: typeof faqTable.$inferSelect) => formatFaq(f)).join('\n\n');
    const kb = new InlineKeyboard();
    if (page.hasNext) kb.text('◀️ صفحه بعد', `faq:page:1`);
    kb.row();
    kb.text('🔙 بازگشت به منو', 'back:main');
    const body = `<b>سوالات متداول</b> (${page.pageLabel})\n\n${text}`;
    const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
    const active = getActiveMessage(ctx.session);
    if (active) {
      try {
        await ctx.api.editMessageText(active.chatId, active.messageId, body, msgOpts);
        active.state = 'faq';
        return;
      } catch (e) {
        await handleEditFailure(ctx, body, msgOpts, e);
        return;
      }
    }
    const sent = await ctx.reply(body, msgOpts);
    const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'faq');
    if (evicted) {
      await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود.' }).catch(() => {});
  }
})
```

- [ ] **Step 4: Fix the "↩️ بازگشت" (Back) handler**

Replace lines 98-111 with:

```typescript
.row()
.text('↩️ بازگشت', async (ctx) => {
  await ctx.answerCallbackQuery();
  const body = await getWelcomeText(ctx.dataService);
  const active = getActiveMessage(ctx.session);
  if (active) {
    try {
      await ctx.api.editMessageText(active.chatId, active.messageId, body, {
        parse_mode: 'HTML',
        reply_markup: mainMenu,
      });
      active.state = 'main';
      return;
    } catch (e) {
      await handleEditFailure(ctx, body, { parse_mode: 'HTML', reply_markup: mainMenu }, e);
      return;
    }
  }
  const sent = await ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu });
  const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'main');
  if (evicted) await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/tests/menu-lifecycle.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/menus/infoMenu.ts
git commit -m "fix: info menu handlers use Pattern A for consistent stack tracking

Replace edit-then-push pattern with getActiveMessage + editMessageText
+ handleEditFailure fallback. Prevents stack desync when edits succeed."
```

---

## Task 4: Fix products menu handlers — same edit-then-push desync

**Files:**

- Modify: `src/menus/productsMenu.ts:21-86` (cakes menu)
- Modify: `src/menus/productsMenu.ts:88-155` (beans menu)

**Interfaces:**

- Consumes: `getActiveMessage`, `handleEditFailure`, `pushMessage` from `src/utils/menuLifecycle.ts`
- Produces: Stack stays in sync after successful edits

The `cakesMenu` and `beansMenu` handlers use the same broken `ctx.editMessageText().catch(() => ctx.reply())` + `pushMessage()` pattern.

- [ ] **Step 1: Update imports**

In `src/menus/productsMenu.ts`, replace the import line:

```typescript
import { pushMessage, getActiveMessage, handleEditFailure } from '../utils/menuLifecycle';
```

- [ ] **Step 2: Fix cakes menu handler**

Replace the cakes handler body (lines 22-67) with Pattern A:

```typescript
.text('🍰 کیک و کوکی', async (ctx) => {
  try {
    if (!(await isMenuVisible(ctx.dataService, 'cakes'))) {
      const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, HIDDEN_MESSAGE, {
            parse_mode: 'HTML',
            reply_markup: backKb,
          });
          active.state = 'hidden:cakes';
          return;
        } catch (e) {
          await handleEditFailure(ctx, HIDDEN_MESSAGE, { parse_mode: 'HTML', reply_markup: backKb }, e);
          return;
        }
      }
      await ctx.reply(HIDDEN_MESSAGE, { reply_markup: backKb });
      return;
    }
    const repo = new ProductRepository(ctx.env.DB);
    const menuRepo = new MenuConfigRepository(ctx.env.DB);
    const configs = await menuRepo.getBySection('cakes');
    const products =
      configs.length > 0 ? await repo.getProductsByCategory(configs[0].categoryId) : [];

    if (products.length === 0) {
      const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const emptyText = '📭 در حال حاضر کیک یا کوکی موجود نیست.';
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, emptyText, {
            parse_mode: 'HTML',
            reply_markup: backKb,
          });
          active.state = 'empty:cakes';
          return;
        } catch (e) {
          await handleEditFailure(ctx, emptyText, { parse_mode: 'HTML', reply_markup: backKb }, e);
          return;
        }
      }
      await ctx.reply(emptyText, { reply_markup: backKb });
      return;
    }

    const page = buildListPage(products, 0, PRODUCTS_PAGE_SIZE);
    const kb = new InlineKeyboard();
    for (let i = 0; i < page.items.length; i++) {
      kb.text(page.items[i].name, `product:${page.items[i].id}`);
      if (i % 2 === 1 || i === page.items.length - 1) kb.row();
    }
    if (page.hasPrev) kb.text('صفحه قبل ▶️', `${CAKES_PAGE_PREFIX}${0 - 1}`);
    if (page.hasNext) kb.text('◀️ صفحه بعد', `${CAKES_PAGE_PREFIX}${0 + 1}`);
    if (page.hasPrev || page.hasNext) kb.row();
    kb.row();
    kb.text('🔙 بازگشت به منو', 'back:main');

    const body = `<b>کیک و کوکی</b> (${page.pageLabel})\n\nیک کیک یا کوکی انتخاب کنید:`;
    const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
    const active = getActiveMessage(ctx.session);
    if (active) {
      try {
        await ctx.api.editMessageText(active.chatId, active.messageId, body, msgOpts);
        active.state = 'cakes';
        return;
      } catch (e) {
        await handleEditFailure(ctx, body, msgOpts, e);
        return;
      }
    }
    const sent = await ctx.reply(body, msgOpts);
    const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'cakes');
    if (evicted) {
      await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCallbackQuery({ text: '❌ بارگذاری کیک‌ها ناموفق بود.' }).catch(() => {});
  }
})
```

- [ ] **Step 3: Fix beans menu handler**

Apply the same Pattern A transformation to the beans handler (lines 89-135). The structure is identical — replace `ctx.editMessageText().catch(() => ctx.reply())` + `pushMessage()` with `getActiveMessage` → `editMessageText` with `handleEditFailure` fallback → `pushMessage`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/tests/menu-lifecycle.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/menus/productsMenu.ts
git commit -m "fix: products menu handlers use Pattern A for consistent stack tracking

Replace edit-then-push pattern with getActiveMessage + editMessageText
+ handleEditFailure fallback. Prevents stack desync when edits succeed."
```

---

## Task 5: Fix message flow handlers — /cancel and message:text steps

**Files:**

- Modify: `src/handlers/message.ts:68-202`

**Interfaces:**

- Consumes: `getActiveMessage` from `src/utils/menuLifecycle.ts`
- Produces: Message flow steps properly use edit-in-place without creating orphaned messages

The message flow handlers (`/cancel`, `name` step, `content` step, `rating` step) all follow the same pattern: try `editMessageText`, fall through to `reply` on failure. This is correct for the message flow (each step edits the same message), but the `/cancel` handler in `message.ts` doesn't use `handleEditFailure` — it just catches and falls through to `reply`, which could leave an orphan.

- [ ] **Step 1: Fix /cancel handler to use handleEditFailure**

In `src/handlers/message.ts`, update the `/cancel` handler (lines 74-92):

```typescript
if (text === '/cancel') {
  ctx.session.messageFlow = undefined;
  const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
  const body = '❌ ارسال پیام لغو شد.';
  const active = getActiveMessage(ctx.session);
  if (active) {
    try {
      await ctx.api.editMessageText(active.chatId, active.messageId, body, {
        reply_markup: backKb,
      });
      active.state = 'cancelled';
      return;
    } catch (e) {
      await handleEditFailure(ctx, body, { reply_markup: backKb }, e);
      return;
    }
  }
  await ctx.reply(body, { reply_markup: backKb });
  return;
}
```

Add `handleEditFailure` to the imports in `message.ts`:

```typescript
import { getActiveMessage, handleEditFailure } from '../utils/menuLifecycle';
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/tests/menu-lifecycle.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/handlers/message.ts
git commit -m "fix: message flow /cancel uses handleEditFailure for orphan cleanup

Prevents orphaned messages when editMessageText fails during cancel."
```

---

## Task 6: Full audit — verify all menu handlers follow Pattern A

**Files:**

- Review: `src/menus/mainMenu.ts`
- Review: `src/menus/infoMenu.ts`
- Review: `src/menus/productsMenu.ts`
- Review: `src/menus/drinksNavMenu.ts`
- Review: `src/menus/discoverMenu.ts`
- Review: `src/handlers/callbackQuery.ts`

**Interfaces:**

- Consumes: None (read-only audit)
- Produces: Verified checklist of all handlers

This is a verification task — no code changes. Walk through every callback handler and menu button handler to confirm they all follow Pattern A:

```
const active = getActiveMessage(ctx.session);
if (active) {
  try {
    await ctx.api.editMessageText(active.chatId, active.messageId, body, opts);
    active.state = newState;
    return;
  } catch (e) {
    await handleEditFailure(ctx, body, opts, e);
    return;
  }
}
const sent = await ctx.reply(body, opts);
const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, newState);
if (evicted) await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
```

- [ ] **Step 1: Audit callbackQuery.ts handlers**

Check every handler in `src/handlers/callbackQuery.ts`:

- `back:main` — ✓ uses pop+delete+reply (Pattern B for back navigation)
- `faq:page:*` — ✓ uses Pattern A
- `branches:page:*` — ✓ uses Pattern A
- `beans:page:*` — ✓ uses Pattern A
- `cakes:page:*` — ✓ uses Pattern A
- `drinks:cat:*:page:*` — ✓ delegates to `buildCategoryPage` (Pattern A)
- `branch:*` — ✓ uses Pattern A
- `product:*` — ✓ uses Pattern A (with photo special case)
- `featured:page:*` — ✓ uses Pattern A
- `seasonal:page:*` — ✓ uses Pattern A
- `passport:page:*` — ✓ uses Pattern A
- `fav:add:*` / `fav:remove:*` — ✓ uses Pattern A
- `msg:confirm` — uses editMessageText().catch(() => reply()) — **no stack management**
- `msg:cancel` — ✓ uses Pattern A
- `rate:skip` — ✓ uses Pattern A
- `rate:*` — ✓ uses Pattern A

- [ ] **Step 2: Audit discoverMenu.ts handlers**

Check every handler in `src/menus/discoverMenu.ts`:

- `featured` — ✓ uses Pattern A
- `seasonal` — ✓ uses Pattern A
- `passport` — ✓ uses Pattern A
- `search` — ✓ uses Pattern A
- `↩️ بازگشت` — ✓ uses Pattern A

- [ ] **Step 3: Audit drinksNavMenu.ts handlers**

Check every handler in `src/menus/drinksNavMenu.ts`:

- Hidden state handler — ✓ uses Pattern A
- Category handlers — ✓ delegate to `buildCategoryPage` (Pattern A)
- `↩️ بازگشت` — ✓ uses Pattern A

- [ ] **Step 4: Audit mainMenu.ts handlers (post-fix)**

Check after Tasks 1-2:

- `⭐ منوهای من` — ✓ fixed in Task 2
- `✉️ پیام به ما` — ✓ fixed in Task 1

- [ ] **Step 5: Audit infoMenu.ts handlers (post-fix)**

Check after Task 3:

- `🏠 درباره ما` — ✓ fixed in Task 3
- `❓ سوالات متداول` — ✓ fixed in Task 3
- `↩️ بازگشت` — ✓ fixed in Task 3

- [ ] **Step 6: Audit productsMenu.ts handlers (post-fix)**

Check after Task 4:

- `🍰 کیک و کوکی` — ✓ fixed in Task 4
- `🌱 دانه‌های قهوه` — ✓ fixed in Task 4
- `↩️ بازگشت` (both) — uses editMessageText().catch(() => reply()) + pushMessage — **needs fix**

- [ ] **Step 7: Fix productsMenu back buttons**

The `↩️ بازگشت` buttons in both `cakesMenu` and `beansMenu` (lines 74-86 and 143-155) use the broken edit-then-push pattern. Apply Pattern A:

```typescript
.text('↩️ بازگشت', async (ctx) => {
  await ctx.answerCallbackQuery();
  const body = await getWelcomeText(ctx.dataService);
  const active = getActiveMessage(ctx.session);
  if (active) {
    try {
      await ctx.api.editMessageText(active.chatId, active.messageId, body, {
        parse_mode: 'HTML',
        reply_markup: mainMenu,
      });
      active.state = 'main';
      return;
    } catch (e) {
      await handleEditFailure(ctx, body, { parse_mode: 'HTML', reply_markup: mainMenu }, e);
      return;
    }
  }
  const sent = await ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu });
  const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'main');
  if (evicted) await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
});
```

- [ ] **Step 8: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/menus/productsMenu.ts
git commit -m "fix: products menu back buttons use Pattern A for consistent stack tracking"
```

---

## Task 7: Run full verification

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No new errors (existing warnings acceptable).

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 4: Verify contact flow manually (if possible)**

If a test environment is available, simulate:

1. User sends `/start` → main menu appears
2. User presses "✉️ پیام به ما" → main menu should be DELETED, contact prompt appears as single message
3. User presses "❌ انصراف" → message edited to "cancelled" in-place
4. User presses "🔙 بازگشت به منو" → cancelled message DELETED, fresh main menu appears (single message)
