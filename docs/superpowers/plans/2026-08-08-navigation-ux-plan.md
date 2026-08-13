# Navigation & UX Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize admin Mini App from 11 bottom nav tabs to 6 grouped tabs, group bot menu from 12 buttons to 8, and add consistent micro-interactions across all surfaces.

**Architecture:** Create 3 new wrapper pages in admin-app (Insights, Configure, Info) that compose existing page components. Replace individual NavLink items in App.tsx with grouped tabs. Create 2 new bot menus (discoverMenu, infoMenu) and update mainMenu to use submenus. Add loading states, toasts, and optimistic updates to all mutation-driven pages.

**Tech Stack:** React + react-router-dom (admin-app), grammY Menu API (bot), @tanstack/react-query mutations (admin-app), CSS variables (index.css)

## Global Constraints

- All bot text is Persian (Farsi) with HTML parse mode
- Admin app uses `@telegram-apps/sdk` v2, `@tanstack/react-query`, react-router-dom HashRouter
- ESLint/Prettier is non-blocking in CI — lint baseline must not increase
- `npm test` (149 tests) must remain passing
- `npm run typecheck` must remain clean
- `admin-app npm run build` must remain clean
- Pages use React fragments (`<>...</>`) with `<div className="card">` sections (except MessagesPage)
- `MessagesPage` uses named export and `<div className="page">` wrapper — preserve this pattern
- Bottom nav overflow: `overflow-x: auto` with `flex-shrink: 0` — preserve for ≤6 tabs
- Old routes must redirect to new grouped routes for backward compat

---

## File Structure

### Admin App — New Files

| File                                    | Purpose                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `admin-app/src/pages/InsightsPage.tsx`  | Composes StreaksPage, FavoritesPage, AILogsPage, AITestPage as vertical cards |
| `admin-app/src/pages/ConfigurePage.tsx` | Composes SettingsPage, MenuConfigPage, AdminsPage as vertical cards           |
| `admin-app/src/pages/InfoPage.tsx`      | Composes AboutUsPage, ContentPage, MessagesPage as vertical cards             |

### Admin App — Modified Files

| File                                     | Changes                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `admin-app/src/App.tsx:113-201`          | Replace 11 NavLink items with 6 grouped tabs                                |
| `admin-app/src/App.tsx:66-109`           | Add `/insights`, `/configure`, `/info` routes; keep old routes as redirects |
| `admin-app/src/pages/ProductsPage.tsx`   | Add loading states on mutation buttons, success toasts                      |
| `admin-app/src/pages/CategoriesPage.tsx` | Add loading states on mutation buttons, success toasts                      |
| `admin-app/src/pages/AdminsPage.tsx`     | Add `disabled` to submit button during mutation, success toasts             |
| `admin-app/src/pages/SettingsPage.tsx`   | Add loading state on save button, success toast                             |
| `admin-app/src/pages/MenuConfigPage.tsx` | Add loading states, success toasts                                          |
| `admin-app/src/pages/AboutUsPage.tsx`    | Add loading states, success toasts                                          |
| `admin-app/src/pages/ContentPage.tsx`    | Add loading states, success toasts                                          |
| `admin-app/src/pages/MessagesPage.tsx`   | Add loading states on reply button, success toast                           |
| `admin-app/src/pages/ProductsPage.tsx`   | Add optimistic updates for toggle mutations                                 |
| `admin-app/src/pages/MenuConfigPage.tsx` | Add optimistic update for visibility toggle                                 |
| `admin-app/src/pages/ProductsPage.tsx`   | Improve empty state message                                                 |
| `admin-app/src/pages/CategoriesPage.tsx` | Improve empty state message                                                 |
| `admin-app/src/pages/AdminsPage.tsx`     | Improve empty state message                                                 |
| `admin-app/src/pages/FavoritesPage.tsx`  | Improve empty state message                                                 |
| `admin-app/src/pages/AILogsPage.tsx`     | Improve empty state message                                                 |
| `admin-app/src/pages/MessagesPage.tsx`   | Improve empty state message                                                 |
| `admin-app/src/pages/StreaksPage.tsx`    | Improve empty state message                                                 |

