# Azadi Coffee Bot — Consolidated Audit Report

**Date:** 2026-08-08
**Domains:** 10 (Accessibility, Performance, Test Coverage, Type Safety, Error Handling, i18n, Drizzle Schema, API Design, Bot UX, Monitoring)
**Method:** 3-phase workflow — 7 parallel domain agents → test coverage audit → synthesis
**Total agents:** 9 | **Tokens:** 771K | **Tool calls:** 230

---

## Fixes Applied (2026-08-08)

| #   | File                                         | Finding                                                      | Status                                                                                                                                                                                                                           |
| --- | -------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/api/router.ts:896`                      | error.message leaked to clients                              | ✅ Fixed — returns generic "Internal server error", logs full error server-side as structured JSON                                                                                                                               |
| 2   | `src/index.ts:10`                            | No request-level logging                                     | ✅ Fixed — added structured JSON logging for every request (method, path, status, duration)                                                                                                                                      |
| 3   | `src/index.ts:43`                            | Missing Content-Type on error responses                      | ✅ Fixed — added `Content-Type: application/json`                                                                                                                                                                                |
| 4   | `src/requestContext.ts:1`                    | Module-level mutable state concurrency risk                  | ✅ Documented safety assumption with detailed comment                                                                                                                                                                            |
| 5   | `src/handlers/callbackQuery.ts:405`          | Sequential admin notifications                               | ✅ Fixed — replaced `for...of await` with `Promise.allSettled`                                                                                                                                                                   |
| 6   | `src/handlers/message.ts:103`                | Rating parseInt ignores Persian digits                       | ✅ Fixed — added Persian-to-Latin digit conversion before parseInt                                                                                                                                                               |
| 7   | `src/handlers/message.ts:183`                | AI response4096 char limit unchecked                         | ✅ Fixed — added length check with truncation                                                                                                                                                                                    |
| 8   | `src/services/aiService.ts:113`              | AI4096 char limit + raw error logging                        | ✅ Fixed — added length check + structured JSON error logging                                                                                                                                                                    |
| 9   | `src/menus/mainMenu.ts:41`                   | Featured/seasonal/passport pagination bug                    | ✅ Fixed — removed hasPrev branch from first-page handlers                                                                                                                                                                       |
| 10  | `src/index.ts:48`                            | Cron failure not reported                                    | ✅ Fixed — structured JSON logging with timing for cron success/failure                                                                                                                                                          |
| 11  | `src/index.ts:33`                            | Bot instance cached with no startup logging                  | ✅ Fixed — logs bot-init with config flags on first creation                                                                                                                                                                     |
| 12  | `src/api/router.ts:450`                      | N+1 in POST /products/batch                                  | ✅ Fixed — batch fetch + `Promise.allSettled`, returns per-item results                                                                                                                                                          |
| 13  | `src/repositories/index.ts:395`              | N+1 in MenuConfigRepository.reorder                          | ✅ Fixed — `Promise.allSettled` for parallel updates                                                                                                                                                                             |
| 14  | `src/api/router.ts:552`                      | Persian error strings in API layer                           | ✅ Fixed — replaced with English: "imageUrl is required", "not a valid URL", "Failed to save/delete image"                                                                                                                       |
| 15  | `src/api/router.ts:108`                      | category_admin allows arbitrary categoryId                   | ✅ Fixed — validates category exists before inserting admin                                                                                                                                                                      |
| 16  | `src/database/schema.ts`                     | No Drizzle index definitions                                 | ✅ Fixed — added indexes: idx_products_category, idx_products_available, idx_products_featured, idx_products_seasonal, idx_products_cat_avail, idx_ai_logs_user_ts, idx_messages_unread, idx_messages_created, idx_messages_user |
| 17  | `admin-app/src/components/ConfirmDialog.tsx` | Confirm dialog missing ARIA                                  | ✅ Fixed — added role="dialog", aria-modal, aria-labelledby, focus trap, auto-focus Cancel                                                                                                                                       |
| 18  | `admin-app/src/components/Toast.tsx`         | Toast missing role="alert"                                   | ✅ Fixed — added role="alert" and aria-live="assertive"                                                                                                                                                                          |
| 19  | `admin-app/src/App.tsx`                      | Bottom nav div not nav, no main landmark, error missing ARIA | ✅ Fixed — changed to `<nav>`, wrapped content in `<main>`, added role="alert" to error                                                                                                                                          |
| 20  | `admin-app/src/pages/MessagesPage.tsx`       | Clickable divs not keyboard accessible                       | ✅ Fixed — converted to `<button>` elements                                                                                                                                                                                      |
| 21  | `admin-app/src/pages/AboutUsPage.tsx`        | Textarea has no label                                        | ✅ Fixed — wrapped in `<Field label="About Text">`                                                                                                                                                                               |
| 22  | `src/api/router.ts`                          | Monolithic 903-line router                                   | ✅ Fixed — split into 12 per-resource modules under `src/api/resources/`, router reduced to 148-line dispatcher                                                                                                                  |
| 23  | `src/api/router.ts` (all endpoints)          | Zero request body validation                                 | ✅ Fixed — added lightweight validation (required field checks, type checks) to all POST/PUT handlers                                                                                                                            |
| 24  | `src/**/*.ts`                                | Missing return types on exported functions                   | ✅ Fixed — added explicit return types to all exported functions across 8 files (bot.ts, admin.ts, callbackQuery.ts, message.ts, client.ts, auth.ts, requestContext.ts, repositories/index.ts)                                   |
| 25  | `src/database/schema.ts`                     | No Drizzle migration for new indexes                         | ✅ Fixed — created `drizzle/0008_indexes.sql` with 9 CREATE INDEX IF NOT EXISTS statements                                                                                                                                       |

**Verification:** `npm run typecheck` ✅ | `npm test` ✅ (149/149) | `npm run lint` ✅ | `admin-app build` ✅

---

## Executive Summary

**86 deduplicated findings** from 180 raw findings across domain and test audits:

- 🔴 **Critical: 6** — security vulnerabilities, concurrency risks, zero observability
- 🟠 **High: 16** — user-facing bugs, performance issues, accessibility barriers
- 🟡 **Medium: 41** — code quality, maintainability, missing best practices
- 🔵 **Low: 23** — style preferences, minor improvements

**Top 3 Critical Items:**

1. **Zero request body validation** across 20+ mutation endpoints (security + data integrity)
2. **error.message leaked** to API clients in top-level catch (information disclosure)
3. **No request-level logging** anywhere — zero visibility into production requests

---

## 🔴 Critical Findings (fix immediately)

| #   | File                            | Line | Finding                                                                                                                                                               | Fix                                                                                             |
| --- | ------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `src/api/router.ts`             | 38   | **Zero request body validation** — every POST/PUT parses `body: any` with no schema validation. Malformed input goes directly to Drizzle.                             | Add lightweight validation per endpoint. Consider zod schemas shared between API and admin-app. |
| 2   | `src/api/router.ts`             | 896  | **error.message leaked to clients** — `{ error: error.message }` exposes D1 errors, stack traces, library internals.                                                  | Return generic "Internal server error". Log full error server-side.                             |
| 3   | `src/index.ts`                  | 10   | **No request-level logging** — fetch handler logs nothing on entry. API router (903 lines, 20+ endpoints) has zero request logging.                                   | Wrap fetch handler with timing: `{ ts, method, path, status, ms }`. Add auth failure logging.   |
| 4   | `src/requestContext.ts`         | 1    | **Module-level mutable state** — `_env` and `_execCtx` as module globals. Workers interleave at await points; concurrent requests can overwrite each other's context. | Pass env/ctx through MyContext middleware. Or use AsyncLocalStorage.                            |
| 5   | `src/handlers/callbackQuery.ts` | 405  | **Sequential admin notifications** — loops `await fetch()` per admin (N serial Telegram API calls, N × 100-500ms).                                                    | Replace with `Promise.allSettled(allAdmins.map(...))`.                                          |
| 6   | `src/handlers/message.ts`       | 103  | **Rating parseInt ignores Persian digits** — `parseInt('۳')` returns NaN, causing error. Inline buttons work (Latin digits) but typed Persian input fails.            | Add `toPersianDigits()` → Latin conversion before parseInt.                                     |

---

## 🟠 High Priority (fix this sprint)

| #   | File                                         | Line | Finding                                                                                                                                                          | Fix                                                                                       |
| --- | -------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 7   | `admin-app/src/components/ConfirmDialog.tsx` | 43   | **Confirm dialog missing ARIA** — no `role="dialog"`, `aria-modal`, `aria-labelledby`, no focus trap.                                                            | Add ARIA attributes. Implement focus trap. Auto-focus Cancel on open.                     |
| 8   | `admin-app/src/components/Toast.tsx`         | 22   | **Toast missing `role="alert"` and `aria-live`** — screen readers don't announce success/error messages.                                                         | Add `role="alert"` and `aria-live="assertive"`.                                           |
| 9   | `admin-app/src/App.tsx`                      | 106  | **Bottom nav uses `<div>` not `<nav>`, no `<main>` landmark, error banner missing ARIA.**                                                                        | Change to `<nav>`, wrap content in `<main>`, add `role="alert"` to error div.             |
| 10  | `admin-app/src/pages/MessagesPage.tsx`       | 164  | **Clickable divs lack keyboard accessibility** — `onClick` without `role="button"`, `tabIndex`, or `onKeyDown`.                                                  | Add `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space). Or convert to `<button>`. |
| 11  | `admin-app/src/pages/AboutUsPage.tsx`        | 139  | **About Us textarea has no label** — no `<label>` or `aria-label`.                                                                                               | Wrap in `<Field label="About Text">` or add `aria-label`.                                 |
| 12  | `src/api/router.ts`                          | 450  | **N+1 in POST /products/batch** — per-ID `getProductById` + `deleteProduct/updateProduct` = 20 sequential D1 calls for batch of 10.                              | Single `WHERE id IN (...)` query + batch mutations or `Promise.allSettled`.               |
| 13  | `src/repositories/index.ts`                  | 395  | **N+1 in MenuConfigRepository.reorder** — sequential UPDATE per item. Partial failure leaves inconsistent ordering.                                              | `Promise.allSettled` or SQL CASE expression.                                              |
| 14  | `src/services/aiService.ts`                  | 113  | **No 4096 char limit check on AI response** — `.catch(() => {})` swallows error, user gets no feedback.                                                          | Add length check: if > 4000 chars, split or truncate. Reduce max_tokens to 512.           |
| 15  | `src/menus/mainMenu.ts`                      | 41   | **Bug: featured/seasonal/passport Previous buttons hardcode page 0** — `hasPrev` branch sends `'featured:page:0'` instead of dynamic previous.                   | Remove `hasPrev` branch from first-page handlers (never true when idx=0).                 |
| 16  | `src/api/router.ts`                          | 552  | **Persian error strings in API layer** — image validation errors in Persian, breaking machine-to-machine contract.                                               | Replace with English error strings.                                                       |
| 17  | `drizzle/meta/_journal.json`                 | 1    | **Migration journal drift** — records 4 entries but drizzle/ has 9 SQL files. Hand-crafted migrations untracked.                                                 | Delete phantom entry. Create single new migration as baseline.                            |
| 18  | `src/database/schema.ts`                     | 1    | **No Drizzle index definitions** — all indexes from hand-crafted migrations invisible to schema diffing. `products.categoryId` frequently queried with no index. | Add Drizzle index definitions. Create idx_products_category, idx_products_available, etc. |
| 19  | `src/handlers/message.ts`                    | 103  | **Rating parseInt doesn't handle Persian digits** (duplicate of #6, merged)                                                                                      | —                                                                                         |
| 20  | `src/services/aiService.ts`                  | 118  | **OpenCode API errors logged as raw strings** — no structured data, no user context, no error category.                                                          | Log as JSON: `{ operation, status, userId, queryLength }`.                                |
| 21  | `src/index.ts`                               | 48   | **Cron failure not reported** — sweepStreaks errors caught but no alerting mechanism.                                                                            | Add structured error log. Expose cron status via /api/health.                             |
| 22  | `src/api/router.ts`                          | 45   | **category_admin check allows arbitrary categoryId** — no validation that the category exists.                                                                   | Query `CategoryRepository.getCategory(body.categoryId)` before inserting.                 |

