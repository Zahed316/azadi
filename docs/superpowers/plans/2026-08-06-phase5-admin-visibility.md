# Phase 5 Admin Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing Phase 5.1 (Streak, `user_state`) and Phase 5.2 (Favorites, `favorites`) tables to super_admins in the admin mini app, as two separate read-mostly pages, with one narrowly-scoped delete action on favorites (stdout audit log only).

**Architecture:** Add two read endpoints + one delete endpoint to the Worker, gated by the existing `adminAuth` and the existing `requireSuperAdmin` (or per-route super-admin check) pattern. Extend two repositories with one method each (`UserStateRepository.listAll`, `FavoritesRepository.listAllGrouped`). Add three new files to the admin mini app (`StatTile.tsx`, `StreaksPage.tsx`, `FavoritesPage.tsx`), wire two new routes and two new bottom-nav links in `App.tsx`, and add one CSS class. No schema changes, no new env vars, no new dependencies.

**Tech Stack:** Cloudflare Workers, D1 (Drizzle ORM), grammY, React 18 + Vite + @tanstack/react-query (admin app), vitest (worker tests). No new tooling.

**Spec:** `docs/superpowers/specs/2026-08-06-phase5-admin-visibility-design.md` (commit `7aa8374`).

## Global Constraints

These apply to every task. Do not deviate.

- **Admin mini app API base is hardcoded** in `admin-app/src/api/client.ts:3` as `https://azadi-coffee-bot.zahedrastgar316.workers.dev/api`. New endpoints must match this prefix.
- **The Worker (root) and the admin mini app are separate packages** with separate `node_modules`. Run `npm install` independently in each.
- **Lint is non-blocking in CI** but the project's count baseline is **root: 137 warnings, admin-app: 294 warnings** (per project memory `subagent-brief-lint-baseline-language`). Do not increase either count. Phrase the lint gate as a COUNT, not a category.
- **The in-memory D1 test harness** (`src/tests/_helpers/routerHarness.ts`) only handles single-`eq` predicates — `and`/`or`/`gt`/`sql` silently no-op (project memory `phase-5-harness-gaps`). **The new tests in this plan must NOT add WHERE clauses to the harness paths** — the new repo methods (`listAll`, `listAllGrouped`) use no WHERE, and the new router tests must not introduce one. If a test needs filtering, that's a code smell — rethink the test.
- **The snake→camel column-name fix** lives in the harness's `extractEq()` (the `replace(/_([a-z0-9])/g, ...)` line). Do not remove it.
- **All bot-side text is Persian with HTML parse mode**, but the mini app is English (operator-facing). The mini app's UI strings stay English. Persian digits (`toPersianDigits` from `src/utils/numbers.ts` or equivalent) are used for numeric values that mirror the bot (e.g. streak counts, visit counts).
- **D1 `database_id` is hardcoded in `wrangler.toml`**. Do not change.
- **`/usr/bin/env` is broken on Termux.** All npm scripts in this repo use `node ./node_modules/...` shebang-free invocations. Do not introduce new shebangs.
- **No commits to `main`.** Implementation happens on a feature branch. The plan ends with opening a PR.

---

## File Structure

Before defining tasks, here is the complete file map for this plan.

### New files (4)

| Path | Responsibility |
|---|---|
| `admin-app/src/components/StatTile.tsx` | Reusable presentational stat tile (label + value + hint) |
| `admin-app/src/pages/StreaksPage.tsx` | Streaks page: 4 tiles + sortable user table |
| `admin-app/src/pages/FavoritesPage.tsx` | Favorites page: 3 tiles + "group by" toggle + table with per-row remove |
| `src/tests/router-engagement.test.ts` | 6 router test cases for the 3 new endpoints |

### Modified files (7)

| Path | Change |
|---|---|
| `src/repositories/index.ts` | +2 methods (`UserStateRepository.listAll`, `FavoritesRepository.listAllGrouped`) |
| `src/api/router.ts` | +3 routes (`GET /api/streaks`, `GET /api/favorites`, `DELETE /api/favorites/:tg/:pid`) |
| `src/tests/phase-5-repos.test.ts` | +2 new test cases for the new repo methods |
| `admin-app/src/api/keys.ts` | +2 query keys (`streaks`, `favorites`) |
| `admin-app/src/App.tsx` | +2 `<Route>` elements, +2 `<NavLink>` elements in the super-admin fragment |
| `admin-app/src/index.css` | +1 class (`.stat-tile`) |
| (none) | No new package.json entries, no wrangler.toml changes, no schema/migration files |

### Files this plan does NOT touch (and you must not touch)

- `src/bot.ts`, `src/menus/mainMenu.ts`, `src/handlers/callbackQuery.ts`, `src/scripts/streaks.ts` — Phase 5 bot/cron code stays exactly as it is.
- `src/database/schema.ts`, `drizzle/` — no schema changes.
- `wrangler.toml`, `package.json` (root or admin-app), `tsconfig.*` — no config changes.
- `CLAUDE.md`, `AGENTS.md` — the spec already documents the new feature; the project docs need no update for this work.

---

## Task Decomposition

This plan has **8 tasks across 3 logical chunks**. Each task produces a self-contained, reviewable, committable unit of work.

**Chunk A — Server foundation (Tasks 1–3):** the two new repo methods, the new router endpoints, and the new tests. After this chunk, `npm test` covers the new endpoints end-to-end and the worker typechecks.