### Bot — New Files

| File                        | Purpose                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `src/menus/discoverMenu.ts` | Discover submenu: Featured, Seasonal, Passport, Search (4 buttons) |
| `src/menus/infoMenu.ts`     | Info submenu: About Us + FAQ (2 buttons)                           |

### Bot — Modified Files

| File                           | Changes                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/menus/mainMenu.ts:18-148` | Replace Featured, Seasonal, Passport, Search buttons with `discoverMenu` submenu; replace About, FAQ buttons with `infoMenu` submenu |
| `src/bot.ts:4-7,106-112`       | Import and register `discoverMenu` and `infoMenu`                                                                                    |

---

## Tasks

### Task 1: Create Admin Wrapper Pages (Insights, Configure, Info)

**Files:**

- Create: `admin-app/src/pages/InsightsPage.tsx`
- Create: `admin-app/src/pages/ConfigurePage.tsx`
- Create: `admin-app/src/pages/InfoPage.tsx`

**Interfaces:**

- Consumes: Existing page components (StreaksPage, FavoritesPage, AILogsPage, AITestPage, SettingsPage, MenuConfigPage, AdminsPage, AboutUsPage, ContentPage, MessagesPage) — all default exports except MessagesPage (named export)
- Produces: 3 new default-export React components that render existing pages as sections within a `<div className="card">` wrapper

Each wrapper page follows the existing fragment+card pattern. Inside each card section, render the child page's content with a heading and the child component. Use `<h2>` headings to distinguish sections.

**Pattern for each wrapper:**

```tsx
import React from 'react';
import SettingsPage from './SettingsPage';
import MenuConfigPage from './MenuConfigPage';
import AdminsPage from './AdminsPage';

export default function ConfigurePage() {
  return (
    <>
      <div className="card">
        <h2>⚙️ Settings</h2>
        <SettingsPage />
      </div>
      <div className="card">
        <h2>📋 Menu Config</h2>
        <MenuConfigPage />
      </div>
      <div className="card">
        <h2>👥 Admins</h2>
        <AdminsPage />
      </div>
    </>
  );
}
```

**Key detail:** Child pages that return fragments (`<>...</>`) will work inside a `<div className="card">` because fragments spread their children into the parent. However, child pages that have their own `<div className="card">` elements will create nested cards. This is acceptable visually — nested cards have reduced padding and the outer card provides section grouping. If visual testing shows issues, add a CSS class `.card-section > .card { margin-bottom: 0; padding: 12px; }` to flatten nesting.

**Steps:**

- [ ] **Step 1: Create InsightsPage.tsx**

```tsx
import React from 'react';
import StreaksPage from './StreaksPage';
import FavoritesPage from './FavoritesPage';
import AILogsPage from './AILogsPage';
import AITestPage from './AITestPage';