---

## 🟡 Medium Priority (plan for next phase)

### Performance

| #   | File                            | Line | Finding                                                                     |
| --- | ------------------------------- | ---- | --------------------------------------------------------------------------- |
| 23  | `src/bot.ts`                    | 44   | Streak middleware creates SettingsRepository on EVERY message to check flag |
| 24  | `src/handlers/callbackQuery.ts` | 189  | Product detail callback makes 4 sequential DB calls that are independent    |
| 25  | `src/api/router.ts`             | 143  | Settings batch save loops with individual setValue calls                    |

### Correctness

| #   | File                             | Line | Finding                                                    |
| --- | -------------------------------- | ---- | ---------------------------------------------------------- |
| 26  | `admin-app/src/api/client.ts`    | 31   | apiFetch does no runtime validation of response shape      |
| 27  | `src/handlers/message.ts`        | 85   | Empty content accepted in message flow without validation  |
| 28  | `src/handlers/message.ts`        | 60   | Abandoned message flow state persists indefinitely         |
| 29  | `src/api/router.ts`              | 100  | Category/product ID parsed from URL without NaN validation |
| 30  | `src/database/sessionStorage.ts` | 14   | Unsafe type assertions in D1SessionStorage                 |

### Security

| #   | File                        | Line | Finding                                           |
| --- | --------------------------- | ---- | ------------------------------------------------- |
| 31  | `src/api/router.ts`         | 40   | CORS missing Vary: Origin header                  |
| 32  | `src/services/aiService.ts` | 69   | AI rate limit is only 5 seconds with no daily cap |

