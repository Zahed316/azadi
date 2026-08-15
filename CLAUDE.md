# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Write in ASD-STE100

> **Persona-specific companion**: `AGENTS.md` is a parallel docs file that records the same kind of project context. It is the _first_ place to look for workflow conventions and pitfalls; this file is the canonical source. If they disagree, this file wins — and `AGENTS.md` should be updated to match.

## Memory

Project-scoped memory lives in `~/.claude/projects/-data-data-com-termux-files-home-repo-azadi/memory/` (index in `MEMORY.md`). Load it when a question matches a slug — these are non-obvious lessons with re-discovery risk, not duplicates of facts already here.

- [cacheservice-test-spy-on-prototype](memory/cacheservice-test-spy-on-prototype.md) — spy on `CacheService.prototype` in tests, not the KV mock
- [vitest-mock-class-no-fn-wrap](memory/vitest-mock-class-no-fn-wrap.md) — pass class directly in `vi.mock()`, wrapping in `vi.fn()` breaks constructor
- [lint-fix-type-at-boundary](memory/lint-fix-type-at-boundary.md) — type `apiFetch<T>()` response first during lint sweeps; cascades fixes
- [boolean-null-after-any-removal](memory/boolean-null-after-any-removal.md) — replacing `any` surfaces `boolean|null` errors; use `?? false`
- [prettier-checks-yaml-too](memory/prettier-checks-yaml-too.md) — run prettier on `deploy.yml` after manual edits; YAML is in `format:check`
- [wrangler-action-v4-needs-version-pin](memory/wrangler-action-v4-needs-version-pin.md) — `wrangler-action` v4 defaults to Wrangler v4; pin `wranglerVersion`
- [favorites-toggle-pattern](memory/favorites-toggle-pattern.md) — IDataService has `toggleFavorite()`, not add/remove; use `isFavorited()` pre-check for guard messages
- [plan-file-enumeration-incomplete](memory/plan-file-enumeration-incomplete.md) — plans under-enumerate files; typecheck catches missed call sites, not the plan text
- [npm-termux-promotes-arm64-optional-deps](memory/npm-termux-promotes-arm64-optional-deps.md) — npm install on ARM64 Termux can add platform-specific optional deps to package.json, breaking x64 CI
- [grammy-menu-plugin-conflicts-with-lifecycle](memory/grammy-menu-plugin-conflicts-with-lifecycle.md) — grammY menu plugin edits messages outside our lifecycle; use delete+recreate for back navigation
- [handleeditfailure-must-pop-before-push](memory/handleeditfailure-must-pop-before-push.md) — handleEditFailure must pop the active message before creating a fallback
- [worktrees-lack-node-modules](memory/worktrees-lack-node-modules.md) — SDD worktrees don't have node_modules; run typecheck/lint/format from main repo before merge
- [dead-helper-extraction-risk](memory/dead-helper-extraction-risk.md) — extracted helpers must be integrated in the same task; dead helpers create false dedup confidence
- [subagent-prettier-skips-docs](memory/subagent-prettier-skips-docs.md) — subagents may not format docs files with Prettier, causing CI format:check to fail
- [mimo-v25-no-function-calling](memory/mimo-v25-no-function-calling.md) — OpenCode mimo-v2.5 rejects or garbles OpenAI function calling; don't send tools

**Global memory** lives in `~/.claude/memory/` (index in `~/.claude/memory/MEMORY.md`) and applies to any project. Load it whenever a slug matches (e.g. Termux toolchain lessons when touching shebangs/binary paths; `permissive-where-parsers-mask-sql-bugs` and `rest-api-target-user-idor-and-nan-bypass` when reviewing REST handlers or test SQL). Treat entries as hypotheses — verify a specific behavioral claim (exit code, error message, version-specific behavior) in the current session before citing it as a diagnosis.