export default function InsightsPage() {
  return (
    <>
      <div className="card">
        <h2>🔥 Streaks</h2>
        <StreaksPage />
      </div>
      <div className="card">
        <h2>⭐ Favorites</h2>
        <FavoritesPage />
      </div>
      <div className="card">
        <h2>🤖 AI Logs</h2>
        <AILogsPage />
      </div>
      <div className="card">
        <h2>🧪 AI Test</h2>
        <AITestPage />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create ConfigurePage.tsx**

```tsx
import React from 'react';
import SettingsPage from './SettingsPage';
import MenuConfigPage from './MenuConfigPage';
import AdminsPage from './AdminsPage';

export default function ConfigurePage() {
  return (
    <>
      <div className="card">
        <h2>⚙️ Settings</h2>
        <SettingsPage />
      </div>
      <div className="card">
        <h2>📋 Menu Config</h2>
        <MenuConfigPage />
      </div>
      <div className="card">
        <h2>👥 Admins</h2>
        <AdminsPage />
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create InfoPage.tsx**

```tsx
import React from 'react';
import AboutUsPage from './AboutUsPage';
import ContentPage from './ContentPage';
import { MessagesPage } from './MessagesPage';

export default function InfoPage() {
  return (
    <>
      <div className="card">
        <h2>🏠 About Us</h2>
        <AboutUsPage />
      </div>
      <div className="card">
        <h2>📝 Content (FAQ)</h2>
        <ContentPage />
      </div>
      <div className="card">
        <h2>✉️ Messages</h2>
        <MessagesPage />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd admin-app && npm run build`
Expected: clean build, no errors

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/pages/InsightsPage.tsx admin-app/src/pages/ConfigurePage.tsx admin-app/src/pages/InfoPage.tsx
git commit -m "feat: add grouped wrapper pages for admin navigation reorg"
```

---

### Task 2: Reorganize Admin Bottom Nav + Routing

**Files:**

- Modify: `admin-app/src/App.tsx:66-109` (routes)
- Modify: `admin-app/src/App.tsx:113-201` (bottom nav)

**Interfaces:**

- Consumes: InsightsPage, ConfigurePage, InfoPage (from Task 1)
- Produces: Updated routing table with 6 grouped routes + redirect routes for old URLs; updated bottom nav with 6 NavLink items

**Steps:**

- [ ] **Step 1: Update imports in App.tsx**

Add these imports alongside existing ones:

```tsx
import InsightsPage from './pages/InsightsPage';
import ConfigurePage from './pages/ConfigurePage';
import InfoPage from './pages/InfoPage';
```

- [ ] **Step 2: Replace route definitions**

Replace the route block in `App.tsx:66-109` with:

```tsx
<Routes>
  <Route path="/products" element={<ProductsPage />} />
  <Route path="/categories" element={<CategoriesPage />} />
  {/* Grouped tabs */}
  <Route
    path="/insights"
    element={isSuperAdmin ? <InsightsPage /> : <Navigate to="/products" replace />}
  />
  <Route
    path="/configure"
    element={isSuperAdmin ? <ConfigurePage /> : <Navigate to="/products" replace />}
  />
  <Route path="/info" element={isSuperAdmin ? <InfoPage /> : <Navigate to="/products" replace />} />
  {/* Redirect old routes to grouped pages */}
  <Route path="/settings" element={<Navigate to="/configure" replace />} />
  <Route path="/branches" element={<Navigate to="/info" replace />} />
  <Route path="/faqs" element={<Navigate to="/info" replace />} />
  <Route path="/admins" element={<Navigate to="/configure" replace />} />
  <Route path="/menu-config" element={<Navigate to="/configure" replace />} />
  <Route path="/streaks" element={<Navigate to="/insights" replace />} />
  <Route path="/favorites" element={<Navigate to="/insights" replace />} />
  <Route path="/ai-logs" element={<Navigate to="/insights" replace />} />
  <Route path="/ai-test" element={<Navigate to="/insights" replace />} />
  <Route path="/messages" element={<Navigate to="/info" replace />} />
  <Route path="*" element={<Navigate to="/products" replace />} />
</Routes>
```

- [ ] **Step 3: Replace bottom nav with 6 grouped tabs**

Replace the nav block in `App.tsx:113-201` with:

```tsx
<nav className="bottom-nav" aria-label="Main navigation">
  <NavLink
    to="/products"
    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    onClick={scrollToTop}
  >
    <span className="nav-icon">📦</span>Products
  </NavLink>
  <NavLink
    to="/categories"
    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    onClick={scrollToTop}
  >
    <span className="nav-icon">🏷️</span>Categories
  </NavLink>
  {isSuperAdmin && (
    <>
      <NavLink
        to="/insights"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={scrollToTop}
      >
        <span className="nav-icon">📊</span>Insights
      </NavLink>
      <NavLink
        to="/configure"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={scrollToTop}
      >
        <span className="nav-icon">⚙️</span>Configure
      </NavLink>
      <NavLink
        to="/info"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={scrollToTop}
      >
        <span className="nav-icon">ℹ️</span>Info
      </NavLink>
    </>
  )}
</nav>
```

- [ ] **Step 4: Verify build**

Run: `cd admin-app && npm run build`
Expected: clean build, no errors

- [ ] **Step 5: Verify typecheck**

Run: `cd admin-app && npm run typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add admin-app/src/App.tsx
git commit -m "feat: reorganize admin bottom nav from 11 tabs to 6 grouped tabs"
```

---

### Task 3: Create Bot Discover Menu

**Files:**

- Create: `src/menus/discoverMenu.ts`

**Interfaces:**

- Consumes: `isMenuVisible`, `HIDDEN_MESSAGE` from `../utils/menuVisibility`; `ProductRepository`, `SettingsRepository` from `../repositories`; `formatProduct`, `DEFAULT_PRICE_UNIT` from `../utils/formatters`; `buildListPage` from `../utils/faqPagination`; `mainMenu` from `./mainMenu`; `MyContext` from `../types/context`
- Produces: `discoverMenu` — a grammY Menu with 4 buttons (Featured, Seasonal, Passport, Search) that gets registered on mainMenu

The Discover menu replaces 4 separate buttons in mainMenu. Each button's logic is copied directly from mainMenu.ts (lines 18-147) — the existing callback handlers for pagination (`featured:page:*`, `seasonal:page:*`, `passport:page:*`) remain unchanged.

**Steps:**

- [ ] **Step 1: Create discoverMenu.ts**

```typescript
import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { FaqRepository, ProductRepository, SettingsRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { formatProduct, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { mainMenu } from './mainMenu';
import { MyContext } from '../types/context';

async function loadPriceUnit(env: any): Promise<string> {
  return (await new SettingsRepository(env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
}

export const discoverMenu = new Menu<MyContext>('discover-menu')
  .text('⭐ پیشنهاد ویژه', async (ctx: any) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'featured'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const items = await new ProductRepository(ctx.env.DB).getByFlag('featured');
      if (items.length === 0) {
        await ctx.reply('📭 در حال حاضر محصول ویژه‌ای نداریم.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const page = buildListPage(items, 0, 5);
      const kb = new InlineKeyboard();
      for (const p of page.items) kb.text(p.name, `product:${p.id}`).row();
      if (page.hasNext) kb.text('◀️ صفحه بعد', `featured:page:1`);
      const body = `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx
        .answerCallbackQuery({ text: '❌ بارگذاری پیشنهاد ویژه ناموفق بود.' })
        .catch(() => {});
    }
  })
  .text('🌿 مخصوص فصل', async (ctx: any) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'seasonal'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const items = await new ProductRepository(ctx.env.DB).getByFlag('isSeasonal');
      if (items.length === 0) {
        await ctx.reply('📭 در حال حاضر محصول فصلی موجود نیست.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const page = buildListPage(items, 0, 5);
      const kb = new InlineKeyboard();
      for (const p of page.items) kb.text(p.name, `product:${p.id}`).row();
      if (page.hasNext) kb.text('◀️ صفحه بعد', `seasonal:page:1`);
      const body = `<b>🌿 مخصوص فصل</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx
        .answerCallbackQuery({ text: '❌ بارگذاری محصولات فصلی ناموفق بود.' })
        .catch(() => {});
    }
  })
  .text('📖 پاسپورت قهوه', async (ctx: any) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'passport'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const rows = await new ProductRepository(ctx.env.DB).getBeansWithCoffeeDetails();
      if (rows.length === 0) {
        await ctx.reply('📭 هنوز دانه قهوه‌ای با جزئیات کشت ثبت نشده است.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const page = buildListPage(rows, 0, 5);
      const origins = Array.from(
        new Set(page.items.map((r: any) => r.details?.origin).filter(Boolean)),
      );
      const originsLine =
        origins.length > 0
          ? `\n\n🗺 <b>${origins.length} کشور مبدا در این صفحه:</b> ${origins.join(' · ')}`
          : '';
      const kb = new InlineKeyboard();
      for (const r of page.items) {
        const p = r.product;
        const origin = r.details?.origin ? ` — ${r.details.origin}` : '';
        kb.text(`${p.name}${origin}`, `product:${p.id}`).row();
      }
      if (page.hasNext) kb.text('◀️ صفحه بعد', `passport:page:1`);
      const body = `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})${originsLine}\n\n${page.items.map((r: any) => formatProduct(r.product, priceUnit)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx
        .answerCallbackQuery({ text: '❌ بارگذاری پاسپورت قهوه ناموفق بود.' })
        .catch(() => {});
    }
  })
  .text('🔍 جستجو', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'search'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      await ctx.replyWithChatAction('typing');
      await ctx.reply('سؤال خود را بنویسید — دستیار هوشمند پاسخ می‌دهد 🤖', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  })
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = 'منوی اصلی:';
    await ctx
      .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu }));
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/menus/discoverMenu.ts
git commit -m "feat: add Discover submenu to consolidate Featured/Seasonal/Passport/Search"
```

---

### Task 4: Create Bot Info Menu

**Files:**

- Create: `src/menus/infoMenu.ts`

**Interfaces:**

- Consumes: `isMenuVisible`, `HIDDEN_MESSAGE` from `../utils/menuVisibility`; `BranchRepository`, `FaqRepository`, `SettingsRepository` from `../repositories`; `formatFaq`, `DEFAULT_PRICE_UNIT` from `../utils/formatters`; `buildListPage` from `../utils/faqPagination`; `mainMenu` from `./mainMenu`; `MyContext` from `../types/context`
- Produces: `infoMenu` — a grammY Menu with 2 buttons (About Us, FAQ) that gets registered on mainMenu

The Info menu replaces the separate About Us submenu and FAQ button from mainMenu. The About Us button reuses the existing `branchesMenu` pattern but as an inline handler. The FAQ button copies the logic from mainMenu.ts (lines 185-215).

**Steps:**

- [ ] **Step 1: Create infoMenu.ts**

```typescript
import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { BranchRepository, FaqRepository, SettingsRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { formatFaq, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { mainMenu } from './mainMenu';
import { MyContext } from '../types/context';

export const infoMenu = new Menu<MyContext>('info-menu')
  .text('🏠 درباره ما', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'branches'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const [aboutText, branches] = await Promise.all([
        new SettingsRepository(ctx.env.DB).getValue('about'),
        new BranchRepository(ctx.env.DB).getAllBranches(),
      ]);
      const kb = new InlineKeyboard();
      const activeBranches = branches.filter((b: any) => b.isActive !== false);
      for (const b of activeBranches) {
        kb.text(`📍 ${b.name}`, `branch:${b.id}`).row();
      }
      const body = aboutText
        ? `<b>🏠 درباره ما</b>\n\n${aboutText}`
        : '<b>🏠 درباره ما</b>\n\nاطلاعاتی ثبت نشده است.';
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود.' }).catch(() => {});
    }
  })
  .text('❓ سوالات متداول', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'faq'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const repo = new FaqRepository(ctx.env.DB);
      const faqs = await repo.getAll();
      if (faqs.length === 0) {
        await ctx.reply('📭 هنوز سوالی ثبت نشده است.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const page = buildListPage(faqs, 0, 5);
      const text = page.items.map((f: any) => formatFaq(f)).join('\n\n');
      const kb = new InlineKeyboard();
      if (page.hasNext) kb.text('◀️ صفحه بعد', `faq:page:1`);
      const body = `<b>سوالات متداول</b> (${page.pageLabel})\n\n${text}`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود.' }).catch(() => {});
    }
  })
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = 'منوی اصلی:';
    await ctx
      .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu }));
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/menus/infoMenu.ts
git commit -m "feat: add Info submenu to consolidate About Us and FAQ"
```

---

### Task 5: Update Bot Main Menu and Registration

**Files:**

- Modify: `src/menus/mainMenu.ts:18-215` — remove Featured, Seasonal, Passport, Search, About, FAQ buttons; replace with submenu references
- Modify: `src/bot.ts:4-7,106-112` — import and register discoverMenu, infoMenu

**Interfaces:**

- Consumes: `discoverMenu` from `./discoverMenu` (Task 3), `infoMenu` from `./infoMenu` (Task 4)
- Produces: Updated mainMenu with 8 buttons (Discover, Favorites, Drinks, Beans, Cakes, Info, Messages); updated bot.ts with 6 registered menus

**Steps:**

- [ ] **Step 1: Update mainMenu.ts imports**

Replace the import block at the top of `src/menus/mainMenu.ts`:

```typescript
import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { FavoritesRepository, SettingsRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { toPersianDigits } from '../utils/numbers';
import { discoverMenu } from './discoverMenu';
import { infoMenu } from './infoMenu';
import { MyContext } from '../types/context';
```

- [ ] **Step 2: Replace mainMenu body**

Replace the entire menu definition (lines 16-236) with:

```typescript
export const mainMenu = new Menu<MyContext>('main-menu')
  .submenu('🔍 کاوش', 'discover-menu')
  .text('⭐ منوهای من', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'favorites'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      if (!ctx.from?.id) return;
      const items = await new FavoritesRepository(ctx.env.DB).list(String(ctx.from.id));
      if (items.length === 0) {
        await ctx.reply('📭 هنوز محصولی به علاقمندی‌ها اضافه نکرده‌اید.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const kb = new InlineKeyboard();
      for (const p of items) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      await ctx.reply(
        `<b>⭐ منوهای من</b> (${toPersianDigits(items.length)} مورد)\n\nبرای دیدن جزئیات هر مورد، روی آن بزنید.`,
        { parse_mode: 'HTML', reply_markup: kb },
      );
    } catch (e) {
      console.error(e);
    }
  })
  .row()
  .submenu('☕ نوشیدنی‌ها', 'drinks-nav-menu')
  .submenu('🌱 دانه‌های قهوه', 'products-menu-beans')
  .row()
  .submenu('🍰 کیک و کوکی', 'products-menu-cakes')
  .row()
  .submenu('ℹ️ اطلاعات', 'info-menu')
  .text('✉️ پیام به ما', async (ctx: any) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'messages'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      ctx.session.messageFlow = { step: 'name' };
      await ctx.reply('نام شما چیست؟', {
        reply_markup: new InlineKeyboard()
          .text('⏭ ناشناس ارسال کن', 'rate:skip')
          .text('❌ انصراف', 'msg:cancel'),
      });
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  });
```

- [ ] **Step 3: Update bot.ts imports**

Add to the imports section at `src/bot.ts:4-7`:

```typescript
import { discoverMenu } from './menus/discoverMenu';
import { infoMenu } from './menus/infoMenu';
```

- [ ] **Step 4: Register new menus in bot.ts**

Update the registration block at `src/bot.ts:106-112`:

```typescript
// Register Menus
mainMenu.register(discoverMenu);
mainMenu.register(infoMenu);
mainMenu.register(drinksNavMenu);
mainMenu.register(beansMenu);
mainMenu.register(branchesMenu);
mainMenu.register(cakesMenu);

