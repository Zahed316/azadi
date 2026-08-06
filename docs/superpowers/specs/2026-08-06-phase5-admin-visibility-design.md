# Phase 5 Admin Visibility — Design Spec

**Date:** 2026-08-06
**Status:** Approved (pending user review of written spec)
**Author:** Brainstorming session between user and Fable 5

## Context

Phase 5.1 (Streak) and Phase 5.2 (Favorites) shipped to the bot in commit `5cb19ef` (PR #3, merged 2026-08-06). The data is in D1 (`user_state`, `favorites` tables), the middleware and callback handlers are live, and end-to-end smoke testing confirmed both paths work for the end user. What's missing is the **admin surface** — the mini app has no way for a super_admin to see engagement data. This spec closes that gap.

## Goal

Expose the two Phase 5 tables to super_admins in the existing admin mini app, as two separate read-mostly pages, with one narrowly-scoped delete action on favorites (with stdout audit logging). category_admins get no access to either page.

## Non-goals

- No schema changes (the `user_state` and `favorites` tables are unchanged)
- No new migrations
- No changes to the bot middleware, callback handlers, or cron (`sweepStreaks`)
- No new env vars
- No persistent audit table (Cloudflare stdout is the audit log)
- No category_admin access to either page
- No new test framework for the mini app
- No UI to trigger the cron manually
- No URL sync for sort/filter state (component state only)

## Architecture

### Worker additions (3 small changes)

1. **`src/repositories/index.ts`**
   - `UserStateRepository.listAll(): Promise<UserStateRow[]>` — returns every row ordered by `streakDays DESC, lastSeenAt DESC`. No WHERE clause. Uses the existing `this.db.select().from(userState).orderBy(...)` pattern, no new imports.
   - `FavoritesRepository.listAllGrouped(): Promise<FavoriteWithProductRow[]>` — returns every favorites row LEFT-JOINed to the products table, ordered by `favorites.createdAt DESC`. Returns `{ telegramId, productId, productName, favoritedAt }`. The "groupBy" parameter from the query string is handled by the **client** (mini app), not the repo. (Single repo method, client aggregates — see Data flow.)

   Note: the existing `FavoritesRepository.remove()` is reused for the delete endpoint; no change.

2. **`src/api/router.ts`** — three new endpoints, all wrapped in the existing `adminAuth` → `requireSuperAdmin` chain:

   - `GET /api/streaks` → `new UserStateRepository(env.DB).listAll()`. Response: `{ users: UserStateRow[] }`.
   - `GET /api/favorites?groupBy=user|product` → `new FavoritesRepository(env.DB).listAllGrouped()`. The `groupBy` query param is **not** used by the server (it returns the same shape for both values) but is validated: 400 if anything other than `user` or `product`. Response: `{ favorites: FavoriteWithProductRow[] }`.
   - `DELETE /api/favorites/:telegramId/:productId` → `new FavoritesRepository(env.DB).remove(telegramId, productId)`. Response: `{ ok: true }` on success, 404 with `{ ok: false }` on a pair that doesn't exist.

3. **`src/tests/router-engagement.test.ts`** (new file) — 6 test cases covering happy paths and the 403/400/404 error paths.

### Mini app additions (4 small changes)

4. **`admin-app/src/api/keys.ts`** — add two keys: `streaks` and `favorites`. Same shape as the existing eight.

5. **`admin-app/src/components/StatTile.tsx`** (new file) — a reusable presentational component for the stat tiles. Shape:
   ```tsx
   <StatTile label="Users tracked" value={42} hint="all-time" />
   ```
   - Numbers rendered with `toPersianDigits()` (Persian digits in the admin panel, consistent with the rest of the project).
   - Single CSS class `.stat-tile` added to `admin-app/src/index.css`.

6. **`admin-app/src/pages/StreaksPage.tsx`** (new file)
   - 4 stat tiles: `Users tracked`, `Active today (UTC)`, `Top streak`, `Median visits/user`.
   - Sortable table (sort by `streakDays` and `visitsTotal`).
   - `EmptyState` when the array is empty.
   - **No mutations.** Read-only.

7. **`admin-app/src/pages/FavoritesPage.tsx`** (new file)
   - 3 stat tiles: `Total favorites`, `Unique users`, `Unique products`.
   - "Group by" segmented control (state: `user` or `product`) that refetches when toggled.
   - `user` group: `telegramId`, `favorites count`, `last favorited (relative)`. **No actions** (we rejected "clear all of a user's favorites" — too privacy-sensitive).
   - `product` group: `product name`, `product id`, `favorites count`, `last favorited (relative)`, **`Remove`** button per row.
   - The `Remove` button calls `confirm()` then `DELETE /api/favorites/:telegramId/:productId`. On success, invalidates the query, logs to `console.info`, and shows a toast.
   - On every successful remove: `console.info('favorites: removed', { telegramId, productId, by: currentUser.telegramId, at: new Date().toISOString() })`. No persistent audit table.

8. **`admin-app/src/App.tsx`** — two new `<Route>`s (`/streaks`, `/favorites`) guarded by `isSuperAdmin ? <Page> : <Navigate to="/products" replace />`, and two new `<NavLink>`s in the existing super_admin fragment of the bottom nav. Icons: `🔥` Streaks, `⭐` Favorites.

## Components

### StatTile (`admin-app/src/components/StatTile.tsx`)

Single-purpose presentational component. Used by both pages. Receives `label`, `value`, optional `hint`. Renders a small card with the label above, the value large and bold (Persian digits), and the hint muted below. Wraps cleanly in a flex row of 4 (or 3) tiles.

### StreaksPage

Two cards stacked vertically:

1. **Tile row** (4 tiles) — values computed from the `users` array in the same `useQuery`. No extra fetch.
2. **Users table card** — columns `telegramId`, `firstSeenAt` (relative, e.g. "3 days ago"), `lastSeenAt` (relative), `visitsTotal`, `streakDays`. Default sort: `streakDays DESC`. Click a header to sort.

`EmptyState` with message: "0 کاربر ثبت نشده است — برای فعال‌سازی STREAK_MESSAGES=true را تنظیم کنید" (translates to: "0 users tracked — set STREAK_MESSAGES=true to enable"). This is the operator-facing diagnostic when the table is empty.

The "Active today" tile counts users where `lastSeenAt >= now - 24h` using **UTC** time, matching the repo's `utcDayKey` math. This matters: Iranshahr is UTC+3:30/+4:30, and using local time would shift the count by a day.

### FavoritesPage

Three cards stacked vertically:

1. **Tile row** (3 tiles) — values computed from the same `favorites` array.
2. **"Group by" card** — a segmented control in the card header with two options: `user` (default) and `product`. Toggling changes the `groupBy` state, which is in the query key, so the page refetches.
3. **Table card** — columns and actions depend on `groupBy`. See "Components → FavoritesPage" above.

`EmptyState` with message: "0 مورد علاقه ثبت نشده است" (translates to: "0 favorites recorded").

### Shared patterns

- Both pages use `useAppContext` for `setError`, `showToast`, `confirm`. No new context fields.
- Both pages use `useQuery` + `useMutation` + `useQueryClient`, matching the BranchesPage pattern.
- Loading state: `<LoadingScreen />` (existing).
- No new mini app dependencies.

## Data flow

### Streaks page — read

```
User taps 🔥 Streaks tab
  → <Route path="/streaks"> matches → <StreaksPage>
  → useQuery({ queryKey: ['streaks'], queryFn: () => apiFetch('/streaks') })
  → GET /api/streaks (Authorization: Telegram <initDataRaw>)
  → adminAuth → requireSuperAdmin → handler
  → UserStateRepository.listAll()
  → Drizzle: SELECT telegram_id, first_seen_at, last_seen_at, visits_total, streak_days
             FROM user_state ORDER BY streak_days DESC, last_seen_at DESC
  → { users: [...] }
  → React: 4 tiles + table rendered from the array
```

No follow-up fetches.

### Favorites page — read

```
User taps ⭐ Favorites tab
  → <Route path="/favorites"> matches → <FavoritesPage>
  → useQuery({ queryKey: ['favorites', groupBy], queryFn: () => apiFetch('/favorites?groupBy=' + groupBy) })
  → GET /api/favorites?groupBy=user
  → adminAuth → requireSuperAdmin → handler (validates groupBy ∈ {user, product})
  → FavoritesRepository.listAllGrouped() — ignores groupBy, returns flat list
  → Drizzle: SELECT f.telegram_id, f.product_id, f.created_at AS favorited_at,
                    p.name AS product_name
             FROM favorites f
             LEFT JOIN products p ON p.id = f.product_id
             ORDER BY f.created_at DESC
  → { favorites: [{ telegramId, productId, productName, favoritedAt }, ...] }
  → React: client-side aggregation
    - groupBy=user: Map<telegramId, { count, lastFavorited }>
    - groupBy=product: Map<productId, { productName, count, lastFavorited }>
```

Toggling the segmented control changes `groupBy` state → query key changes → refetch.

### Favorites page — delete

```
User clicks Remove on a product row
  → confirm("Remove this favorite?")
  → useMutation.mutate({ telegramId, productId })
  → DELETE /api/favorites/<telegramId>/<productId>
  → adminAuth → requireSuperAdmin → handler
  → FavoritesRepository.remove(telegramId, productId)
  → Drizzle: DELETE FROM favorites
             WHERE telegram_id = ? AND product_id = ?
             RETURNING telegram_id
  → on success: { ok: true } (200)
  → on missing pair: { ok: false } (404)
  → onSuccess:
      queryClient.invalidateQueries({ queryKey: ['favorites', groupBy] })
      console.info('favorites: removed', { telegramId, productId, by, at })
      showToast('Favorite removed ✓')
  → onError (404, 500, etc.):
      setError(err.message)
      showToast(err.message, 'error')
```

Two design notes:

- **No optimistic update.** The table is small, the network is sub-100ms, and the optimistic-update + invalidate dance adds rollback complexity for a rare action.
- **The 404 case surfaces as an error toast.** The `apiFetch` throws on `!res.ok`, so a non-existent pair becomes `setError('Favorite not found')`. This is acceptable: the `confirm()` dialog is the first-line check, the 404 is the second-line check.

## Error handling

### Server

| Failure | Response | Surfaced as |
|---|---|---|
| Missing/invalid init data | 401 with plain text | Client toast + top error banner |
| Valid init, not in admins | 401 | Same |
| category_admin attempting access | 403 | Same |
| D1 throws | 500 with `error.message` | Same |
| Invalid `groupBy` value | 400 | Same |
| Delete on missing pair | 404 with `{ ok: false }` | Same |
| Repository returns unexpected shape | 500 | Same |

All error messages are the same Persian/English text the existing endpoints use — no new strings to localize.

### Client

| Failure | UX |
|---|---|
| `useQuery` loading | `<LoadingScreen />` (existing) |
| `useQuery` returns `[]` | `<EmptyState>` with the diagnostic message |
| `useQuery` throws | `setError(err.message)` (existing top banner) + toast `error` (existing) |
| `useMutation` (delete) throws | Same as above |
| Double-tap "Remove" | The mutation's `isPending` disables the row's button; second click is a no-op |

Explicitly **out of scope**: retry logic, optimistic UI, persistent audit table, offline mode. The mini app only runs inside Telegram, the network is reliable, and the dataset is small.

### Known acceptable behavior

If an admin is viewing the favorites page and another admin (or a cron) deletes the product in between the page load and the click, the delete returns `{ ok: false }` (404), the toast shows "Favorite not found", and the row stays visible until the next refetch. **Not a bug.** Matches the existing `branches` and `products` delete patterns.

## Testing

### Repo tests — `src/tests/phase-5-repos.test.ts` (extend with 3 new tests)

1. `UserStateRepository.listAll()` returns every row ordered by `streakDays DESC, lastSeenAt DESC`. Returns `[]` when the table is empty.
2. `FavoritesRepository.listAllGrouped()` returns every favorites row joined with the matching `products` row, ordered by `favorites.createdAt DESC`. Orphan favorites (product deleted via FK cascade) appear with `productName: null` because the join is LEFT, not INNER. Returns `[]` when empty.
3. (No third test — the data flow section resolved the "grouped vs not" question. There is **one** repo method, not two.)

### Router tests — `src/tests/router-engagement.test.ts` (new file, 6 tests)

1. `GET /api/streaks` — super_admin returns 200 + `{ users: [...] }`.
2. `GET /api/streaks` — category_admin returns 403.
3. `GET /api/favorites?groupBy=user` — super_admin returns 200 + `{ favorites: [...] }`.
4. `GET /api/favorites?groupBy=foo` — 400.
5. `DELETE /api/favorites/:telegramId/:productId` — super_admin returns 200 + `{ ok: true }` when pair exists.
6. `DELETE /api/favorites/:telegramId/:productId` — 404 when pair doesn't exist.

### Mini app — no new test framework

The mini app has no test framework installed. The existing CI gates (`npm run typecheck`, `npm run build`, `npm run lint` for both root and admin-app) are the verification surface for the new pages.

### Harness gotcha (memory: `phase-5-harness-gaps`)

The in-memory D1 test harness (`src/tests/_helpers/routerHarness.ts`) only handles single-`eq` predicates; `and`/`or`/`gt`/`sql` silently no-op. The new `listAll()` methods use **no WHERE clause**, so the harness's `extractEq` parser is irrelevant. The new tests rely on `.all()` returning the full seeded table — verified by reading the harness before writing tests, not after.

### Verification gates (in order)

1. `npm run typecheck` (root) — must pass
2. `npm run typecheck` (admin-app) — must pass
3. `npm test` — must pass, including 8 new tests (2 repo + 6 router)
4. `npm run build` (admin-app) — must pass (CI uses this for `wrangler pages deploy`)
5. `npm run lint` (root + admin-app) — must not increase warning counts beyond current baseline (root: 137, admin-app: 294, per the project memory `subagent-brief-lint-baseline-language`)

## File inventory

### New files (3 + 1 test file)

| Path | Purpose |
|---|---|
| `admin-app/src/components/StatTile.tsx` | Reusable stat tile |
| `admin-app/src/pages/StreaksPage.tsx` | The streaks page |
| `admin-app/src/pages/FavoritesPage.tsx` | The favorites page |
| `src/tests/router-engagement.test.ts` | 6 router tests for the 3 new endpoints |

### Edited files (6)

| Path | Change |
|---|---|
| `src/repositories/index.ts` | +2 methods (`UserStateRepository.listAll`, `FavoritesRepository.listAllGrouped`) |
| `src/api/router.ts` | +3 endpoints (all super_admin only) |
| `src/tests/phase-5-repos.test.ts` | +2 new test cases |
| `admin-app/src/api/keys.ts` | +2 keys |
| `admin-app/src/App.tsx` | +2 routes, +2 NavLinks |
| `admin-app/src/index.css` | +1 class (`.stat-tile`) |

### Deleted files (0)

## Open questions

None. All clarifying questions resolved during brainstorming (Q1–Q5):

- Q1: Separate pages (B), not combined
- Q2: super_admin only (A), not category_admin
- Q3: Streaks page is read-only (A), no actions
- Q4: Favorites page is read + per-row remove with audit log (B)
- Q5: Server returns flat data, client aggregates (A)