**Chunk B — Mini app foundation (Tasks 4–5):** the query keys and the reusable `StatTile` component. After this chunk, the admin app builds and typechecks.

**Chunk C — Pages and wiring (Tasks 6–8):** the two new pages, the App.tsx wiring (routes + nav links), the CSS, and the final verification gate. After this chunk, the feature is end-to-end functional and all five verification gates pass.

The chunks correspond to logical Opus subagent dispatches if executing via the workflow tool. Each chunk ends with its own commit and verification.

---

### Task 1: Add `UserStateRepository.listAll()`

**Files:**
- Modify: `src/repositories/index.ts:384-467` (the `UserStateRepository` class)
- Test: `src/tests/phase-5-repos.test.ts` (extend existing file)

**Interfaces:**
- Consumes: existing `userState` schema (from `src/database/schema.ts:107-114`), existing `getDb` factory.
- Produces: `UserStateRepository.listAll(): Promise<Array<typeof userState.$inferSelect>>` — returns every row ordered by `streakDays DESC, lastSeenAt DESC`.

- [ ] **Step 1: Write the failing test in `src/tests/phase-5-repos.test.ts`**

Open the existing file and find a `describe('UserStateRepository', ...)` block (or create one if absent). Add this test at the end of the block:

```typescript
describe('UserStateRepository.listAll', () => {
  beforeEach(() => clearStore());

  it('returns all user_state rows ordered by streakDays DESC then lastSeenAt DESC', async () => {
    seedTable(userState, [
      { telegramId: 'u1', firstSeenAt: new Date('2026-01-01'), lastSeenAt: new Date('2026-08-01'), visitsTotal: 5, streakDays: 3 },
      { telegramId: 'u2', firstSeenAt: new Date('2026-01-01'), lastSeenAt: new Date('2026-08-05'), visitsTotal: 10, streakDays: 7 },
      { telegramId: 'u3', firstSeenAt: new Date('2026-01-01'), lastSeenAt: new Date('2026-08-03'), visitsTotal: 2, streakDays: 7 },
    ]);
    const repo = new UserStateRepository(makeMockD1());
    const rows = await repo.listAll();
    expect(rows.map((r) => r.telegramId)).toEqual(['u2', 'u3', 'u1']);
  });

  it('returns an empty array when the table is empty', async () => {
    const repo = new UserStateRepository(makeMockD1());
    const rows = await repo.listAll();
    expect(rows).toEqual([]);
  });
});
```

If `makeMockD1` is not already exported from the test file, the test file's `clearStore`/`seedTable` pattern is what you need — use whatever helper the existing tests in the file use to build a `D1Database`-shaped mock. Read the first 50 lines of `src/tests/phase-5-repos.test.ts` before writing this to copy the local idiom.

- [ ] **Step 2: Run the test to verify it fails**

Run from repo root:
```bash
npx vitest run src/tests/phase-5-repos.test.ts
```
Expected: FAIL with `TypeError: repo.listAll is not a function` (or similar). If it fails for a different reason (e.g. import error), fix the test scaffolding first.

- [ ] **Step 3: Add the `listAll` method to `UserStateRepository`**

In `src/repositories/index.ts`, inside the `UserStateRepository` class (after the `getByTelegramId` method around line 394), add:

```typescript
/**
 * Admin read: return every user_state row, ordered by streak length then
 * most-recent activity. No WHERE clause — the admin surface sees every
 * tracked user. No pagination (the table is small in practice).
 */
async listAll() {
  return await this.db
    .select()
    .from(userState)
    .orderBy(desc(userState.streakDays), desc(userState.lastSeenAt));
}
```

Add `desc` to the existing `import { eq, and, desc, lt, sql } from 'drizzle-orm';` line at the top of the file if not already imported — it is, per the existing imports.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/phase-5-repos.test.ts
```
Expected: PASS for both new cases, and all pre-existing tests in the file still pass.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/index.ts src/tests/phase-5-repos.test.ts
git commit -m "feat(repo): UserStateRepository.listAll for admin read surface"
```

---

### Task 2: Add `FavoritesRepository.listAllGrouped()`

**Files:**
- Modify: `src/repositories/index.ts:471-555` (the `FavoritesRepository` class)
- Test: `src/tests/phase-5-repos.test.ts` (extend existing file)

**Interfaces:**
- Consumes: existing `favorites` and `products` schemas, existing `getDb` factory.
- Produces: `FavoritesRepository.listAllGrouped(): Promise<Array<{ telegramId: string; productId: number; productName: string | null; favoritedAt: Date }>>` — flat list, `LEFT JOIN` to products (so orphan favorites appear with `productName: null`), ordered by `favorites.createdAt DESC`. The "grouped" name reflects client-side aggregation in the page; the repo itself returns a flat list.

- [ ] **Step 1: Write the failing test**

In the same `src/tests/phase-5-repos.test.ts` file, find or create a `describe('FavoritesRepository', ...)` block. Add:

```typescript
describe('FavoritesRepository.listAllGrouped', () => {
  beforeEach(() => clearStore());

  it('returns all favorites joined with their product name, ordered by createdAt DESC', async () => {
    seedTable(products, [
      { id: 10, name: 'Espresso', categoryId: 1, price: 0, stock: 0, unit: 'cup', available: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') },
      { id: 20, name: 'Latte',    categoryId: 1, price: 0, stock: 0, unit: 'cup', available: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') },
    ]);
    seedTable(favorites, [
      { telegramId: 'u1', productId: 10, createdAt: new Date('2026-08-01') },
      { telegramId: 'u1', productId: 20, createdAt: new Date('2026-08-05') },
      { telegramId: 'u2', productId: 10, createdAt: new Date('2026-08-03') },
    ]);
    const repo = new FavoritesRepository(makeMockD1());
    const rows = await repo.listAllGrouped();
    expect(rows.map((r) => r.productId)).toEqual([20, 10, 10]);
    expect(rows.find((r) => r.productId === 20)?.productName).toBe('Latte');
  });

  it('returns an empty array when the favorites table is empty', async () => {
    const repo = new FavoritesRepository(makeMockD1());
    const rows = await repo.listAllGrouped();
    expect(rows).toEqual([]);
  });
});
```

If the file already has `FavoritesRepository` tests, follow the local pattern for building the mock D1 and seeding.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/tests/phase-5-repos.test.ts
```
Expected: FAIL with `TypeError: repo.listAllGrouped is not a function`.

- [ ] **Step 3: Add the `listAllGrouped` method to `FavoritesRepository`**

In `src/repositories/index.ts`, inside the `FavoritesRepository` class (after the `list` method around line 539), add:

```typescript
/**
 * Admin read: return every favorites row joined with the product name.
 * Uses LEFT JOIN so orphan favorites (product deleted by cascade — the
 * cascade normally removes them, but a stale row from before the cascade
 * was added would still appear with productName: null) still surface.
 * Returns a flat list; the client groups by telegramId or productId
 * depending on the page's "groupBy" toggle.
 */
async listAllGrouped() {
  return await this.db
    .select({
      telegramId: favorites.telegramId,
      productId: favorites.productId,
      productName: products.name,
      favoritedAt: favorites.createdAt,
    })
    .from(favorites)
    .leftJoin(products, eq(products.id, favorites.productId))
    .orderBy(desc(favorites.createdAt));
}
```

`desc` and `eq` are already imported at the top of the file. `products` is already imported in the schema re-export.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/tests/phase-5-repos.test.ts
```
Expected: PASS for the new cases, and all pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/index.ts src/tests/phase-5-repos.test.ts
git commit -m "feat(repo): FavoritesRepository.listAllGrouped for admin read surface"
```

---

### Task 3: Add the 3 router endpoints + 6 test cases

**Files:**
- Modify: `src/api/router.ts`
- Create: `src/tests/router-engagement.test.ts`

**Interfaces:**
- Consumes: `UserStateRepository.listAll` (from Task 1), `FavoritesRepository.listAllGrouped` (from Task 2), existing `FavoritesRepository.remove` (already in `src/repositories/index.ts:496-504`).
- Produces:
  - `GET /api/streaks` → `{ users: UserStateRow[] }`, 200 on success, 401/403 on auth failure.
  - `GET /api/favorites?groupBy=user|product` → `{ favorites: FavoriteWithProductRow[] }`, 200 on success, 400 if `groupBy` is not in the allowed set, 401/403 on auth failure.
  - `DELETE /api/favorites/:telegramId/:productId` → `{ ok: true }` 200 on success, `{ ok: false }` 404 on missing pair, 401/403 on auth failure.

**Pre-flight check (read this first):**

Open `src/api/router.ts` and identify:
1. How routes are registered (look for `handleApiRequest`).
2. Whether `adminAuth` is applied per-route or as a top-level middleware.
3. Whether `requireSuperAdmin` exists as a named middleware or whether the super-admin check is done inline per handler.

Match the new routes to the existing pattern. **Do not invent a new middleware.** If `requireSuperAdmin` is not exported as a named helper but is implemented as a per-handler `if (admin.role !== 'super_admin') return forbidden();`, write the new routes with the same inline check. If `requireSuperAdmin` is exported, import and use it. The spec is clear about the contract (super_admin only); the implementation pattern must follow what already exists.

- [ ] **Step 1: Write the 6 failing tests in `src/tests/router-engagement.test.ts`**

Create the file with this content (read `src/tests/_helpers/routerHarness.ts` and the existing `src/tests/router-*.test.ts` files first to copy the import/helper pattern exactly):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearStore, seedTable } from './_helpers/routerHarness';
import { userState, favorites, products } from '../database/schema';
// Import the harness's mocks for validateInitData and getAdminRole —
// copy the import lines from the closest existing router test (e.g.
// src/tests/router-misc.test.ts or src/tests/router-products.test.ts).

describe('Engagement routes', () => {
  beforeEach(() => {
    clearStore();
    // Reset the validateInitData and getAdminRole mocks to a known default
    // of "super_admin signed in" so each test starts from that baseline.
    // (Use the same reset pattern as the existing router tests.)
  });

  it('GET /api/streaks returns 200 with users array for super_admin', async () => {
    seedTable(userState, [
      { telegramId: 'u1', firstSeenAt: new Date('2026-01-01'), lastSeenAt: new Date('2026-08-05'), visitsTotal: 10, streakDays: 7 },
    ]);
    const res = await makeRequest('GET', '/api/streaks'); // see helper note below
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].telegramId).toBe('u1');
  });

  it('GET /api/streaks returns 403 for category_admin', async () => {
    // mock getAdminRole to return a category_admin row for this test
    // (look at the existing pattern in router-misc.test.ts for how to
    // override the role mock per test)
    const res = await makeRequest('GET', '/api/streaks');
    expect(res.status).toBe(403);
  });

  it('GET /api/favorites?groupBy=user returns 200 with favorites array for super_admin', async () => {
    seedTable(products, [
      { id: 10, name: 'Espresso', categoryId: 1, price: 0, stock: 0, unit: 'cup', available: true, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') },
    ]);
    seedTable(favorites, [
      { telegramId: 'u1', productId: 10, createdAt: new Date('2026-08-05') },
    ]);
    const res = await makeRequest('GET', '/api/favorites?groupBy=user');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.favorites).toHaveLength(1);
    expect(body.favorites[0].productName).toBe('Espresso');
  });

  it('GET /api/favorites?groupBy=foo returns 400', async () => {
    const res = await makeRequest('GET', '/api/favorites?groupBy=foo');
    expect(res.status).toBe(400);
  });

  it('DELETE /api/favorites/:tg/:pid returns 200 with {ok:true} when the pair exists', async () => {
    seedTable(favorites, [
      { telegramId: 'u1', productId: 10, createdAt: new Date('2026-08-05') },
    ]);
    const res = await makeRequest('DELETE', '/api/favorites/u1/10');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('DELETE /api/favorites/:tg/:pid returns 404 when the pair does not exist', async () => {
    const res = await makeRequest('DELETE', '/api/favorites/u1/999');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
```