bot.use(mainMenu);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: 149/149 passing (no menu-related tests should break since callback handlers are unchanged)

- [ ] **Step 7: Commit**

```bash
git add src/menus/mainMenu.ts src/bot.ts
git commit -m "refactor: reorganize bot main menu with Discover and Info submenus"
```

---

### Task 6: Add Loading States + Success Toasts to Admin Mutation Pages

**Files:**

- Modify: `admin-app/src/pages/AdminsPage.tsx`
- Modify: `admin-app/src/pages/SettingsPage.tsx`
- Modify: `admin-app/src/pages/MenuConfigPage.tsx`
- Modify: `admin-app/src/pages/AboutUsPage.tsx`
- Modify: `admin-app/src/pages/ContentPage.tsx`
- Modify: `admin-app/src/pages/MessagesPage.tsx`
- Modify: `admin-app/src/pages/ProductsPage.tsx`
- Modify: `admin-app/src/pages/CategoriesPage.tsx`

**Pattern for loading states on buttons:**

```tsx
// Before:
<button type="submit" className="primary">Add Admin</button>

// After:
<button type="submit" className="primary" disabled={addAdminMutation.isPending}>
  {addAdminMutation.isPending ? '⏳...' : 'Add Admin'}
</button>
```

**Pattern for success toasts:**

