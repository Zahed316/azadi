# Codebase Audit Report

> Generated: 2026-08-07 — covers dead code, stale files, build config, security, and deployment readiness.
> **Last updated: 2026-08-13** — resolved findings marked with status indicators.

---

## Executive Summary

**Total findings: 66** across 9 categories. Most are LOW severity. The 2 HIGH findings were:

1. ~~**Stack trace leaked in 500 responses** (`src/index.ts:43`)~~ ✅ RESOLVED — code now sanitizes error output
2. **Unused npm dependencies** — 4 packages in `package.json` that are never imported (still open)

The codebase is functionally sound. The audit surface is mostly hygiene: stale files, missing `.gitignore` entries, hardcoded shell scripts, and unused dependency declarations.

---

## 1. STALE FILES (6) ✅ RESOLVED

| File                                                                             | Notes                                                                                                                                             | Status      |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `test-drizzle.ts` (root)                                                         | 6-line file that calls `drizzle(undefined as any)` in a try/catch. Not imported by anything. **Tracked in git.**                                  | ✅ Deleted  |
| `src/scripts/measure-latency.sh`                                                 | References `/list_products` command that no longer exists in the bot. Hardcoded production URL. Termux-specific shebang.                          | ✅ Deleted  |
| `src/scripts/test-webhook.sh`                                                    | References `/list_products` command. Hardcoded `TEST_SECRET`. Termux-specific shebang.                                                            | ✅ Deleted  |
| `drizzle/0001_menu_update.sql`                                                   | Hand-crafted migration that overlaps with `0001_lumpy_zuras.sql`. Shares sequence number 0001. Not in `_journal.json` (already applied directly). | ✅ Archived |
| `drizzle/0002_sessions_table.sql`                                                | Hand-crafted, not in `_journal.json`. Already applied.                                                                                            | ✅ Archived |
| `drizzle/0003_menu_config.sql` through `0006_add_nutritional_and_brew_guide.sql` | Hand-crafted migrations, all already applied directly, none in `_journal.json`.                                                                   | ✅ Archived |
| `src/config/`                                                                    | Empty directory with no files — leftover placeholder                                                                                              | ✅ Deleted  |
| `src/telegram/`                                                                  | Empty directory with no files — leftover placeholder                                                                                              | ✅ Deleted  |

---

## 2. UNUSED DEPENDENCIES (4)

| Package                | Location                       | Notes                            |
| ---------------------- | ------------------------------ | -------------------------------- |
| `@grammyjs/auto-retry` | `package.json` dependencies    | Not imported anywhere in `src/`  |
| `@grammyjs/parse-mode` | `package.json` dependencies    | Not imported anywhere in `src/`  |
| `@grammyjs/router`     | `package.json` dependencies    | Not imported anywhere in `src/`  |
| `tsx`                  | `package.json` devDependencies | Not referenced by any npm script |

---

## 3. UNUSED EXPORTS (7)

| File:Line                       | Export                                 | Notes                                                           |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| `src/repositories/index.ts:25`  | `ProductRepository.getAllProducts()`   | Never called; callers use `getAllProductsWithDetails()` instead |
| `src/repositories/index.ts:177` | `CategoryRepository.getCategoryById()` | Never called anywhere                                           |
| `src/repositories/index.ts:239` | `FaqRepository.getById()`              | Never called anywhere                                           |
| `src/middlewares/auth.ts:13`    | `isAdmin()`                            | Only called internally by `adminAuth()` in same file            |
| `src/utils/numbers.ts:2-3`      | `LRI`, `PDI`                           | Constants only used internally by `formatPersianPrice`          |
| `src/utils/formatters.ts`       | `VAT_NOTE`                             | Only used internally by `formatProduct`                         |
| `admin-app/src/api/client.ts:3` | `API_BASE`                             | Only used internally within same file                           |