### Type Safety

| #   | File                     | Line | Finding                                                                 |
| --- | ------------------------ | ---- | ----------------------------------------------------------------------- |
| 33  | `src/database/schema.ts` | 1    | No TypeScript exports of inferred types — root cause of pervasive `any` |

### i18n

| #   | File                                   | Line | Finding                                                      |
| --- | -------------------------------------- | ---- | ------------------------------------------------------------ |
| 34  | `src/commands/admin.ts`                | 12   | English string in bot UI: "Open Admin Panel" button          |
| 35  | `src/handlers/callbackQuery.ts`        | 403  | Admin notification sends digits in Latin not Persian         |
| 36  | `admin-app/src/pages/MessagesPage.tsx` | 35   | showToast messages mix English and Persian                   |
| 37  | `admin-app/src/index.css`              | 259  | CSS uses physical margin-right instead of logical properties |

### Database

| #   | File                     | Line | Finding                                              |
| --- | ------------------------ | ---- | ---------------------------------------------------- |
| 38  | `src/database/schema.ts` | 3    | Missing foreign key cascade rules on multiple tables |

### API Consistency

| #   | File                | Line | Finding                                                   |
| --- | ------------------- | ---- | --------------------------------------------------------- |
| 39  | `src/api/router.ts` | 444  | Batch product update silently skips unauthorized items    |
| 40  | `src/api/router.ts` | 803  | Favorites DELETE returns `ok` instead of `success`        |
| 41  | `src/api/router.ts` | 254  | GET /messages returns raw array instead of wrapped object |
| 42  | `src/index.ts`      | 43   | Missing Content-Type header on error responses            |