```tsx
// In onSuccess callback:
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: queryKeys.admins });
  showToast('✅ Admin added', 'success');
  setAdminId('');
  setAdminCatId('');
},
```

**Steps:**

- [ ] **Step 1: Add loading states + toasts to AdminsPage.tsx**

In `admin-app/src/pages/AdminsPage.tsx`:

1. Extract `showToast` from `useAppContext()` (line 11: add to destructuring)
2. Add `disabled` and loading text to submit button (line 76-78):
   ```tsx
   <button type="submit" className="primary" disabled={addAdminMutation.isPending}>
     {addAdminMutation.isPending ? '⏳...' : 'Add Admin'}
   </button>
   ```
3. Add toast to `addAdminMutation.onSuccess` (line 25-29):
   ```tsx
   onSuccess: () => {
     void queryClient.invalidateQueries({ queryKey: queryKeys.admins });
     showToast('✅ Admin added', 'success');
     setAdminId('');
     setAdminCatId('');
   },
   ```
4. Add toast to `deleteAdminMutation.onSuccess` (line 36-38):
   ```tsx
   onSuccess: () => {
     void queryClient.invalidateQueries({ queryKey: queryKeys.admins });
     showToast('✅ Admin removed', 'success');
   },
   ```
5. Add `disabled` to delete button (line 95):
   ```tsx
   <button
     className="danger"
     onClick={() => deleteAdmin(a.id)}
     disabled={deleteAdminMutation.isPending}
   >
     Remove
   </button>
   ```

