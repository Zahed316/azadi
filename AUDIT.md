# Codebase Audit Report

> Generated: 2026-08-07 — covers dead code, stale files, build config, security, and deployment readiness.

---

## Executive Summary

**Total findings: 66** across 9 categories. Most are LOW severity. The 2 HIGH findings are:

1. **Stack trace leaked in 500 responses** (`src/index.ts:43`) — information disclosure
2. **Unused npm dependencies** — 4 packages in `package.json` that are never imported

The codebase is functionally sound. The audit surface is mostly hygiene: stale files, missing `.gitignore` entries, hardcoded shell scripts, and unused dependency declarations.

---

## 1. STALE FILES (6)

| File | Notes |
|------|-------|
| `test-drizzle.ts` (root) | 6-line file that calls `drizzle(undefined as any)` in a try/catch. Not imported by anything. **Tracked in git.** |
| `src/scripts/measure-latency.sh` | References `/list_products` command that no longer exists in the bot. Hardcoded production URL. Termux-specific shebang. |
| `src/scripts/test-webhook.sh` | References `/list_products` command. Hardcoded `TEST_SECRET`. Termux-specific shebang. |
| `drizzle/0001_menu_update.sql` | Hand-crafted migration that overlaps with `0001_lumpy_zuras.sql`. Shares sequence number 0001. Not in `_journal.json` (already applied directly). |
| `drizzle/0002_sessions_table.sql` | Hand-crafted, not in `_journal.json`. Already applied. |
| `drizzle/0003_menu_config.sql` through `0006_add_nutritional_and_brew_guide.sql` | Hand-crafted migrations, all already applied directly, none in `_journal.json`. |
| `src/config/` | Empty directory with no files — leftover placeholder |
| `src/telegram/` | Empty directory with no files — leftover placeholder |

---

## 2. UNUSED DEPENDENCIES (4)

| Package | Location | Notes |
|---------|----------|-------|
| `@grammyjs/auto-retry` | `package.json` dependencies | Not imported anywhere in `src/` |
| `@grammyjs/parse-mode` | `package.json` dependencies | Not imported anywhere in `src/` |
| `@grammyjs/router` | `package.json` dependencies | Not imported anywhere in `src/` |
| `tsx` | `package.json` devDependencies | Not referenced by any npm script |

---

## 3. UNUSED EXPORTS (7)

| File:Line | Export | Notes |
|-----------|--------|-------|
| `src/repositories/index.ts:25` | `ProductRepository.getAllProducts()` | Never called; callers use `getAllProductsWithDetails()` instead |
| `src/repositories/index.ts:177` | `CategoryRepository.getCategoryById()` | Never called anywhere |
| `src/repositories/index.ts:239` | `FaqRepository.getById()` | Never called anywhere |
| `src/middlewares/auth.ts:13` | `isAdmin()` | Only called internally by `adminAuth()` in same file |
| `src/utils/numbers.ts:2-3` | `LRI`, `PDI` | Constants only used internally by `formatPersianPrice` |
| `src/utils/formatters.ts` | `VAT_NOTE` | Only used internally by `formatProduct` |
| `admin-app/src/api/client.ts:3` | `API_BASE` | Only used internally within same file |

> Note: `fetchUnreadCount` was removed in the cleanup commit.
| `src/utils/formatters.ts` | `VAT_NOTE` | Constant only used internally by `formatProduct` in the same file |
| `src/middlewares/auth.ts` | `isAdmin` | Only called internally by `adminAuth` in the same file |

---

## 3b. UNUSED IMPORTS (1)

| File:Line | Import | Notes |
|-----------|--------|-------|
| `src/repositories/index.ts:16` | `isNull` from `drizzle-orm` | Imported but never used; only `eq`, `and`, `desc`, `lt`, `sql` are used |

---

## 4. DEAD CODE PATHS (2)

| File:Line | Path | Notes |
|-----------|------|-------|
| `src/bot.ts` | `conversations()` middleware | Gated by `USE_CONVERSATIONS === 'true'` (off by default). The entire conversations subsystem is dormant. The `@grammyjs/conversations` package is imported but the code path is never executed in production. |
| `src/scripts/streaks.ts` | `sweepStreaks` | Gated by `STREAK_CRON_ENABLED` (off by default). Cron trigger in `wrangler.toml` fires daily but the body returns immediately. |

---

## 5. GITIGNORE GAPS (5)

| Pattern | Notes |
|---------|-------|
| `dist/` | Root `dist/` contains `worker.js` (665KB build output) but is NOT in `.gitignore`. Already tracked in git. |
| `.claude/` | Claude Code session directory not ignored |
| `.superpowers/` | Superpowers workspace directory not ignored |
| `*.log` | Only `.lint-baseline.log` and `admin-app/.lint-baseline.log` are individually listed; no wildcard |
| `.wrangler/` | Wrangler state directory not ignored |