### Observability

| #   | File                            | Line | Finding                                                       |
| --- | ------------------------------- | ---- | ------------------------------------------------------------- |
| 43  | `src/handlers/message.ts`       | 191  | PERF_LOG opt-in only covers AI timing                         |
| 44  | `src/handlers/message.ts`       | 134  | PERF_LOG omits user ID, query length, error context           |
| 45  | `src/bot.ts`                    | 76   | Duplicate update logging uses plain string, not JSON          |
| 46  | `src/scripts/streaks.ts`        | 9    | Cron job logging is minimal and not structured                |
| 47  | `src/api/router.ts`             | 46   | Health check only verifies D1 — no external dependency checks |
| 48  | `src/handlers/callbackQuery.ts` | 20   | Callback handlers swallow errors with bare console.error      |
| 49  | `src/middlewares/auth.ts`       | 19   | Admin auth failures are not logged                            |
| 50  | `src/api/router.ts`             | 326  | Telegram sendMessage failure not tracked                      |
| 51  | `src/index.ts`                  | 33   | Bot instance cached globally with no startup logging          |
| 52  | `wrangler.toml`                 | 6    | Workers Observability enabled but no structured logging       |

### Maintainability

| #   | File                | Line | Finding                                                   |
| --- | ------------------- | ---- | --------------------------------------------------------- |
| 53  | `src/api/router.ts` | 896  | No centralized error handling — duplicated try/catch      |
| 54  | `src/api/router.ts` | 21   | Monolithic 903-line router — no separation of concerns    |
| 55  | `src/api/router.ts` | 319  | Persian string in API layer for Telegram message template |