- [ ] **Step 2: Add loading states + toasts to SettingsPage.tsx**

Repeat the pattern for SettingsPage — find the save mutation, add `disabled` to submit button, add `showToast('✅ Settings saved', 'success')` in `onSuccess`.

- [ ] **Step 3: Add loading states + toasts to MenuConfigPage.tsx**

Repeat for MenuConfigPage — find add/delete mutations, add loading states and toasts.

- [ ] **Step 4: Add loading states + toasts to AboutUsPage.tsx**

Repeat for AboutUsPage — find save mutation, add loading state and toast.

- [ ] **Step 5: Add loading states + toasts to ContentPage.tsx**

Repeat for ContentPage — find add/delete mutations, add loading states and toasts.

- [ ] **Step 6: Add loading states + toasts to MessagesPage.tsx**

Repeat for MessagesPage — find reply mutation, add loading state and toast.

- [ ] **Step 7: Add loading states + toasts to ProductsPage.tsx**

Repeat for ProductsPage — find add/delete mutations, add loading states and toasts.

- [ ] **Step 8: Add loading states + toasts to CategoriesPage.tsx**

Repeat for CategoriesPage — find add/delete mutations, add loading states and toasts.

- [ ] **Step 9: Verify build**

Run: `cd admin-app && npm run build`
Expected: clean build