`makeRequest(method, path)` is a helper you copy from one of the existing router test files (e.g. `src/tests/router-misc.test.ts`). It builds a `Request`, calls `handleApiRequest`, and returns the `Response`.

- [ ] **Step 2: Run the tests to verify they all fail**

```bash
npx vitest run src/tests/router-engagement.test.ts
```
Expected: All 6 tests FAIL. The most common failure will be 404 (route not registered) or 500 (handler throws because the method doesn't exist). The exact failure doesn't matter — what matters is that they all fail.

- [ ] **Step 3: Add the 3 endpoints to `src/api/router.ts`**

Open `src/api/router.ts`. Add the 3 routes. Match the **exact** style of the existing routes around them — same auth chain, same response shape, same error handling. Sketch:

```typescript
// In handleApiRequest's URL/method dispatch, add:

// GET /api/streaks — super_admin only
if (url.pathname === '/api/streaks' && request.method === 'GET') {
  // (adminAuth + super-admin check, same as existing admin reads)
  const repo = new UserStateRepository(env.DB);
  const users = await repo.listAll();
  return new Response(JSON.stringify({ users }), {
    status: 200,
    headers: corsHeaders,
  });
}

// GET /api/favorites — super_admin only
if (url.pathname === '/api/favorites' && request.method === 'GET') {
  const groupBy = url.searchParams.get('groupBy') ?? 'user';
  if (groupBy !== 'user' && groupBy !== 'product') {
    return new Response('Invalid groupBy', { status: 400, headers: corsHeaders });
  }
  const repo = new FavoritesRepository(env.DB);
  const favorites = await repo.listAllGrouped();
  return new Response(JSON.stringify({ favorites }), {
    status: 200,
    headers: corsHeaders,
  });
}

// DELETE /api/favorites/:telegramId/:productId — super_admin only
const favDeleteMatch = url.pathname.match(/^\/api\/favorites\/([^/]+)\/([^/]+)$/);
if (favDeleteMatch && request.method === 'DELETE') {
  const [, telegramId, productIdStr] = favDeleteMatch;
  const productId = parseInt(productIdStr, 10);
  if (Number.isNaN(productId)) {
    return new Response('Invalid productId', { status: 400, headers: corsHeaders });
  }
  const repo = new FavoritesRepository(env.DB);
  const ok = await repo.remove(telegramId, productId);
  if (!ok) {
    return new Response(JSON.stringify({ ok: false }), { status: 404, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
}
```

**Critical:** the path-ordering matters in some router patterns. Insert the routes in the same block where the other admin reads live (settings, branches, etc.), not at the top of `handleApiRequest`. Look at how `/api/products` and `/api/products/batch` are ordered — the more-specific path comes first. Apply the same convention to the favorites delete route (the `^\/api\/favorites\/...\/...$` regex check, not the `/api/favorites` exact match).

The `corsHeaders` constant and the existing 401/403 patterns are the references — copy them.

- [ ] **Step 4: Run the tests to verify they all pass**

```bash
npx vitest run src/tests/router-engagement.test.ts
```
Expected: All 6 tests PASS.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
npm test
```
Expected: All pre-existing tests still pass.

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/api/router.ts src/tests/router-engagement.test.ts
git commit -m "feat(api): super-admin endpoints for streaks and favorites

GET /api/streaks — list all user_state rows
GET /api/favorites?groupBy=user|product — list all favorites joined with products
DELETE /api/favorites/:telegramId/:productId — admin removal with 404 on missing pair

All three are super_admin only. groupBy is validated server-side; an invalid
value returns 400."
```

This completes Chunk A (server foundation).

---

### Task 4: Add the 2 new query keys

**Files:**
- Modify: `admin-app/src/api/keys.ts`

**Interfaces:**
- Consumes: the existing 8 query keys.
- Produces: adds `streaks: ['streaks'] as const` and `favorites: ['favorites'] as const` to the `queryKeys` object. (The `Favorites` query key in React Query will be `['favorites', groupBy]` — the base key is `favorites`, the page extends it.)

- [ ] **Step 1: Edit `admin-app/src/api/keys.ts`**

Add the two new keys to the `queryKeys` object, after the existing `branches` key (or wherever the alphabetic order suggests — match the existing ordering):

```typescript
export const queryKeys = {
  currentUser: ['currentUser'] as const,
  products: ['products'] as const,
  categories: ['categories'] as const,
  settings: ['settings'] as const,
  admins: ['admins'] as const,
  menuConfigs: ['menu-config'] as const,
  faqs: ['faqs'] as const,
  branches: ['branches'] as const,
  streaks: ['streaks'] as const,
  favorites: ['favorites'] as const,
};
```

- [ ] **Step 2: Run typecheck on the admin app**

```bash
cd admin-app && npm run typecheck && cd ..
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/api/keys.ts
git commit -m "feat(admin-app): add streaks and favorites query keys"
```

---

### Task 5: Create the `StatTile` component + its CSS class

**Files:**
- Create: `admin-app/src/components/StatTile.tsx`
- Modify: `admin-app/src/index.css` (add one class)

**Interfaces:**
- Consumes: nothing — it's a presentational component.
- Produces: a default-exported React component `StatTile` that takes `{ label: string, value: number | string, hint?: string }` and renders a small card with the label muted on top, the value large and bold (Persian digits via inline conversion), and the hint muted below.

- [ ] **Step 1: Create `admin-app/src/components/StatTile.tsx`**

```tsx
import { toPersianDigits } from '../utils/numbers';

interface StatTileProps {
  label: string;
  value: number | string;
  hint?: string;
}

export default function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{toPersianDigits(String(value))}</div>
      {hint && <div className="stat-tile-hint">{hint}</div>}
    </div>
  );
}
```

**Pre-flight check:** open `admin-app/src/utils/numbers.ts` and confirm the exact export name of the Persian-digit converter. If it's `toPersianDigits`, use it as above. If it's named differently, adjust the import. The file's existence is assumed (it's used in the bot-side `src/utils/numbers.ts`; an `admin-app/src/utils/numbers.ts` may or may not exist — if it doesn't, **create a tiny one** that exports `toPersianDigits` matching the bot-side signature, or reuse the bot-side util by copying the function over).

- [ ] **Step 2: Add the `.stat-tile` CSS to `admin-app/src/index.css`**

Open `admin-app/src/index.css` and find the existing `.card` class. Add a sibling class near it:

```css
.stat-tile {
  flex: 1 1 0;
  min-width: 120px;
  padding: 12px;
  background: var(--card-bg, #f5f5f5);
  border-radius: 8px;
  text-align: center;
}
.stat-tile-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
.stat-tile-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-color, #222);
}
.stat-tile-hint {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}
```

If `admin-app/src/index.css` uses CSS variables for theming, use them; otherwise hardcode colors. Match the file's existing style.

- [ ] **Step 3: Run typecheck and build on the admin app**

```bash
cd admin-app && npm run typecheck && npm run build && cd ..
```
Expected: typecheck 0 errors; build succeeds. (The `StatTile` is unused so far — TypeScript will warn but the build will succeed. The pages in Tasks 6–7 import it.)

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/components/StatTile.tsx admin-app/src/index.css
git commit -m "feat(admin-app): reusable StatTile component for engagement pages"
```

This completes Chunk B (mini app foundation).

---

### Task 6: Create the `StreaksPage`

**Files:**
- Create: `admin-app/src/pages/StreaksPage.tsx`

**Interfaces:**
- Consumes: `useAppContext` (for `setError`), `apiFetch`, `queryKeys`, `StatTile`, `EmptyState`, `LoadingScreen`.
- Produces: a default-exported `StreaksPage` component that fetches `/api/streaks`, renders 4 stat tiles + a sortable user table, with an `EmptyState` when the array is empty.

- [ ] **Step 1: Create `admin-app/src/pages/StreaksPage.tsx`**

```tsx
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import StatTile from '../components/StatTile';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';

type UserStateRow = {
  telegramId: string;
  firstSeenAt: number | string;
  lastSeenAt: number | string;
  visitsTotal: number;
  streakDays: number;
};

type SortKey = 'streakDays' | 'visitsTotal';
type SortDir = 'asc' | 'desc';

function toMillis(t: number | string): number {
  if (typeof t === 'number') return t;
  return Date.parse(t);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
}

export default function StreaksPage() {
  const { setError } = useAppContext();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.streaks,
    queryFn: async () => {
      const res = await apiFetch<{ users: UserStateRow[] }>('/streaks');
      return res.users;
    },
  });

  const [sortKey, setSortKey] = useState<SortKey>('streakDays');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedUsers = useMemo(() => {
    if (!data) return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
  }, [data, sortKey, sortDir]);

  if (isLoading) return <LoadingScreen />;
  if (error) {
    setError((error as Error).message);
  }

  const users = data ?? [];
  const topStreak = users.reduce((max, u) => Math.max(max, u.streakDays), 0);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const activeToday = users.filter((u) => now - toMillis(u.lastSeenAt) < ONE_DAY_MS).length;
  const med = median(users.map((u) => u.visitsTotal));

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatTile label="Users tracked" value={users.length} hint="all-time" />
          <StatTile label="Active today" value={activeToday} hint="UTC" />
          <StatTile label="Top streak" value={topStreak} hint="days" />
          <StatTile label="Median visits" value={med} hint="per user" />
        </div>
      </div>
      <div className="card">
        <h2>Users</h2>
        {users.length === 0 ? (
          <EmptyState message="0 کاربر ثبت نشده است — برای فعال‌سازی STREAK_MESSAGES=true را تنظیم کنید" />
        ) : (
          <ul className="list">
            {sortedUsers.map((u) => (
              <li key={u.telegramId} className="list-item">
                <div className="list-item-info">
                  <span>{u.telegramId}</span>
                  <span className="list-item-meta">
                    visits {u.visitsTotal} · last {new Date(toMillis(u.lastSeenAt)).toLocaleDateString()}
                  </span>
                </div>
                <div className="list-item-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleSort('streakDays')}
                  >
                    🔥 {u.streakDays}d
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => toggleSort('visitsTotal')}
                  >
                    📈 {u.visitsTotal}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

**Notes for the implementer:**
- The two sort buttons on each row are deliberate — they make the sort affordance visible without taking up column space. The `toggleSort` mutates the page-level sort state.
- The `EmptyState` message is in Persian because the operator is Iranian and the diagnostic points to a Persian env var. This matches the `formatPersianPrice` precedent (Persian text where it serves the operator).
- The "Active today" tile uses UTC math, mirroring the server's `utcDayKey`. Don't "fix" it to local time.
- If the page's `useQuery` throws, `setError` is called in render — that's how every other page in the mini app handles it (the top-level error banner in `App.tsx` picks it up via context).

- [ ] **Step 2: Run typecheck and build on the admin app**

```bash
cd admin-app && npm run typecheck && npm run build && cd ..
```
Expected: 0 typecheck errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/pages/StreaksPage.tsx
git commit -m "feat(admin-app): StreaksPage with tiles and sortable user table"
```

---

### Task 7: Create the `FavoritesPage`

**Files:**
- Create: `admin-app/src/pages/FavoritesPage.tsx`

**Interfaces:**
- Consumes: `useAppContext` (for `setError`, `showToast`, `confirm`, `currentUser`), `apiFetch`, `queryKeys`, `StatTile`, `EmptyState`, `LoadingScreen`.
- Produces: a default-exported `FavoritesPage` component that fetches `/api/favorites?groupBy=<groupBy>`, renders 3 stat tiles + a "group by" segmented control + a table, with a per-row "Remove" button in the `product` group that calls `DELETE /api/favorites/:tg/:pid` and logs to `console.info`.

- [ ] **Step 1: Create `admin-app/src/pages/FavoritesPage.tsx`**

```tsx
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import StatTile from '../components/StatTile';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';

type FavoriteRow = {
  telegramId: string;
  productId: number;
  productName: string | null;
  favoritedAt: number | string;
};

type GroupBy = 'user' | 'product';

function toMillis(t: number | string): number {
  if (typeof t === 'number') return t;
  return Date.parse(t);
}

export default function FavoritesPage() {
  const { setError, showToast, confirm, currentUser } = useAppContext();
  const queryClient = useQueryClient();
  const [groupBy, setGroupBy] = useState<GroupBy>('user');

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.favorites, groupBy],
    queryFn: async () => {
      const res = await apiFetch<{ favorites: FavoriteRow[] }>(`/favorites?groupBy=${groupBy}`);
      return res.favorites;
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ telegramId, productId }: { telegramId: string; productId: number }) =>
      apiFetch<{ ok: boolean }>(`/favorites/${encodeURIComponent(telegramId)}/${productId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
      // Audit log: stdout only. No persistent audit table by design.
      console.info('favorites: removed', {
        telegramId: vars.telegramId,
        productId: vars.productId,
        by: currentUser?.telegramId,
        at: new Date().toISOString(),
      });
      showToast('Favorite removed ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const grouped = useMemo(() => {
    if (!data) return [];
    if (groupBy === 'user') {
      const map = new Map<string, { count: number; lastFavorited: number }>();
      for (const f of data) {
        const ts = toMillis(f.favoritedAt);
        const cur = map.get(f.telegramId);
        if (!cur) map.set(f.telegramId, { count: 1, lastFavorited: ts });
        else { cur.count++; cur.lastFavorited = Math.max(cur.lastFavorited, ts); }
      }
      return Array.from(map.entries())
        .map(([telegramId, v]) => ({ telegramId, ...v }))
        .sort((a, b) => b.lastFavorited - a.lastFavorited);
    } else {
      const map = new Map<number, { productName: string | null; count: number; lastFavorited: number }>();
      for (const f of data) {
        const ts = toMillis(f.favoritedAt);
        const cur = map.get(f.productId);
        if (!cur) map.set(f.productId, { productName: f.productName, count: 1, lastFavorited: ts });
        else { cur.count++; cur.lastFavorited = Math.max(cur.lastFavorited, ts); }
      }
      return Array.from(map.entries())
        .map(([productId, v]) => ({ productId, ...v }))
        .sort((a, b) => b.count - a.count);
    }
  }, [data, groupBy]);

  const handleRemove = async (telegramId: string, productId: number) => {
    if (!(await confirm('Remove this favorite?'))) return;
    removeMutation.mutate({ telegramId, productId });
  };

  if (isLoading) return <LoadingScreen />;
  if (error) {
    setError((error as Error).message);
  }

  const favorites = data ?? [];
  const totalFavorites = favorites.length;
  const uniqueUsers = new Set(favorites.map((f) => f.telegramId)).size;
  const uniqueProducts = new Set(favorites.map((f) => f.productId)).size;

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatTile label="Total favorites" value={totalFavorites} />
          <StatTile label="Unique users" value={uniqueUsers} />
          <StatTile label="Unique products" value={uniqueProducts} />
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <strong>Group by:</strong>
          <button
            type="button"
            className={groupBy === 'user' ? 'primary' : 'secondary'}
            onClick={() => setGroupBy('user')}
          >
            User
          </button>
          <button
            type="button"
            className={groupBy === 'product' ? 'primary' : 'secondary'}
            onClick={() => setGroupBy('product')}
          >
            Product
          </button>
        </div>
        {favorites.length === 0 ? (
          <EmptyState message="0 مورد علاقه ثبت نشده است" />
        ) : groupBy === 'user' ? (
          <ul className="list">
            {grouped.map((g) => (
              <li key={g.telegramId} className="list-item">
                <div className="list-item-info">
                  <span>{g.telegramId}</span>
                  <span className="list-item-meta">
                    {g.count} favorite{g.count === 1 ? '' : 's'} · last {new Date(g.lastFavorited).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="list">
            {grouped.map((g) => (
              <li key={g.productId} className="list-item">
                <div className="list-item-info">
                  <span dir="auto">{g.productName ?? `(deleted #${g.productId})`}</span>
                  <span className="list-item-meta">
                    {g.count} favorite{g.count === 1 ? '' : 's'} · last {new Date(g.lastFavorited).toLocaleDateString()}
                  </span>
                </div>
                <div className="list-item-actions">
                  <button
                    type="button"
                    className="danger"
                    disabled={removeMutation.isPending}
                    onClick={() => handleRemove(/* see note */)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

**Notes for the implementer:**

The product-group's Remove button above is a stub — it can't iterate per-user/product pairs because the group view is aggregated. The real per-row delete lives in a **per-pair flat view**, which is what the spec calls for but this sketch simplified away. To get this right:

Replace the product-group `<ul>` with a **flat per-pair list** of every favorite row (no aggregation in the product group), each with its own `Remove` button. The tiles above still aggregate the totals; the table just doesn't. This matches the spec's "per-row remove" exactly.

Corrected product-group block:

```tsx
) : (
  <ul className="list">
    {favorites
      .slice()
      .sort((a, b) => toMillis(b.favoritedAt) - toMillis(a.favoritedAt))
      .map((f) => (
        <li key={`${f.telegramId}-${f.productId}`} className="list-item">
          <div className="list-item-info">
            <span dir="auto">{f.productName ?? `(deleted #${f.productId})`}</span>
            <span className="list-item-meta">
              {f.telegramId} · {new Date(toMillis(f.favoritedAt)).toLocaleDateString()}
            </span>
          </div>
          <div className="list-item-actions">
            <button
              type="button"
              className="danger"
              disabled={removeMutation.isPending}
              onClick={() => handleRemove(f.telegramId, f.productId)}
            >
              Remove
            </button>
          </div>
        </li>
      ))}
  </ul>
)}
```

The product-group table is a flat list (no client-side aggregation in the product view) so each row is one pair = one removable row. The `groupBy` toggle still matters for which fields the user sees prioritized, but the per-row remove needs the pair identity.

- [ ] **Step 2: Run typecheck and build on the admin app**

```bash
cd admin-app && npm run typecheck && npm run build && cd ..
```
Expected: 0 typecheck errors; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/pages/FavoritesPage.tsx
git commit -m "feat(admin-app): FavoritesPage with group-by toggle and per-row remove"
```

---

### Task 8: Wire routes + nav links in `App.tsx` + run the final verification gates

**Files:**
- Modify: `admin-app/src/App.tsx`

**Interfaces:**
- Consumes: the existing routes in `App.tsx`, the new `StreaksPage` and `FavoritesPage` exports, the `isSuperAdmin` derivation.
- Produces: two new `<Route>` elements (super-admin-only, with `<Navigate to="/products" replace />` fallback for non-super-admins) and two new `<NavLink>` elements in the super-admin fragment.

- [ ] **Step 1: Add the imports to `App.tsx`**

At the top of `admin-app/src/App.tsx`, in the import block (alphabetized, after `MenuConfigPage`):

```typescript
import StreaksPage from './pages/StreaksPage';
import FavoritesPage from './pages/FavoritesPage';
```

- [ ] **Step 2: Add the two `<Route>` elements**

Inside the `<Routes>` block in `App.tsx`, after the existing `<Route path="/menu-config" ...>` (line 77 area), add:

```tsx
<Route
  path="/streaks"
  element={isSuperAdmin ? <StreaksPage /> : <Navigate to="/products" replace />}
/>
<Route
  path="/favorites"
  element={isSuperAdmin ? <FavoritesPage /> : <Navigate to="/products" replace />}
/>
```

- [ ] **Step 3: Add the two `<NavLink>` elements**

Inside the super-admin fragment of the `.bottom-nav` (after the existing `<NavLink to="/menu-config">` block, inside the `isSuperAdmin && (...)` JSX), add two more `<NavLink>` elements:

```tsx
<NavLink
  to="/streaks"
  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
  onClick={() => window.scrollTo(0, 0)}
>
  <span className="nav-icon">🔥</span>Streaks
</NavLink>
<NavLink
  to="/favorites"
  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
  onClick={() => window.scrollTo(0, 0)}
>
  <span className="nav-icon">⭐</span>Favorites
</NavLink>
```

- [ ] **Step 4: Run all five verification gates (in order)**

**Gate 1 — typecheck (root):**
```bash
npm run typecheck
```
Expected: 0 errors.

**Gate 2 — typecheck (admin-app):**
```bash
cd admin-app && npm run typecheck && cd ..
```
Expected: 0 errors.

**Gate 3 — tests:**
```bash
npm test
```
Expected: All pre-existing tests pass. The 2 new repo tests (Tasks 1, 2) and the 6 new router tests (Task 3) all pass. **Total: 8 new tests, all green.**

**Gate 4 — admin-app build:**
```bash
cd admin-app && npm run build && cd ..
```
Expected: Build succeeds. `admin-app/dist/assets/index-*.js` and `index-*.css` are produced.

**Gate 5 — lint count check (no increase):**
```bash
# Capture current counts BEFORE this work for comparison (these are the
# baseline values from project memory subagent-brief-lint-baseline-language):
npm run lint 2>&1 | tee $HOME/lint-root-final.out | tail -1
cd admin-app && npm run lint 2>&1 | tee $HOME/lint-adminapp-final.out | tail -1 && cd ..
```

Expected: **root warning count ≤ 137, admin-app warning count ≤ 294.** If either count is higher, the implementer introduced new violations — fix them before committing. Phrase this as a COUNT, not a category, per the project memory.

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/App.tsx
git commit -m "feat(admin-app): wire /streaks and /favorites routes + bottom nav links"
```

- [ ] **Step 6: Open a PR (do NOT push to main)**

```bash
git push -u origin <feature-branch-name>
gh pr create --title "feat(admin): Phase 5 admin visibility (Streaks + Favorites pages)" \
  --body "Implements docs/superpowers/specs/2026-08-06-phase5-admin-visibility-design.md.

Adds two super_admin-only pages in the admin mini app:
- 🔥 Streaks (/streaks): 4 tiles + sortable user table
- ⭐ Favorites (/favorites): 3 tiles + group-by toggle + per-row remove with stdout audit log

Backed by 3 new REST endpoints:
- GET /api/streaks
- GET /api/favorites?groupBy=user|product
- DELETE /api/favorites/:telegramId/:productId

No schema changes, no new env vars, no new dependencies."
```

Use a feature branch name like `feat/phase5-admin-visibility`. **Do not push to `main`.** Open a PR and request review.

This completes Chunk C and the plan.

---

## Self-Review (per writing-plans skill)

**1. Spec coverage:**

| Spec section | Implemented in |
|---|---|
| §Architecture — repo `UserStateRepository.listAll` | Task 1 |
| §Architecture — repo `FavoritesRepository.listAllGrouped` | Task 2 |
| §Architecture — 3 REST endpoints | Task 3 |
| §Architecture — 2 query keys | Task 4 |
| §Architecture — `StatTile` component | Task 5 |
| §Architecture — `StreaksPage` | Task 6 |
| §Architecture — `FavoritesPage` | Task 7 |
| §Architecture — `App.tsx` routes + nav links | Task 8 |
| §Components — 4 tiles, sortable table, UTC math, EmptyState | Task 6 |
| §Components — 3 tiles, groupBy toggle, per-row remove, console.info audit | Task 7 |
| §Data flow — streaks read | Task 3 (endpoint) + Task 6 (page) |
| §Data flow — favorites read | Task 3 (endpoint) + Task 7 (page) |
| §Data flow — favorites delete | Task 3 (endpoint) + Task 7 (page) |
| §Error handling — 401/403/400/404/500 | Task 3 (server) + Tasks 6/7 (client toasts) |
| §Testing — 2 repo + 6 router tests | Tasks 1, 2, 3 |
| §Testing — verification gates | Task 8 |

All sections covered. ✅

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "fill in details", or generic "add tests" steps. Every code block contains the actual code to write. ✅

**3. Type consistency:**
- `UserStateRepository.listAll(): Promise<Array<typeof userState.$inferSelect>>` is referenced in Task 1 and used in Task 3 — same shape.
- `FavoritesRepository.listAllGrouped(): Promise<Array<{ telegramId, productId, productName, favoritedAt }>>` — same shape referenced in Task 2 and used in Task 3.
- `queryKeys.streaks` defined in Task 4, consumed in Task 6.
- `queryKeys.favorites` defined in Task 4, consumed in Task 7.
- `StatTile` props `{ label, value, hint? }` consistent across Task 5 (definition) and Tasks 6, 7 (usage).
- `queryKeys.favorites` is an array, and Task 7 spreads it (`[...queryKeys.favorites, groupBy]`) — works because `as const` on a string literal produces `readonly ['favorites']`, which spreads fine. ✅

**4. Type ambiguity:** The product-group per-row remove was initially ambiguous in the FavoritesPage sketch; the corrected block at the end of Task 7 explicitly defines it as a flat per-pair list, not aggregated. ✅

**5. Spec contradiction check:** The spec's "File inventory" lists `admin-app/src/components/StatTile.tsx` as a new file — Task 5 creates it. ✅

**6. The plan's Tasks 6 and 7 have inline `useMemo` blocks that are non-trivial.** Reviewers should be able to read them. Both are straightforward (one sort, one aggregation map). ✅

**Plan is internally consistent. No fixes needed beyond what's already in the tasks.**