### Test Quality

| #   | File                                  | Line | Finding                                                        |
| --- | ------------------------------------- | ---- | -------------------------------------------------------------- |
| 56  | `src/tests/_helpers/routerHarness.ts` | 1    | Test harness silently drops non-eq predicates                  |
| 57  | `src/tests/faq-repository.test.ts`    | 1    | 5 test files are tautological — test shapes, not behavior      |
| 58  | `src/handlers/callbackQuery.ts`       | 1    | Zero test coverage for all 15 callback handlers                |
| 59  | `src/handlers/message.ts`             | 1    | Zero test coverage for message handler and AI service          |
| 60  | `src/bot.ts`                          | 1    | Zero test coverage for bot initialization and middleware chain |
| 61  | `admin-app/`                          | 1    | Zero test coverage for entire admin Mini App                   |
| 62  | `src/index.ts`                        | 18   | Zero test coverage for Worker entry point                      |
| 63  | `src/utils/menuVisibility.ts`         | 19   | Zero test coverage for menu visibility utility                 |

---

## 🔵 Low Priority (backlog)

| #   | File                                   | Line | Finding                                                                   |
| --- | -------------------------------------- | ---- | ------------------------------------------------------------------------- |
| 64  | `src/handlers/callbackQuery.ts`        | 139  | drinks:cat fetches price_unit after unnecessary sequential dependency     |
| 65  | `src/repositories/index.ts`            | 21   | Repository class instantiation overhead — getDb per-constructor           |
| 66  | `src/api/router.ts`                    | 830  | Streak config GET/POST reads/writes settings sequentially                 |
| 67  | `admin-app/vite.config.ts`             | 1    | Vite config minimal — no code splitting or compression                    |
| 68  | `src/handlers/message.ts`              | 183  | AI reply error silently swallowed with no user feedback                   |
| 69  | `admin-app/src/pages/MessagesPage.tsx` | 66   | Loading state text not announced to screen readers                        |
| 70  | `src/api/auth.ts`                      | 42   | Constant-time comparison has length check that leaks via timing           |
| 71  | `src/handlers/callbackQuery.ts`        | 328  | Swallowed answerCallbackQuery rejections lack documentation               |
| 72  | `src/repositories/index.ts`            | 293  | AI conversation logging fires-and-forgets with no error handling          |
| 73  | `src/api/router.ts`                    | 815  | AI logs limit parameter parsed without bounds checking                    |
| 74  | `src/api/router.ts`                    | 31   | OPTIONS preflight returns 200 instead of 204                              |
| 75  | `src/api/router.ts`                    | 115  | POST creates return 200 instead of 201, DELETE returns 200 instead of 204 |
| 76  | `src/api/router.ts`                    | 99   | Route ordering creates implicit precedence — fragile                      |
| 77  | `src/api/router.ts`                    | 608  | Legacy stock/toggle PUT uses fragile path.split guard                     |
| 78  | `src/database/schema.ts`               | 29   | Missing CHECK constraints on multiple tables                              |
| 79  | `admin-app/src/pages/MessagesPage.tsx` | 101  | Non-null assertion on repliedAt                                           |
| 80  | `admin-app/src/pages/StreaksPage.tsx`  | 61   | as Error cast without type guard in 3 files                               |
| 81  | `src/handlers/callbackQuery.ts`        | 23   | Missing parse_mode HTML on back-to-main and drinks back button            |
| 82  | `src/menus/mainMenu.ts`                | 142  | Search prompt and FAQ empty state lack back buttons                       |
| 83  | `src/api/auth.ts`                      | 2    | validateInitData returns Promise<any                                      | null> |
| 84  | `src/menus/mainMenu.ts`                | 18   | Menu text callbacks typed as (ctx: any) instead of (ctx: MyContext)       |
| 85  | `src/utils/formatters.ts`              | 1    | Formatter functions accept any-typed parameters                           |
| 86  | `src/handlers/message.ts`              | 135  | Chat action failures silently ignored                                     |