**Global rules are binding.** The rules in `~/.claude/CLAUDE.md` (the user's global instructions) take precedence over any project-specific guidance in this file or in `AGENTS.md`. If they conflict, the global rules win — and this file should be updated to reconcile.

**Global rules** are in `~/.claude/CLAUDE.md`. They are already loaded each session via the system context, but **always re-read that file when starting work that crosses the user's global rules** (CodeGraph usage, the "memory is a hypothesis index" rule, output conventions). The file is the source of truth — never re-derive its contents from memory of past sessions.

## What this is

A Telegram bot + admin Web App for **Azadi Coffee Roastery** (Iranshahr, Iran). Cloudflare Workers backend, grammY bot, D1 (SQLite) via Drizzle ORM, OpenCode API (`mimo-v2.5`) for chat fallback. All bot UI text is **Persian (Farsi)** with HTML parse mode.

Three deployable units:

- `src/` — the Worker (bot webhook + REST API + public API). Deployed via `wrangler deploy` to `azadi-coffee-bot` worker.
- `admin-app/` — a Telegram Mini App (React + Vite). Deployed to Cloudflare Pages at `azadi-admin.pages.dev`. **The Worker does not serve it.**
- `menu-app/` — a public menu website (React + Vite). Deployed to Cloudflare Pages at `www.azadiroastery.ir` (fallback: `azadi-menu.pages.dev`). **The Worker does not serve it.**

## Commands

```bash
# Worker (root)
npm ci                              # install
npm test                            # vitest run (all)
npx vitest run src/tests/numbers.test.ts    # single test file
npx vitest run -t "formatPersianPrice"      # single test by name
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint (root config: eslint.config.mjs)
npm run format:check                # prettier --check (no writes)
npm run format                      # prettier --write (auto-fixes)
npm run check                       # typecheck + lint + format:check + test (all-in-one)
npm run deploy                      # wraps `npm exec -- wrangler deploy`
npm run setup:webhook               # reads TELEGRAM_BOT_TOKEN and SECRET_TOKEN from ~/.env
./deploy.sh --dry-run               # pre-flight: test → typecheck → lint → build (no deploy)

> **Test timeout**: `vitest.config.mjs` sets a 30-second timeout for the router harness's dynamic imports. Tests that import the harness may need this headroom.

# Admin Mini App
cd admin-app
npm install
npm run dev                         # vite dev server (proxies not configured — see below)
npm run preview                     # vite preview (serve built output locally)
npm run build                       # tsc + vite build (also what CI runs)
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint (admin-app config: admin-app/eslint.config.mjs)
npm run format:check                # prettier --check
npm run check                       # typecheck + lint + format:check (all-in-one)
```

# Menu Website (Second Mini App)

```bash
cd menu-app
npm install
npm run dev                         # vite dev server
npm run build                       # tsc + vite build (also what CI runs)
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint (menu-app config: menu-app/eslint.config.mjs)
npm run check                       # typecheck + lint + format:check (all-in-one)
```

CI (`.github/workflows/deploy.yml`): three parallel jobs:

1. `test-and-deploy` — Worker tests + `wrangler deploy`
2. `deploy-admin-app` — admin-app build + `wrangler pages deploy admin-app/dist --project-name=azadi-admin`
3. `deploy-menu-app` — menu-app build + `wrangler pages deploy menu-app/dist --project-name=azadi-menu`

**CI is the ONLY auto-deployment path** — push to `main` deploys all three. Local `deploy.sh` is for pre-flight validation only (see [[ci-is-single-deploy-mechanism]]).

## Architecture

### Request entry (`src/index.ts`)

Worker `fetch` routes:

- `/api/public/*` → `handlePublicApiRequest()` in `src/api/public.ts` (no auth, menu website)
- `/api/*` → `handleApiRequest()` in `src/api/router.ts` (admin REST API, auth required)
- `/webhook` → grammY `webhookCallback("cloudflare-mod")` after validating `X-Telegram-Bot-Api-Secret-Token`
- Anything else → 404

`setRequestContext(env, ctx)` is called per-request and stores them in module globals (`src/requestContext.ts`). Works because Workers isolate each request, but **breaks in tests** — mock `env` directly.

Worker `scheduled` handler: runs `sweepStreaks(env)` on the daily cron (`0 21 * * *` in `wrangler.toml`). Gated by `env.STREAK_CRON_ENABLED` — inert if not set.

### Bot (`src/bot.ts`, `src/types/context.ts`)

- `createBot(env)` returns a `Bot<MyContext>`. `botInstance` is cached at module scope in `src/index.ts`.
- Middleware order matters:
  1. Inject `ctx.env` / `ctx.execCtx` from request context
  2. **DataService injection** — creates `DataService(env.DB, env.CACHE ? new CacheService(env.CACHE) : undefined)` per-request, attached to `ctx.dataService`. All bot handlers and menus use this for data access (read-through KV caching + D1 batch). Direct repository instantiation is eliminated from handlers/menus (except write-side operations like `AiLogRepository`).
  3. **Streak counter** — gated by `env.STREAK_MESSAGES === 'true'` (off by default). Writes to `user_state` via `UserStateRepository.upsertVisit` on every non-`/` message; replies with the streak-increment message in `ctx.execCtx.waitUntil` so the rest of the chain isn't blocked. **Never re-throw** (the streak path must not break the bot chain — wrapped in `try/catch` with a `console.error` only).
  4. `session({ storage: new D1SessionStorage(env.DB) })`
  5. **Idempotency guard**: skip duplicate `update_id` (Telegram retry protection)
  6. `conversations({ storage: { type: "key", prefix: "convo_", adapter: new D1SessionStorage(env.DB) } })` — gated by `env.USE_CONVERSATIONS === 'true'` (off by default; see Pitfalls). When on, must use persistent storage + `prefix: "convo_"` so session and conversation state don't overwrite each other in D1
  7. `mainMenu` (grammY menu)
  8. Command & handler registration
- `MyContext` = `Context & SessionFlavor<SessionData> & ConversationFlavor<Context> & { env, execCtx?, dataService: IDataService }`. **Always use this type** for handlers. `dataService` is the single data access layer with read-through KV caching.
- **Product display**: `formatProduct()` in `src/utils/formatters.ts` shows nutritional info (calories, caffeine, allergens) when present. Bot uses `replyWithPhoto(url)` for products with images, falling back to `reply()` for text-only. Coffee details callback shows `brewGuide` for coffee beans.

### Database (`src/database/`, `src/repositories/`)

- Drizzle schema in `src/database/schema.ts` (snake_case columns, explicit `text('name')` strings). Migrations in `drizzle/`.
- **D1 migrations**: `npx drizzle-kit generate` creates SQL in `drizzle/`. Apply with `wrangler d1 execute azadi-db --remote --file=drizzle/XXXX_name.sql`. **Never use `drizzle-kit push`** — D1 doesn't have a URL. See [[d1-migrations-use-wrangler]].
- `getDb(d1Binding)` (`src/database/client.ts`) is the only Drizzle factory. Repositories call it in their constructor.
- **Repository pattern**: one class per table group (`ProductRepository`, `CategoryRepository`, `BranchRepository`, `FaqRepository`, `SettingsRepository`, `AiLogRepository`, `MenuConfigRepository`, `UserStateRepository`, `FavoritesRepository`, `MessageRepository`). All take `d1Binding: D1Database` in the constructor. Add new data access as a new repository class.
- **DataService** (`src/services/data/index.ts`, interface at `src/services/types.ts`): the single data access layer for bot handlers. Implements `IDataService` with read-through KV caching via `CacheService` and a `buildAIContextBatch()` method that collapses 8 D1 queries into 1 batch call. **All bot data access goes through `ctx.dataService`** — do not instantiate repositories directly in handlers or menus.
- `D1SessionStorage` (`src/database/sessionStorage.ts`) is a grammY `StorageAdapter` that reads/writes the `sessions` table (key/value JSON).
- **Schema tables** (13): `branches`, `categories`, `products`, `coffee_details`, `faq`, `settings`, `ai_conversation_logs`, `sessions`, `admins`, `menu_config`, `user_state`, `favorites`, `messages`.

### Admin REST API (`src/api/router.ts`)

- Auth header: `Authorization: Telegram <initData>`. Validates via `validateInitData` (src/api/auth.ts) and looks up the telegram user in the `admins` table.
- Two roles: `super_admin` (full access) and `category_admin` (restricted to one `categoryId`). `category_admin` write paths enforce `allowedCategoryId` against `body.categoryId` / `product.categoryId`.
- Resources: `admins`, `settings`, `categories`, `menu-config` (+ `/reorder`), `products` (+ `/batch`, `/{id}/stock`, `/{id}/toggle`, `/{id}/image`), `faqs`, `branches`, `currentUser`.
- **Product images**: stored as full public URLs in D1 (`imageUrl` column). Admins paste URLs from free hosts (imgbb, imgur, etc.) via the admin app. `PUT /products/:id/image` accepts `{ imageUrl: string }` (validates URL format). `DELETE /products/:id/image` clears the field. Bot displays via `replyWithPhoto(url)` when `imageUrl` is set. **R2 is not used** — requires credit card activation. See [[r2-requires-credit-card]].
- **Menu visibility**: `menu_visible_*` keys in `settings` table control which top-level bot menu sections are shown. Missing key = visible (safe default). Bot reads per-request via `isMenuVisible()` from `src/utils/menuVisibility.ts`. Admin toggles in the "Menu Visibility" card on SettingsPage.
- **Messages envelope**: `GET /messages` returns `{ messages: [...] }` (envelope, not bare array). `GET /messages/unread-count` and `GET /messages/:id` return shaped objects — no change.
- All responses use `corsHeaders` (`Access-Control-Allow-Origin: *`); `OPTIONS` is preflight-only.

### AI fallback (`src/services/aiService.ts`, `src/handlers/message.ts`)

- `message:text` handler skips when text starts with `/` (commands are handled upstream). When `USE_CONVERSATIONS` is enabled and a wizard is active, you must add a `ctx.hasActiveConversation` skip here — see Pitfalls.
- Loads context via `ctx.dataService.buildAIContextBatch(userId)` — a single D1 batch call that collapses 8 queries (products, branches, faqs, menu config, about, recent logs, favorites, popular products) into 1 round-trip. Builds enriched context via `buildMinimalContext` (options object form in `src/utils/menuContext.ts`), then calls OpenCode API (`mimo-v2.5` model via `OPENCODE_API_KEY` secret).
- **Context enrichment**: `buildMinimalContext` now includes shop identity (about text), enriched product details (farm, altitude, processing, brew guide, nutritional info), product flags (⭐ Featured, 🌿 Seasonal), and popular items (most-favorited across all users). The AI system prompt (`AiService`) has a comprehensive personality, language rules, and personalization section that includes the user's favorited products for tailored recommendations.
- 20s timeout via `Promise.race`. Logs to `ai_conversation_logs` after replying (in `ctx.execCtx.waitUntil` if available so the response isn't blocked).
- `PERF_LOG === 'true'` env var emits per-request timing JSON to stdout.

### Admin Mini App (`admin-app/`)

React + Vite + `@telegram-apps/sdk` (v2). The Mini App is loaded inside Telegram, not a standalone browser app:

- Auth: `retrieveLaunchParams()` from `@telegram-apps/sdk` returns `initData`; the app sends it as `Authorization: Telegram <initData>` to the Worker API. The Worker validates the signature against `TELEGRAM_BOT_TOKEN`.
- **Two URLs to keep in sync** when changing environments:
  - The Mini App URL (opened by the bot's "Open Admin" button) is hardcoded in `src/commands/admin.ts` as `https://azadi-admin.pages.dev`.
  - The API base URL is hardcoded in `admin-app/src/App.tsx` as `https://azadi-coffee-bot.zahedrastgar316.workers.dev/api` — this is the **same** Worker that serves the bot, just at `/api/*`.
- Communication is exclusively via the REST API in `src/api/router.ts`. The Mini App **does not** call the bot.

### Menu Website (`menu-app/`)

React 18 + Vite 6 + HashRouter + TanStack Query v5. Public-facing, read-only menu site — no Telegram SDK, no auth:

- API base: `https://azadi-coffee-bot.zahedrastgar316.workers.dev/api/public` (hardcoded in `menu-app/src/api/client.ts`). No auth header.
- Routes: `/` (home), `/category/:id`, `/product/:id`, `/featured`, `/seasonal`, `/branches`, `/faq`.
- React Query `staleTime: 5 * 60_000` (5 minutes). `gcTime: 5 * 60_000` (5 minutes).
- **RTL layout** (`dir="rtl"` on `<html>`). All UI text in Persian.
- Deployed to `www.azadiroastery.ir` via CI (fallback: `azadi-menu.pages.dev`).

### Public API (`src/api/public.ts`)

No-auth endpoints at `/api/public/*` for the menu website. CORS wildcard. **All responses use an envelope** — `{key: [...]}` — where the key matches the resource name. The menu-app's `apiFetch<T>(path, envelopeKey)` unwraps this; pass the envelope key as the second arg.

Envelope keys: `categories`, `products`, `product`, `branches`, `faqs`, `sections`, `settings`.

Filtering rules:

- Products: `available = true` only. Supports `?categoryId=N` query param for server-side filtering. Stock hidden for `cup` units.
- Menu config: `isVisible = true` only, ordered by `displayOrder`.
- Branches: `isActive = true` only.
- Settings: only whitelisted keys (`about`, `price_unit`, `instagram`).
- Route order matters: `/featured` and `/seasonal` must be registered before `/:id` to avoid capturing those paths.

## Conventions

- **All bot text is Persian, HTML parse mode.** Use `toPersianDigits()` and `formatPersianPrice(amount, unit)` from `src/utils/numbers.ts`. `formatPersianPrice` wraps the price run in LRI/PDI (U+2066/U+2069) so it stays LTR inside RTL sentences — keep the isolates.
- **Price unit is editable** via the `price_unit` key in the `settings` table (admin app). Bot code reads it through `ctx.dataService.getSetting('price_unit')` with `DEFAULT_PRICE_UNIT` (`تومان`) as fallback. Phone numbers and opening hours stay Latin digits (dial-ability); prices, stock, page numbers go Persian.
- **Registered bot commands**: only `/start` and `/admin` (plus `/setup_bot` for the bot owner to push them). Do not add more without updating `setMyCommands` in `src/commands/admin.ts`.
- **Menu navigation**: lists use `editMessageText(...).catch(() => ctx.reply(...))` to edit in place with fresh-reply fallback. Detail replies carry a `back:main` inline button handled in `src/handlers/callbackQuery.ts`.
- **Mini App UX**: toast notifications via `showToast()` (never `alert()`), form fields wrapped in `<Field label>` (placeholder is a hint, not a label), every list renders an `.empty-state` block when empty, Persian data elements get `dir="auto"` while chrome stays English.
- **Tests**: `src/tests/*.test.ts`, vitest (`import { expect, test } from 'vitest'`). `vitest.config.mjs` at root sets a 30s timeout for dynamic imports. The Worker API tests in `src/tests/router-*.test.ts` share a harness at `src/tests/_helpers/routerHarness.ts` that mocks Drizzle, `validateInitData`, and `getAdminRole` to exercise `handleApiRequest` end-to-end. **Caveat**: the harness's `extractEq()` parser only matches Drizzle's `eq()` shape; any other predicate (`and`//`or`/`gt`/etc.) silently no-ops, so tests pass without actually filtering — see the global memory `permissive-where-parsers-mask-sql-bugs`.
  - **Cache tests**: spy on `CacheService.prototype` methods, not the KV mock directly — `CacheService.deleteByPrefix` pages through `kv.list()` internally; mocking KV makes it silently no-op. See `src/tests/router-cache.test.ts`.
  - **Mocking classes**: pass the class directly in `vi.mock()` — wrapping in `vi.fn().mockImplementation()` returns a non-constructable mock. See project memory `vitest-mock-class-no-fn-wrap`.
- **Errors**: catch blocks log to `console.error`, reply with Persian error messages to users.
- **Delete ordering**: when deleting resources with cross-store references (D1 + external), update D1 first then the external store. A dangling URL is less harmful than a missing resource with a live reference. See [[db-first-delete-ordering]].

## Pitfalls

- **Hardcoded D1 `database_id` in `wrangler.toml`** — don't change it without updating the Cloudflare dashboard binding. **wrangler deploy validates all bindings** — if `wrangler.toml` references a non-existent R2 bucket, KV namespace, or D1 database, deploy fails even if code doesn't use it. Run `wrangler deploy --dry-run` after binding changes. See [[wrangler-deploy-validates-bindings]].
- **`requestContext.ts` module globals are not safe to share across test cases.** Mock `env` directly.
- **`setup:webhook` script reads `SECRET_TOKEN` from `~/.env`** alongside `TELEGRAM_BOT_TOKEN`. To rotate, edit `~/.env` (`SECRET_TOKEN=...`) and re-run `npm run setup:webhook`. Do not commit either token to source control.
- **`admin-app/` is a separate package** with its own `node_modules`. Run `npm install` inside it independently.
- **Cloudflare Pages staleness**: `wrangler deploy` only updates the Worker. If the Mini App looks stale, check the Pages deployment (`azadi-admin.pages.dev`). Verify the live asset hash: `curl -s https://azadi-admin.pages.dev | grep -o '/assets/index-[^"]*\.css'` and compare against `admin-app/dist/assets/`. CI takes ~1-3 min after push to update Pages.
- **Mini App bottom-nav overflow**: `admin-app/src/index.css` `.bottom-nav` is a fixed flex row that intentionally uses `overflow-x: auto` with `flex-shrink: 0` + `white-space: nowrap` on `.nav-item` so all 7 super_admin tabs scroll into reach. Don't revert it to `justify-content: space-around`.
- **`wrangler-action@v3` peer dep conflict**: v3 installs Wrangler v3.x which wants `@cloudflare/workers-types@^4.x`, but this repo uses v5.x. Both deploy steps in `.github/workflows/deploy.yml` set `NPM_CONFIG_LEGACY_PEER_DEPS: 'true'` — don't remove it.
- **Admin conversational wizards were removed from the chat interface** to avoid a webhook-retry / AI-fallback race condition (conversations stored state per-request, so retries fell through to the AI handler). All multi-step admin data entry now goes through the Mini App + REST API. The `conversations()` middleware itself is **gated by `env.USE_CONVERSATIONS === 'true'`** in `src/bot.ts` so re-introduction is a config flip — not a code change. If you flip it on, you MUST also add a `ctx.hasActiveConversation` snapshot middleware (BEFORE any `createConversation()` enter) AND a `if (ctx.hasActiveConversation) return;` skip at the top of `src/handlers/message.ts:9` — otherwise a wizard's final message will be answered by the AI rather than by the wizard. See `src/bot.ts` for the place-marker comment.
- **Drinks don't show stock in `formatProduct`**: stock is intentionally hidden when `p.unit === 'cup'` (drinks are made-to-order). Don't add stock display to `cup` units — it would imply per-drink inventory that doesn't exist.
- **`PERF_LOG` is a per-request env flag**, not a build-time one. Set it on the Worker (`wrangler secret put PERF_LOG` or in dashboard) to enable JSON timing lines on stdout. Off by default.
- **`STREAK_MESSAGES` is a per-request env flag** that gates the streak middleware (`src/bot.ts:44-61`). Off by default. Set with `echo "true" | wrangler secret put STREAK_MESSAGES` to enable consecutive-day tracking and the `🔥 N روز متوالی` reply. **Phase 5 verified end-to-end 2026-08-06**: with the flag set, `user_state` rows are created on first non-`/` message and `visits_total` increments per message; without the flag the middleware is inert (the empty-table behavior the prior session observed is _expected_, not a bug).
- **Favorites (Phase 5.2)** — callback handlers `fav:add:${id}` and `fav:remove:${id}` are in `src/handlers/callbackQuery.ts` (~lines 313 and 332). **Phase 5 verified end-to-end 2026-08-06**: 3 rows appeared in `favorites` after the user tapped the toggle on three product detail pages in a single smoke-test session, confirming the toggle works through the cached reply_markup. If a future smoke test sees an empty `favorites` table, the most likely causes are (a) the user never navigated to a product detail page, or (b) a stale keyboard from a pre-Phase-5 build is still cached in their Telegram client (fix: close and reopen the chat).
- **ESLint/Prettier is blocking in CI.** Both `deploy-admin-app` and `deploy-menu-app` jobs run lint and format checks as hard gates (no `continue-on-error`). The root `test-and-deploy` job also runs lint and format checks before deploy. Fix any lint/format failures before pushing to `main`. Lint config: `eslint.config.mjs` (root, governs `src/`) and `admin-app/eslint.config.mjs` (React + Vite). Prettier config: `.prettierrc.json` (root) + `.prettierignore`. Both packages use `node ./node_modules/...` shebang-free script invocations to avoid the Termux `/usr/bin/env` gap (see [[android-arm64-platform-binary-gaps]]).
- **Unused npm dependencies**: None currently. Previously removed: `@grammyjs/auto-retry`, `@grammyjs/parse-mode`, `@grammyjs/router`, `tsx`.
- **Stack trace leakage**: `src/index.ts` error handler previously included `err.stack` in 500 JSON responses — information disclosure. Current code sanitizes this but be aware if modifying error handling.
- **Menu-app API envelope**: Every public API endpoint wraps its response in `{key: [...]}`. Forgetting to pass the `envelopeKey` to `apiFetch` means the page gets the wrapper object instead of the data array, causing `.map()` to silently produce nothing (empty page) or crash (white page). When adding new pages, always check `src/api/public.ts` for the envelope key.

## Memory (project-scoped only — global rules live in `~/.claude/CLAUDE.md` and are loaded automatically)

This project has session memory at `~/.claude/projects/-data-data-com-termux-files-home-repo-azadi/memory/`. The index in `MEMORY.md` there points to lessons about the local environment (Termux android-arm64 specifics, zsh managed-block convention) that affect how tooling around this repo is set up. Load those memories when bootstrapping a new toolchain, debugging shebang/binary errors, or appending to `~/.zshrc`. The earlier "## Memory" section at the top of this file covers the global memory + global rules paths.

- [ai-chat-two-round-execution](memory/ai-chat-two-round-execution.md) — when model reads data but doesn't generate writes, feed results back in second API call

```

```