- [ ] **Step 10: Commit**

```bash
git add admin-app/src/pages/*.tsx
git commit -m "feat: add loading states and success toasts to all admin mutation pages"
```

---

### Task 7: Add Optimistic Updates for Toggle Operations

**Files:**

- Modify: `admin-app/src/pages/ProductsPage.tsx` — available/featured/seasonal toggle mutations
- Modify: `admin-app/src/pages/MenuConfigPage.tsx` — visibility toggle mutation

**Pattern for optimistic update:**

```tsx
useMutation({
  mutationFn: () => apiFetch(`/products/${id}/toggle`, { method: 'POST', body: { field } }),
  onMutate: async () => {
    await queryClient.cancelQueries({ queryKey: queryKeys.products });
    const prev = queryClient.getQueryData(queryKeys.products);
    queryClient.setQueryData(queryKeys.products, (old: any[] | undefined) =>
      old?.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p)),
    );
    return { prev };
  },
  onError: (_err, _vars, context) => {
    if (context?.prev) queryClient.setQueryData(queryKeys.products, context.prev);
    showToast('❌ Toggle failed', 'error');
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
});
```

**Steps:**

- [ ] **Step 1: Add optimistic updates to ProductsPage.tsx toggle mutations**

Find the available, featured, and seasonal toggle mutations in ProductsPage.tsx. For each, add `onMutate`, `onError` (with rollback), and `onSettled` (with invalidation). Keep the existing `onSuccess` toast.

