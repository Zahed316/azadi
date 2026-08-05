# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Persona-specific companion**: `AGENTS.md` is a parallel docs file that records the same kind of project context. It is the _first_ place to look for workflow conventions and pitfalls; this file is the canonical source. If they disagree, this file wins — and `AGENTS.md` should be updated to match.

## Memory

Project-scoped memory lives in `~/.claude/projects/-data-data-com-termux-files-home-repo-azadi/memory/` (index in `MEMORY.md`). Load it when a question matches a slug — these are non-obvious lessons with re-discovery risk, not duplicates of facts already here.

**Global memory** lives in `~/.claude/memory/` (index in `~/.claude/memory/MEMORY.md`) and applies to any project. Load it whenever a slug matches (e.g. Termux toolchain lessons when touching shebangs/binary paths; `permissive-where-parsers-mask-sql-bugs` and `rest-api-target-user-idor-and-nan-bypass` when reviewing REST handlers or test SQL). Treat entries as hypotheses — verify a specific behavioral claim (exit code, error message, version-specific behavior) in the current session before citing it as a diagnosis.

**Global rules are binding.** The rules in `~/.claude/CLAUDE.md` (the user's global instructions) take precedence over any project-specific guidance in this file or in `AGENTS.md`. If they conflict, the global rules win — and this file should be updated to reconcile.

**Global rules** are in `~/.claude/CLAUDE.md`. They are already loaded each session via the system context, but **always re-read that file when starting work that crosses the user's global rules** (CodeGraph usage, the "memory is a hypothesis index" rule, output conventions). The file is the source of truth — never re-derive its contents from memory of past sessions.

## What this is

A Telegram bot + admin Web App for **Azadi Coffee Roastery** (Iranshahr, Iran). Cloudflare Workers backend, grammY bot, D1 (SQLite) via Drizzle ORM, Cloudflare Workers AI for chat fallback. All bot UI text is **Persian (Farsi)** with HTML parse mode.

Two deployable units:

- `src/` — the Worker (bot webhook + REST API). Deployed via `wrangler deploy` to `azadi-coffee-bot` worker.
- `admin-app/` — a Telegram Mini App (React + Vite). Deployed separately to Cloudflare Pages at `azadi-admin.pages.dev`. **The Worker does not serve it.**

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
npm run deploy                      # wraps `npm exec -- wrangler deploy`
npm run deploy:dry                  # wraps `wrangler deploy --dry-run --outdir ./wrangler-dry`
npm run setup:webhook               # reads TELEGRAM_BOT_TOKEN and SECRET_TOKEN from ~/.env

# Admin Mini App
cd admin-app
npm install
npm run dev                         # vite dev server (proxies not configured — see below)
npm run build                       # tsc + vite build (also what CI runs)
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint (admin-app config: admin-app/eslint.config.mjs)
npm run format:check                # prettier --check
```

CI (`.github/workflows/deploy.yml`): `npm ci` → vitest → `lint` (non-blocking) → `tsc --noEmit` → `wrangler deploy` (push to main only), plus a separate `deploy-admin-app` job that builds `admin-app/`, runs `lint` (non-blocking), and runs `wrangler pages deploy admin-app/dist --project-name=azadi-admin`.

## Architecture

### Request entry (`src/index.ts`)

Worker `fetch` routes:

- `/api/*` → `handleApiRequest()` in `src/api/router.ts` (admin REST API)
- `/webhook` → grammY `webhookCallback("cloudflare-mod")` after validating `X-Telegram-Bot-Api-Secret-Token`
- Anything else → 404

`setRequestContext(env, ctx)` is called per-request and stores them in module globals (`src/requestContext.ts`). Works because Workers isolate each request, but **breaks in tests** — mock `env` directly.

### Bot (`src/bot.ts`, `src/types/context.ts`)

- `createBot(env)` returns a `Bot<MyContext>`. `botInstance` is cached at module scope in `src/index.ts`.
- Middleware order matters:
  1. Inject `ctx.env` / `ctx.execCtx` from request context
  2. `session({ storage: new D1SessionStorage(env.DB) })`
  3. **Idempotency guard**: skip duplicate `update_id` (Telegram retry protection)
  4. `conversations({ storage: { type: "key", prefix: "convo_", adapter: new D1SessionStorage(env.DB) } })` — gated by `env.USE_CONVERSATIONS === 'true'` (off by default; see Pitfalls). When on, must use persistent storage + `prefix: "convo_"` so session and conversation state don't overwrite each other in D1
  5. `mainMenu` (grammY menu)
  6. Command & handler registration
- `MyContext` = `Context & SessionFlavor<SessionData> & ConversationFlavor<Context> & { env, execCtx? }`. **Always use this type** for handlers.

### Database (`src/database/`, `src/repositories/`)

- Drizzle schema in `src/database/schema.ts` (snake_case columns, explicit `text('name')` strings). Migrations in `drizzle/`.
- `getDb(d1Binding)` (`src/database/client.ts`) is the only Drizzle factory. Repositories call it in their constructor.
- **Repository pattern**: one class per table group (`ProductRepository`, `CategoryRepository`, `BranchRepository`, `FaqRepository`, `SettingsRepository`, `AiLogRepository`, `MenuConfigRepository`). All take `d1Binding: any` in the constructor. Add new data access as a new repository class.
- `D1SessionStorage` (`src/database/sessionStorage.ts`) is a grammY `StorageAdapter` that reads/writes the `sessions` table (key/value JSON).

### Admin REST API (`src/api/router.ts`)

- Auth header: `Authorization: Telegram <initData>`. Validates via `validateInitData` (src/api/auth.ts) and looks up the telegram user in the `admins` table.
- Two roles: `super_admin` (full access) and `category_admin` (restricted to one `categoryId`). `category_admin` write paths enforce `allowedCategoryId` against `body.categoryId` / `product.categoryId`.
- Resources: `admins`, `settings`, `categories`, `menu-config` (+ `/reorder`), `products` (+ `/batch`, `/{id}/stock`, `/{id}/toggle`), `faqs`, `branches`, `currentUser`.
- All responses use `corsHeaders` (`Access-Control-Allow-Origin: *`); `OPTIONS` is preflight-only.

### AI fallback (`src/services/aiService.ts`, `src/handlers/message.ts`)

- `message:text` handler skips when text starts with `/` (commands are handled upstream). When `USE_CONVERSATIONS` is enabled and a wizard is active, you must add a `ctx.hasActiveConversation` skip here — see Pitfalls.
- Loads `products`, `branches`, `faqs`, `recentLogs`, `visibleCategoryIds` in parallel, builds a minimal context (`buildMinimalContext` in `src/utils/menuContext.ts`), then calls Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
- 20s timeout via `Promise.race`. Logs to `ai_conversation_logs` after replying (in `ctx.execCtx.waitUntil` if available so the response isn't blocked).
- `PERF_LOG === 'true'` env var emits per-request timing JSON to stdout.

### Admin Mini App (`admin-app/`)

React + Vite + `@telegram-apps/sdk` (v2). The Mini App is loaded inside Telegram, not a standalone browser app:

- Auth: `retrieveLaunchParams()` from `@telegram-apps/sdk` returns `initData`; the app sends it as `Authorization: Telegram <initData>` to the Worker API. The Worker validates the signature against `TELEGRAM_BOT_TOKEN`.
- **Two URLs to keep in sync** when changing environments:
  - The Mini App URL (opened by the bot's "Open Admin" button) is hardcoded in `src/commands/admin.ts` as `https://azadi-admin.pages.dev`.
  - The API base URL is hardcoded in `admin-app/src/App.tsx` as `https://azadi-coffee-bot.zahedrastgar316.workers.dev/api` — this is the **same** Worker that serves the bot, just at `/api/*`.
- Communication is exclusively via the REST API in `src/api/router.ts`. The Mini App **does not** call the bot.

## Conventions

- **All bot text is Persian, HTML parse mode.** Use `toPersianDigits()` and `formatPersianPrice(amount, unit)` from `src/utils/numbers.ts`. `formatPersianPrice` wraps the price run in LRI/PDI (U+2066/U+2069) so it stays LTR inside RTL sentences — keep the isolates.
- **Price unit is editable** via the `price_unit` key in the `settings` table (admin app). Bot code reads it through `SettingsRepository.getValue('price_unit')` with `DEFAULT_PRICE_UNIT` (`تومان`) as fallback. Phone numbers and opening hours stay Latin digits (dial-ability); prices, stock, page numbers go Persian.
- **Registered bot commands**: only `/start` and `/admin` (plus `/setup_bot` for the bot owner to push them). Do not add more without updating `setMyCommands` in `src/commands/admin.ts`.
- **Menu navigation**: lists use `editMessageText(...).catch(() => ctx.reply(...))` to edit in place with fresh-reply fallback. Detail replies carry a `back:main` inline button handled in `src/handlers/callbackQuery.ts`.
- **Mini App UX**: toast notifications via `showToast()` (never `alert()`), form fields wrapped in `<Field label>` (placeholder is a hint, not a label), every list renders an `.empty-state` block when empty, Persian data elements get `dir="auto"` while chrome stays English.
- **Tests**: `src/tests/*.test.ts`, vitest (`import { expect, test } from 'vitest'`). No vitest config — uses defaults. The Worker API tests in `src/tests/router-*.test.ts` share a harness at `src/tests/_helpers/routerHarness.ts` that mocks Drizzle, `validateInitData`, and `getAdminRole` to exercise `handleApiRequest` end-to-end. **Caveat**: the harness's `extractEq()` parser only matches Drizzle's `eq()` shape; any other predicate (`and`/`or`/`gt`/etc.) silently no-ops, so tests pass without actually filtering — see the global memory `permissive-where-parsers-mask-sql-bugs`.
- **Errors**: catch blocks log to `console.error`, reply with Persian error messages to users.

## Pitfalls

- **Hardcoded D1 `database_id` in `wrangler.toml`** — don't change it without updating the Cloudflare dashboard binding.
- **`requestContext.ts` module globals are not safe to share across test cases.** Mock `env` directly.
- **`setup:webhook` script reads `SECRET_TOKEN` from `~/.env`** alongside `TELEGRAM_BOT_TOKEN`. To rotate, edit `~/.env` (`SECRET_TOKEN=...`) and re-run `npm run setup:webhook`. Do not commit either token to source control.
- **`admin-app/` is a separate package** with its own `node_modules`. Run `npm install` inside it independently.
- **Cloudflare Pages staleness**: `wrangler deploy` only updates the Worker. If the Mini App looks stale, check the Pages deployment (`azadi-admin.pages.dev`). Verify the live asset hash: `curl -s https://azadi-admin.pages.dev | grep -o '/assets/index-[^"]*\.css'` and compare against `admin-app/dist/assets/`. CI takes ~1-3 min after push to update Pages.
- **Mini App bottom-nav overflow**: `admin-app/src/index.css` `.bottom-nav` is a fixed flex row that intentionally uses `overflow-x: auto` with `flex-shrink: 0` + `white-space: nowrap` on `.nav-item` so all 7 super_admin tabs scroll into reach. Don't revert it to `justify-content: space-around`.
- **`wrangler-action@v3` peer dep conflict**: v3 installs Wrangler v3.x which wants `@cloudflare/workers-types@^4.x`, but this repo uses v5.x. Both deploy steps in `.github/workflows/deploy.yml` set `NPM_CONFIG_LEGACY_PEER_DEPS: 'true'` — don't remove it.
- **Admin conversational wizards were removed from the chat interface** to avoid a webhook-retry / AI-fallback race condition (conversations stored state per-request, so retries fell through to the AI handler). All multi-step admin data entry now goes through the Mini App + REST API. The `conversations()` middleware itself is **gated by `env.USE_CONVERSATIONS === 'true'`** in `src/bot.ts` so re-introduction is a config flip — not a code change. If you flip it on, you MUST also add a `ctx.hasActiveConversation` snapshot middleware (BEFORE any `createConversation()` enter) AND a `if (ctx.hasActiveConversation) return;` skip at the top of `src/handlers/message.ts:9` — otherwise a wizard's final message will be answered by the AI rather than by the wizard. See `src/bot.ts` for the place-marker comment.
- **Drinks don't show stock in `formatProduct`**: stock is intentionally hidden when `p.unit === 'cup'` (drinks are made-to-order). Don't add stock display to `cup` units — it would imply per-drink inventory that doesn't exist.
- **`PERF_LOG` is a per-request env flag**, not a build-time one. Set it on the Worker (`wrangler secret put PERF_LOG` or in dashboard) to enable JSON timing lines on stdout. Off by default.
- **ESLint/Prettier is non-blocking in CI as of Phase 4** (commit pending). Both jobs run `npm run lint` with `continue-on-error: true`; the existing warning baseline (~137 root + ~294 admin) is being whittled down file-by-file. **Do not flip to a hard gate without first checking the current warning count.** Lint config: `eslint.config.mjs` (root, governs `src/`) and `admin-app/eslint.config.mjs` (React + Vite). Prettier config: `.prettierrc.json` (root) + `.prettierignore`. Both packages use `node ./node_modules/...` shebang-free script invocations to avoid the Termux `/usr/bin/env` gap (see [[android-arm64-platform-binary-gaps]]).

## Memory (project-scoped only — global rules live in `~/.claude/CLAUDE.md` and are loaded automatically)

This project has session memory at `~/.claude/projects/-data-data-com-termux-files-home-repo-azadi/memory/`. The index in `MEMORY.md` there points to lessons about the local environment (Termux android-arm64 specifics, zsh managed-block convention) that affect how tooling around this repo is set up. Load those memories when bootstrapping a new toolchain, debugging shebang/binary errors, or appending to `~/.zshrc`. The earlier "## Memory" section at the top of this file covers the global memory + global rules paths.