---

## Fix Batches (grouped by file)

### `src/api/router.ts` (14 findings)

Critical: #1 (body validation), #2 (error.message leak)
High: #12 (N+1 batch), #16 (Persian errors), #22 (categoryId validation)
Medium: #25 (settings batch), #29 (NaN validation), #31 (CORS Vary), #39 (batch skip), #40 (favorites ok), #41 (raw array), #46 (health check), #48 (callback errors), #50 (Telegram failure), #53 (error handling), #54 (monolith), #55 (Persian template)
Low: #66 (streak sequential), #73 (logs limit), #74 (OPTIONS 204), #75 (status codes), #76 (route ordering), #77 (path.split)

### `src/handlers/callbackQuery.ts` (5 findings)

Critical: #5 (sequential notifications)
High: #15 (pagination bug)
Medium: #24 (sequential DB), #35 (Latin digits), #48 (callback errors)
Low: #71 (swallowed rejections)

### `admin-app/src/components/ConfirmDialog.tsx` (1 finding)

High: #7 (ARIA + focus trap)

### `admin-app/src/components/Toast.tsx` (1 finding)

High: #8 (role="alert")

### `admin-app/src/App.tsx` (1 finding)

High: #9 (nav + main + error ARIA)

### `admin-app/src/pages/MessagesPage.tsx` (3 findings)

High: #10 (keyboard accessibility)
Medium: #36 (mixed language)
Low: #69 (loading ARIA), #79 (non-null assertion)

### `src/database/schema.ts` (4 findings)

High: #18 (no Drizzle indexes)
Medium: #33 (no inferred types), #38 (no cascade rules)
Low: #78 (no CHECK constraints)

### `src/handlers/message.ts` (6 findings)

Critical: #6 (Persian parseInt)
Medium: #27 (empty content), #28 (stale flow), #43 (PERF_LOG narrow), #44 (PERF_LOG context)
Low: #68 (AI error swallowed), #86 (chat action ignored)

### `src/services/aiService.ts` (3 findings)

High: #14 (4096 limit), #20 (raw error logging)
Medium: #32 (rate limit)

### `src/index.ts` (4 findings)

Critical: #3 (no request logging)
High: #21 (cron failure)
Medium: #51 (bot init logging)
Low: —