- [ ] **Step 2: Add optimistic update to MenuConfigPage.tsx visibility toggle**

Find the visibility toggle mutation. Add `onMutate` (set `isVisible` optimistically), `onError` (rollback), `onSettled` (invalidate).

- [ ] **Step 3: Verify build**

Run: `cd admin-app && npm run build`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/pages/ProductsPage.tsx admin-app/src/pages/MenuConfigPage.tsx
git commit -m "feat: add optimistic updates for product and menu config toggles"
```

---

### Task 8: Improve Empty State Messages

**Files:**

- Modify: All pages with `<EmptyState>` components (see file list below)

**Pattern:**

```tsx
// Before:
<EmptyState message="No products yet." />

// After:
<EmptyState message="No products yet. Add your first product to get started." />
```

**Steps:**

- [ ] **Step 1: Update ProductsPage.tsx empty state**

Change: "No products yet" → "No products yet. Add your first product to get started."

- [ ] **Step 2: Update CategoriesPage.tsx empty state**

Change: "No categories" → "Categories help organize your menu. Add one to start."

- [ ] **Step 3: Update AdminsPage.tsx empty state**

Change: "No admins yet" → "No admins yet. Add a Telegram ID to grant admin access."

- [ ] **Step 4: Update FavoritesPage.tsx empty state**

Change current empty state → "Users' favorited products will appear here."

- [ ] **Step 5: Update AILogsPage.tsx empty state**

Change current empty state → "AI conversation logs will appear as users interact with the bot."

- [ ] **Step 6: Update MessagesPage.tsx empty state**

Change current empty state → "User messages and feedback will appear here."

- [ ] **Step 7: Update StreaksPage.tsx empty state**

Change current empty state → "User visit streaks will appear here once tracking is enabled."

- [ ] **Step 8: Verify build**

Run: `cd admin-app && npm run build`
Expected: clean build

- [ ] **Step 9: Commit**

```bash
git add admin-app/src/pages/*.tsx
git commit -m "feat: improve empty state messages with helpful guidance text"
```

---

### Task 9: Final Verification

**Files:** None (verification only)

**Steps:**

- [ ] **Step 1: Run root tests**

Run: `npm test`
Expected: 149/149 passing

- [ ] **Step 2: Run root typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Run root lint**

Run: `npm run lint`
Expected: no new warnings (baseline should not increase)

- [ ] **Step 4: Run admin-app build**

Run: `cd admin-app && npm run build`
Expected: clean build

- [ ] **Step 5: Run admin-app typecheck**

Run: `cd admin-app && npm run typecheck`
Expected: no errors

- [ ] **Step 6: Run admin-app lint**

Run: `cd admin-app && npm run lint`
Expected: no new warnings

- [ ] **Step 7: Verify git status is clean**

Run: `git status`
Expected: clean working tree (all changes committed)