> Note: `fetchUnreadCount` was removed in the cleanup commit.
> | `src/utils/formatters.ts` | `VAT_NOTE` | Constant only used internally by `formatProduct` in the same file |
> | `src/middlewares/auth.ts` | `isAdmin` | Only called internally by `adminAuth` in the same file |

---

## 3b. UNUSED IMPORTS (1) ✅ RESOLVED

| File:Line                      | Import                      | Notes                                                                   | Status     |
| ------------------------------ | --------------------------- | ----------------------------------------------------------------------- | ---------- |
| `src/repositories/index.ts:16` | `isNull` from `drizzle-orm` | Imported but never used; only `eq`, `and`, `desc`, `lt`, `sql` are used | ✅ Removed |

---

## 4. DEAD CODE PATHS (2)

| File:Line                | Path                         | Notes                                                                                                                                                                                                         |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/bot.ts`             | `conversations()` middleware | Gated by `USE_CONVERSATIONS === 'true'` (off by default). The entire conversations subsystem is dormant. The `@grammyjs/conversations` package is imported but the code path is never executed in production. |
| `src/scripts/streaks.ts` | `sweepStreaks`               | Gated by `STREAK_CRON_ENABLED` (off by default). Cron trigger in `wrangler.toml` fires daily but the body returns immediately.                                                                                |

---

## 5. GITIGNORE GAPS (5) ✅ RESOLVED

| Pattern         | Notes                                                                                                      | Status   |
| --------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| `dist/`         | Root `dist/` contains `worker.js` (665KB build output) but is NOT in `.gitignore`. Already tracked in git. | ✅ Added |
| `.claude/`      | Claude Code session directory not ignored                                                                  | ✅ Added |
| `.superpowers/` | Superpowers workspace directory not ignored                                                                | ✅ Added |
| `*.log`         | Only `.lint-baseline.log` and `admin-app/.lint-baseline.log` are individually listed; no wildcard          | ✅ Added |
| `.wrangler/`    | Wrangler state directory not ignored                                                                       | ✅ Added |

---

## 6. BUILD & DEPLOYMENT CONFIG (12)

| Category       | File                           | Finding                                                       | Status   |
| -------------- | ------------------------------ | ------------------------------------------------------------- | -------- |
| BUILD_OPT      | `admin-app/vite.config.ts`     | No code splitting (manualChunks) for React dependencies       | Open     |
| BUILD_OPT      | `admin-app/vite.config.ts`     | No explicit build.sourcemap config                            | Open     |
| BUILD_OPT      | `admin-app/vite.config.ts`     | No base path for Cloudflare Pages                             | Open     |
| CI_OPT         | `.github/workflows/deploy.yml` | Three parallel jobs with duplicated setup (no shared caching) | Open     |
| CI_OPT         | `.github/workflows/deploy.yml` | Lint runs before build in all jobs                            | ✅ Fixed |
| CI_OPT         | `.github/workflows/deploy.yml` | Admin-app typecheck step in CI                                | ✅ Fixed |
| CI_OPT         | `.github/workflows/deploy.yml` | No node_modules caching across jobs                           | Open     |
| SCRIPT_STALE   | `package.json`                 | `"main": "index.js"` points to nonexistent file               | Open     |
| SCRIPT_STALE   | `package.json`                 | No `dev` script for local worker development                  | Open     |
| SCRIPT_STALE   | `package.json`                 | `check` meta-script (typecheck + lint + format + test)        | ✅ Added |
| CONFIG_MISSING | `package.json`                 | No `engines` field declaring minimum Node version             | Open     |
| CONFIG_MISSING | `wrangler.toml`                | No `workers_dev` or `routes` config (relies on defaults)      | Open     |

---

## 7. SECURITY (14)

| Severity | File:Line                   | Finding                                                                                    | Status                                                                           |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| ~~HIGH~~ | `src/index.ts:43`           | Stack trace leaked in 500 error responses (`err.stack` in JSON body)                       | ✅ Fixed — code sanitizes error output                                           |
| **HIGH** | `src/requestContext.ts:3-4` | Module-level singleton env/context state shared across concurrent requests in same isolate | Open — Workers isolate per-request, low real-world risk                          |
| MEDIUM   | `src/api/router.ts:41`      | Wildcard CORS (`*`) on all API responses                                                   | Open                                                                             |
| MEDIUM   | `src/api/router.ts:46`      | Health check endpoint exposes DB connectivity status without auth                          | Open                                                                             |
| MEDIUM   | `src/api/router.ts:111`     | `parseInt` used without NaN checks (systemic — ~15 locations)                              | ⚠️ Partial — `parseRequiredInt` added in PR 4, some paths still use raw parseInt |
| MEDIUM   | `src/api/router.ts:109`     | Admin creation accepts arbitrary role/categoryId without validation                        | Open                                                                             |
| MEDIUM   | `src/api/router.ts:143`     | Settings POST iterates body.settings without bounds checking                               | Open                                                                             |
| LOW      | `src/index.ts:27`           | Webhook secret comparison is not constant-time (`!==`)                                     | Open                                                                             |
| LOW      | `src/api/router.ts:33`      | Missing `Access-Control-Max-Age` header on preflight                                       | Open                                                                             |
| LOW      | `src/api/router.ts:884`     | AI test endpoint sends user query to external API (no rate limit)                          | Open                                                                             |
| LOW      | `src/api/router.ts:415`     | Product creation lacks body structure validation                                           | Open                                                                             |
| LOW      | `src/api/router.ts:372`     | Menu config reorder accepts unvalidated items array                                        | ✅ Fixed — PR 5 adds validation                                                  |
| LOW      | `src/api/router.ts:898`     | Error response leaks `error.message` to client                                             | Open                                                                             |
| LOW      | `src/index.ts:27`           | No rate limiting on webhook or API endpoints                                               | Open                                                                             |

---

## 8. DEPENDENCY / PACKAGE HYGIENE (5)

| Severity | File                     | Finding                                                                                                                           |
| -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| LOW      | `admin-app/package.json` | React 18.2.0 — React 19 available                                                                                                 |
| LOW      | `admin-app` lockfile     | `@telegram-apps/bridge`, `@telegram-apps/transformers`, `@telegram-apps/types` all deprecated (pulled by `@telegram-apps/sdk` v2) |
| LOW      | root lockfile            | `@esbuild-kit/core-utils` deprecated (pulled by `tsx`)                                                                            |
| LOW      | `package.json`           | Empty `description` and `author` fields                                                                                           |
| LOW      | `admin-app/package.json` | No test script or test framework                                                                                                  |

---

## Recommended Priority

### Immediate (pre-deploy hygiene) ✅ All resolved

1. ~~**Remove `err.stack` from 500 responses**~~ — ✅ Fixed
2. ~~**Delete `test-drizzle.ts`**~~ — ✅ Deleted
3. ~~**Update `.gitignore`**~~ — ✅ All 5 patterns added
4. **Remove unused deps** — `@grammyjs/auto-retry`, `@grammyjs/parse-mode`, `@grammyjs/router`, `tsx` (still open)

### Short-term (next PR) ✅ Mostly resolved

5. ~~**Add `dev` and `check` scripts**~~ — ✅ `check` added
6. ~~**Add admin-app typecheck** to CI workflow~~ — ✅ Added
7. ~~**Fix CI step ordering**~~ — ✅ Fixed
8. ~~**Remove unused export `fetchUnreadCount`**~~ — ✅ Removed

### Medium-term

9. **Restrict CORS** to Telegram Mini App origin — Open
10. ~~**Add input validation** for parseInt calls in router~~ — ⚠️ Partial (PR 4 covers main paths)
11. **Add Vite code splitting** for admin-app — Open

---

_This report was produced by 3 parallel audit agents + manual analysis. The dead-code agent's individual findings are included in the categories above._
