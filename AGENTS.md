# AGENTS.md

> **This file is the persona-specific companion to CLAUDE.md.** Read CLAUDE.md first. CLAUDE.md is the canonical source for commands, architecture, and pitfalls. If this file disagrees with CLAUDE.md, this file is stale — update it to match.
>
> **Global rules are binding.** The rules in `~/.claude/CLAUDE.md` take precedence over any project-specific guidance in this file or in CLAUDE.md. If they conflict, the global rules win — and this file should be updated to reconcile.

## Project Overview

Azadi Coffee Roastery — Telegram bot + admin Web App for a coffee shop in Iranshahr, Iran. Cloudflare Workers backend, grammY bot framework, D1 database (Drizzle ORM), OpenCode API (`mimo-v2.5`) for chat fallback. Public menu website at [www.azadiroastery.ir](https://www.azadiroastery.ir). Persian UI text in all bot replies.

**Three deployable units:**
1. `src/` — Worker (bot webhook + REST API + public API)
2. `admin-app/` — Admin Mini App (React + Vite, Cloudflare Pages)
3. `menu-app/` — Public menu website (React + Vite, Cloudflare Pages)

## Build & Test

```bash
# Worker (root)
npm ci                              # install
npm test                            # vitest run (all)
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint (root config: eslint.config.mjs)
npm run format:check                # prettier --check
npm run format                      # prettier --write
npm run check                       # typecheck + lint + format:check + test
npm run deploy                      # npm exec -- wrangler deploy
npm run deploy:dry                  # wrangler deploy --dry-run --outdir ./wrangler-dry
npm run setup:webhook               # reads TELEGRAM_BOT_TOKEN + SECRET_TOKEN from ~/.env
./deploy.sh --dry-run               # pre-flight: test, typecheck, lint, build
```

**Test timeout:** `vitest.config.ts` sets a 30-second timeout for the router harness's dynamic imports. Tests that import the harness may need this headroom.

```bash
# Admin Mini App
cd admin-app
npm install
npm run dev                         # vite dev server
npm run build                       # tsc + vite build (also what CI runs)
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint (admin-app/eslint.config.mjs)
npm run format:check                # prettier --check
npm run check                       # typecheck + lint + format:check
```

```bash
# Menu Website
cd menu-app
npm install
npm run dev                         # vite dev server
npm run build                       # tsc + vite build (also what CI runs)
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint (menu-app/eslint.config.mjs)
npm run format:check                # prettier --check
npm run check                       # typecheck + lint + format:check
```

**CI (GitHub Actions):** Three parallel jobs — `test-and-deploy` (Worker), `deploy-admin-app` (admin-app), `deploy-menu-app` (menu-app). Each runs typecheck, lint, format check, and build. Deploy steps run only on push to `main`.

**CI is the ONLY auto-deployment path** — push to `main` deploys all three units. Local `deploy.sh` is for pre-flight validation only.

## Deployment

- **Worker:** `wrangler deploy` via `cloudflare/wrangler-action@v3` on push to main.
- **Admin Mini App:** `wrangler pages deploy admin-app/dist --project-name=azadi-admin` via a separate CI job.
- **Menu Website:** `wrangler pages deploy menu-app/dist --project-name=azadi-menu` via a separate CI job.
- **Bot entry point:** `src/commands/admin.ts` hardcodes the Mini App URL as `https://azadi-admin.pages.dev`. The Worker does NOT serve the admin app.
- **Critical:** Editing `admin-app/src/App.tsx` and running `wrangler deploy` does NOT update the Mini App. The Pages site must be rebuilt and redeployed.

## Dev Environment

- **Runtime:** Cloudflare Workers (TypeScript, `"type": "commonjs"`)
- **tsconfig:** ES2022 target/module, strict mode, `@cloudflare/workers-types`
- **Database:** Cloudflare D1 (SQLite), Drizzle ORM. Schema: `src/database/schema.ts`. Migrations: `drizzle/` directory.
- **Wrangler config:** `wrangler.toml` — bindings: `DB` (D1). **wrangler deploy validates all bindings** — missing bindings block deploy even if code does not use them.
- **Required secrets** (gitignored via `.env`): `TELEGRAM_BOT_TOKEN`, `SECRET_TOKEN`, `OPENCODE_API_KEY`
- **AI provider:** OpenCode API (`mimo-v2.5` model via `OPENCODE_API_KEY` secret).
- **Lint config:** `eslint.config.mjs` (root, governs `src/`) and `admin-app/eslint.config.mjs` (React + Vite). Prettier config: `.prettierrc.json` (root) + `.prettierignore`.

## Architecture Notes

- **Request entry:** `src/index.ts` routes `/api/public/*` to public API, `/api/*` to admin REST API, `/webhook` to grammY. `setRequestContext(env, ctx)` stores env in module globals per-request.
- **Bot:** `createBot(env)` in `src/bot.ts`. Middleware order: context injection, streak counter (gated), session, idempotency guard, conversations (gated), main menu, handlers.
- **MyContext:** `Context & SessionFlavor & ConversationFlavor & { env, execCtx? }`. Always use this type for handlers.
- **Repository pattern:** One class per table group in `src/repositories/index.ts`. Constructor takes `d1Binding: any`. All DB access goes through repositories.
- **Admin auth:** Two roles — `super_admin` (full access) and `category_admin` (restricted to one category). Auth via `Authorization: Telegram <initData>` header.
- **Public API:** No-auth endpoints at `/api/public/*` for the menu website. All responses use an envelope `{key: [...]}`. The menu-app unwraps this via `apiFetch<T>(path, envelopeKey)`.
- **Menu visibility:** `menu_visible_*` keys in `settings` table control which bot menu sections are shown. Bot reads per-request via `isMenuVisible()`.
- **D1 migrations:** `npx drizzle-kit generate` creates SQL. Apply with `wrangler d1 execute --file=...`. **Never use `drizzle-kit push`** — D1 does not have a URL.
- **Conversations (gated):** `conversations()` middleware is gated by `env.USE_CONVERSATIONS === 'true'` (off by default). Re-introduction requires persistent storage with `prefix: "convo_"` AND a `ctx.hasActiveConversation` snapshot middleware. See CLAUDE.md Pitfalls for the full recipe.

## Conventions

- All user-facing bot text is in **Persian (Farsi)**, using HTML parse mode.
- **Numbers in bot messages are Persian digits.** Use `toPersianDigits()` and `formatPersianPrice()` from `src/utils/numbers.ts`. Prices stay LTR inside RTL sentences via LRI/PDI isolates.
- **Price unit is editable** via `price_unit` in the `settings` table. Phone numbers and opening hours stay Latin digits.
- **Drinks do not show stock** in `formatProduct` — stock is hidden when `unit === 'cup'` (drinks are made-to-order).
- Bot commands: only `/start` and `/admin` are registered. Do not add more without updating `setMyCommands`.
- Menu navigation: lists use `editMessageText(...).catch(() => ctx.reply(...))` to edit in place with fresh-reply fallback.
- **Delete ordering:** When deleting resources with cross-store references, update D1 first then the external store.
- **Product images:** Stored as full public URLs in D1. Admins paste URLs from free hosts. Bot displays via `replyWithPhoto(url)`. **R2 is not used** — requires credit card activation.

## Common Workflows

```bash
# Add a new API endpoint
# 1. Create resource file in src/api/resources/<name>.ts
# 2. Register routes in src/api/router.ts
# 3. Add tests in src/tests/router-<name>.test.ts
# 4. Run: npm run check

# Add a new database table
# 1. Add schema to src/database/schema.ts
# 2. Run: npx drizzle-kit generate
# 3. Apply: wrangler d1 execute azadi-db --remote --file=drizzle/XXXX_name.sql
# 4. Create repository class in src/repositories/index.ts

# Deploy changes
# 1. Push to main branch
# 2. CI runs tests, typecheck, lint, format check, build
# 3. CI deploys all three units automatically
```

## Pitfalls

- `wrangler.toml` has a hardcoded D1 `database_id`. Do not change it without updating the Cloudflare dashboard binding.
- `requestContext.ts` module globals are not safe to share across test cases. Mock `env` directly.
- `admin-app/` and `menu-app/` are separate packages with their own `node_modules`. Run `npm install` inside each independently.
- **Cloudflare Pages staleness:** `wrangler deploy` only updates the Worker. If the Mini App looks stale, check the Pages deployment first. CI takes ~1-3 min after push to update Pages.
- **Mini App bottom-nav overflow:** `admin-app/src/index.css` `.bottom-nav` uses `overflow-x: auto` intentionally for 7 super_admin tabs. Do not revert to `justify-content: space-around`.
- **wrangler-action peer deps:** `cloudflare/wrangler-action@v3` needs `NPM_CONFIG_LEGACY_PEER_DEPS: 'true'` due to workers-types version mismatch. Do not remove this env var.
- **Menu-app API envelope:** Every public API endpoint wraps responses in `{key: [...]}`. Forgetting to pass the `envelopeKey` to `apiFetch` returns the wrapper object instead of data.
- **Streak middleware:** Gated by `STREAK_MESSAGES` env flag (off by default). `user_state` table stays empty until the flag is enabled — this is expected.
- **Favorites:** Toggle callbacks `fav:add:${id}` and `fav:remove:${id}` in `src/handlers/callbackQuery.ts`. If the keyboard shows stale buttons, close and reopen the chat.