---

## 6. BUILD & DEPLOYMENT CONFIG (12)

| Category | File | Finding |
|----------|------|---------|
| BUILD_OPT | `admin-app/vite.config.ts` | No code splitting (manualChunks) for React dependencies |
| BUILD_OPT | `admin-app/vite.config.ts` | No explicit build.sourcemap config |
| BUILD_OPT | `admin-app/vite.config.ts` | No base path for Cloudflare Pages |
| CI_OPT | `.github/workflows/deploy.yml` | Two parallel jobs with duplicated setup (no shared caching) |
| CI_OPT | `.github/workflows/deploy.yml` | Admin-app lint runs after build (should be before) |
| CI_OPT | `.github/workflows/deploy.yml` | No admin-app typecheck step in CI |
| CI_OPT | `.github/workflows/deploy.yml` | No node_modules caching across jobs |
| SCRIPT_STALE | `package.json` | `"main": "index.js"` points to nonexistent file |
| SCRIPT_STALE | `package.json` | No `dev` script for local worker development |
| SCRIPT_STALE | `package.json` | No `check` meta-script (typecheck + lint + format + test) |
| CONFIG_MISSING | `package.json` | No `engines` field declaring minimum Node version |
| CONFIG_MISSING | `wrangler.toml` | No `workers_dev` or `routes` config (relies on defaults) |

---

## 7. SECURITY (14)

| Severity | File:Line | Finding |
|----------|-----------|---------|
| **HIGH** | `src/index.ts:43` | Stack trace leaked in 500 error responses (`err.stack` in JSON body) |
| **HIGH** | `src/requestContext.ts:3-4` | Module-level singleton env/context state shared across concurrent requests in same isolate |
| MEDIUM | `src/api/router.ts:41` | Wildcard CORS (`*`) on all API responses |
| MEDIUM | `src/api/router.ts:46` | Health check endpoint exposes DB connectivity status without auth |
| MEDIUM | `src/api/router.ts:111` | `parseInt` used without NaN checks (systemic — ~15 locations) |
| MEDIUM | `src/api/router.ts:109` | Admin creation accepts arbitrary role/categoryId without validation |
| MEDIUM | `src/api/router.ts:143` | Settings POST iterates body.settings without bounds checking |
| LOW | `src/index.ts:27` | Webhook secret comparison is not constant-time (`!==`) |
| LOW | `src/api/router.ts:33` | Missing `Access-Control-Max-Age` header on preflight |
| LOW | `src/api/router.ts:884` | AI test endpoint sends user query to external API (no rate limit) |
| LOW | `src/api/router.ts:415` | Product creation lacks body structure validation |
| LOW | `src/api/router.ts:372` | Menu config reorder accepts unvalidated items array |
| LOW | `src/api/router.ts:898` | Error response leaks `error.message` to client |
| LOW | `src/index.ts:27` | No rate limiting on webhook or API endpoints |

---

## 8. DEPENDENCY / PACKAGE HYGIENE (5)

| Severity | File | Finding |
|----------|------|---------|
| LOW | `admin-app/package.json` | React 18.2.0 — React 19 available |
| LOW | `admin-app` lockfile | `@telegram-apps/bridge`, `@telegram-apps/transformers`, `@telegram-apps/types` all deprecated (pulled by `@telegram-apps/sdk` v2) |
| LOW | root lockfile | `@esbuild-kit/core-utils` deprecated (pulled by `tsx`) |
| LOW | `package.json` | Empty `description` and `author` fields |
| LOW | `admin-app/package.json` | No test script or test framework |

---

## Recommended Priority

### Immediate (pre-deploy hygiene)
1. **Remove `err.stack` from 500 responses** — 1-line fix, high impact
2. **Delete `test-drizzle.ts`** — stale file tracked in git
3. **Update `.gitignore`** — add `dist/`, `.claude/`, `.superpowers/`, `*.log`, `.wrangler/`
4. **Remove unused deps** — `@grammyjs/auto-retry`, `@grammyjs/parse-mode`, `@grammyjs/router`, `tsx`

### Short-term (next PR)
5. **Add `dev` and `check` scripts** to `package.json`
6. **Add admin-app typecheck** to CI workflow
7. **Fix CI step ordering** — lint before build in `deploy-admin-app` job
8. **Remove unused export** `fetchUnreadCount` from admin-app

### Medium-term
9. **Restrict CORS** to Telegram Mini App origin
10. **Add input validation** for parseInt calls in router
11. **Add Vite code splitting** for admin-app

---

*This report was produced by 3 parallel audit agents + manual analysis. The dead-code agent's individual findings are included in the categories above.*
