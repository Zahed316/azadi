# Memory

> **Canonical rules** live in `CLAUDE.md` (project root) and `~/.claude/CLAUDE.md` (user global). This file is the persona-specific companion; read CLAUDE.md first for the rules that govern commands, architecture, and pitfalls. Treat anything here that disagrees with CLAUDE.md as stale and update this file to match.
>
> **Global rules are binding.** The rules in `~/.claude/CLAUDE.md` take precedence over any project-specific guidance in this file or in `CLAUDE.md`. If they conflict, the global rules win — and this file should be updated to reconcile.

## Project Overview

Azadi Coffee Roastery — Telegram bot + admin panel for a coffee shop in Iranshahr, Iran. Cloudflare Workers backend, grammY bot framework, D1 database (Drizzle ORM), Cloudflare Workers AI for chat fallback. Admin management via a standalone React Mini App (admin-app/). Persian UI text in all bot replies.

## Build & Test

```
npm ci                          # install
npm test                        # vitest run (unit tests only)
npm run typecheck               # tsc --noEmit
npm run lint                    # eslint (root: eslint.config.mjs)
npm run format:check            # prettier --check
npm run format                  # prettier --write
npm run deploy                  # npm exec -- wrangler deploy (uses project-local wrangler)
npm run deploy:dry              # npm exec -- wrangler deploy --dry-run --outdir ./wrangler-dry
npm run setup:webhook           # reads TELEGRAM_BOT_TOKEN + SECRET_TOKEN from ~/.env, then curls setWebhook
./deploy.sh --dry-run           # pre-flight: test → typecheck → lint → build (no deploy)
```

CI (GitHub Actions): npm ci → vitest → lint (non-blocking) → tsc --noEmit → wrangler deploy (main only).
Admin Mini App is deployed separately to Cloudflare Pages — see Deployment section below.

**CI is the ONLY auto-deployment path** — push to `main` deploys both Worker and Pages. Local `deploy.sh` is for pre-flight validation only.

## Deployment

- **Worker**: `wrangler deploy` via `cloudflare/wrangler-action@v3` on push to main.
- **Admin Mini App**: `wrangler pages deploy admin-app/dist --project-name=azadi-admin` via a separate `deploy-admin-app` job in `.github/workflows/deploy.yml`. It runs on the same push trigger and reuses `secrets.CF_API_TOKEN`.
- **Bot entry point**: `src/commands/admin.ts` hardcodes the Mini App URL as `https://azadi-admin.pages.dev`. The Worker does NOT serve the admin app; they are separate Cloudflare resources.
- **Critical**: Editing `admin-app/src/App.tsx` and running `wrangler deploy` (or pushing Worker changes) does NOT update the Mini App. The Pages site must be rebuilt and redeployed. If the Mini App looks stale, check the Pages deployment first.

Admin Mini App (admin-app/):

```
cd admin-app && npm install
npm run dev      # vite dev server
npm run build    # tsc + vite build
npm run lint     # eslint (admin-app/eslint.config.mjs — React + Vite + TSX)
npm run typecheck
npm run format:check
```

## Dev Environment

- **Runtime**: Cloudflare Workers (TypeScript, `"type": "commonjs"`)
- **tsconfig**: ES2022 target/module, strict mode, `@cloudflare/workers-types`
- **Database**: Cloudflare D1 (SQLite), Drizzle ORM. Schema: `src/database/schema.ts`. Migrations: `drizzle/` directory.
- **Wrangler config**: `wrangler.toml` — bindings: `DB` (D1). **wrangler deploy validates all bindings** — if `wrangler.toml` references a non-existent binding, deploy fails even if code doesn't use it. Run `wrangler deploy --dry-run` after binding changes.
- **Required secrets** (gitignored via `.env`): `TELEGRAM_BOT_TOKEN`, `SECRET_TOKEN`, `OPENCODE_API_KEY`
- **AI provider**: OpenCode API (`https://opencode.ai/zen/go/v1/chat/completions`), model `mimo-v2.5`. API key stored as `OPENCODE_API_KEY` secret.

## Code Style Guidelines

- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

## Architecture Notes

- **Module-level request context**: `src/requestContext.ts` stores `env` and `ExecutionContext` as module globals, set per-request in `src/index.ts`. This works because Workers isolate each request, but means you cannot import these in tests without mocking.
- **Repository pattern**: All DB access goes through repository classes in `src/repositories/index.ts`. Each takes a D1 binding in its constructor and wraps a `getDb()` call. Follow this pattern for new data access.
- **grammY Conversations Persistence**: When using `@grammyjs/conversations` (v2.x) in a serverless environment (Cloudflare Workers), NEVER initialize it with `bot.use(conversations())` as it defaults to an in-memory map that wipes between requests. You MUST explicitly configure it to use persistent storage (e.g., `D1SessionStorage`) and provide a unique prefix (`prefix: "convo_"`) to prevent overwriting the main session data.
- **Conversations & AI Race Conditions**: When using `@grammyjs/conversations` alongside a slow fallback handler (like an AI service), Telegram webhook retries can cause race conditions. If the final step of a conversation (e.g., database update) takes too long, Telegram will retry the webhook. Because `session` data is only saved at the _end_ of the request, session-based idempotency (`lastUpdateId`) fails for concurrent retries. The retry will find an empty conversation state and fall through to the AI handler.
  - **Definitive Solution applied to this codebase**: We completely removed admin conversational wizards from the chat interface. Admin multi-step data entry is now handled via a standalone Telegram Mini App (Web App) connecting to REST endpoints on the Cloudflare Worker, entirely isolating it from the webhook AI loop.
  - **Current state**: `conversations()` middleware is **gated by `env.USE_CONVERSATIONS === 'true'`** in `src/bot.ts` (off by default). Re-introduction requires flipping that env flag AND adding a `ctx.hasActiveConversation` snapshot middleware (BEFORE any `createConversation()` enter) AND a `if (ctx.hasActiveConversation) return;` skip at the top of `src/handlers/message.ts:9` — see the comment block in `src/bot.ts` for the recipe.
- **Admin auth**: Two roles — `super_admin` (full access) and `category_admin` (restricted to one category). Auth middleware in `src/middlewares/auth.ts`. API routes in `src/api/router.ts` use Telegram Mini App `initData` for auth (header: `Authorization: Telegram <initData>`).
- **Bot context type**: `MyContext` (defined in `src/types/context.ts`) combines grammY `Context`, `SessionFlavor<SessionData>`, `ConversationFlavor`, and custom fields (`env`, `execCtx`). Always use this type for bot handlers.
- **Streak middleware (Phase 5.1)**: Inserted at `src/bot.ts:44-61`, gated by `env.STREAK_MESSAGES === 'true'` (off by default). On every non-`/` message it calls `UserStateRepository.upsertVisit(telegramId)`; on a new streak day (day > 1) it `waitUntil`s a `🔥 N روز متوالی` reply. Wrapped in `try/catch` so a streak failure never breaks the chain. The `user_state` table will be empty until the flag is enabled — this is expected, not a bug.
- **Favorites (Phase 5.2)**: Callback handlers `fav:add:${id}` and `fav:remove:${id}` live in `src/handlers/callbackQuery.ts` (~lines 313 and 332). The product detail page renders the right toggle button by checking `FavoritesRepository.isFavorited(telegramId, productId)`. Both verified end-to-end 2026-08-06: 3 rows landed in `favorites` from a single smoke-test session.
- **Product display (Phase 6a)**: `formatProduct()` in `src/utils/formatters.ts` shows nutritional info (calories, caffeine, allergens) when present. Bot uses `replyWithPhoto(url)` for products with images, falling back to `reply()` for text-only. Coffee details callback shows `brewGuide` for coffee beans.
- **D1 migrations**: `npx drizzle-kit generate` creates SQL in `drizzle/`. Apply with `wrangler d1 execute azadi-db --remote --file=drizzle/XXXX_name.sql`. **Never use `drizzle-kit push`** — D1 doesn't have a URL.
- **Product images**: stored as full public URLs in D1 (`imageUrl` column). Admins paste URLs from free hosts (imgbb, imgur, etc.) via the admin app. `PUT /products/:id/image` accepts `{ imageUrl: string }` (validates URL format). `DELETE /products/:id/image` clears the field. Bot displays via `replyWithPhoto(url)` when `imageUrl` is set. **R2 is not used** — requires credit card activation.

## Conventions

- All user-facing bot text is in **Persian (Farsi)**, using HTML parse mode.
- **Numbers in bot messages are Persian digits.** Use `toPersianDigits()` and `formatPersianPrice()` from `src/utils/numbers.ts` — never interpolate raw numbers into Persian text. `formatPersianPrice(amount, unit)` wraps the price in LRI/PDI (U+2066/U+2069) bidi isolates so the price run stays LTR inside RTL sentences; keep the isolates.
- **Price unit is editable** via the `price_unit` key in the `settings` table (admin app Settings tab). Bot code reads it through `SettingsRepository.getValue('price_unit')` with `DEFAULT_PRICE_UNIT` (`تومان`) as coded fallback. Phone numbers and opening hours stay Latin digits (dial-ability); prices, stock counts, and page numbers go Persian.
- Repositories: one class per table group, constructor takes `d1Binding: any`.
- Tests: `src/tests/*.test.ts`, use vitest (`import { expect, test } from 'vitest'`). No vitest config file — uses defaults.
- Drizzle schema uses `sqliteTable` with explicit column name strings matching snake_case DB columns.
- Error handling: catch blocks log to `console.error`, reply with Persian error messages to users.
- **Delete ordering**: when deleting resources with cross-store references (D1 + external), update D1 first then the external store. A dangling URL is less harmful than a missing resource with a live reference.
- Bot commands: only `/start` and `/admin` are registered. Do not re-add `/help` or `/cancel` without updating `setMyCommands` in `src/commands/admin.ts`.
- Menu navigation: category/product lists use `editMessageText(...).catch(() => ctx.reply(...))` to edit in place with a fresh-reply fallback. Detail replies carry a `back:main` inline button handled in `src/handlers/callbackQuery.ts`.
- Admin app UX patterns: toast notifications via `showToast()` (never `alert()`), form fields wrapped in the `<Field label>` component (placeholder is a hint, not a label), every list renders an `.empty-state` block when empty, Persian data elements get `dir="auto"` while chrome stays English.

## Common Workflows

Document frequently used workflows and commands here.

## Pitfalls

- `wrangler.toml` has a hardcoded D1 `database_id`. Do not change it without updating the Cloudflare dashboard binding.
- `requestContext.ts` module globals are not safe to share across test cases. Tests should mock `env` directly rather than calling `setRequestContext`.
- The `setup:webhook` script reads `SECRET_TOKEN` from `~/.env` alongside `TELEGRAM_BOT_TOKEN`. To rotate, edit `~/.env` (`SECRET_TOKEN=...`) and re-run `npm run setup:webhook`. Do not commit either token to source control.
- `admin-app/` is a separate package with its own `node_modules`. Run `npm install` inside it independently.
- **Cloudflare Pages staleness**: The admin Mini App is hosted on Cloudflare Pages (`azadi-admin.pages.dev`), NOT served by the Worker. `wrangler deploy` only updates the Worker. If the Mini App UI looks outdated, verify the Pages deployment — the live bundle hash can be checked with `curl -s https://azadi-admin.pages.dev | grep -o '/assets/index-[^"]*\.css'` (or `\.js`) and compared against `admin-app/dist/assets/`. CSS-only edits change only the CSS hash; check whichever asset you touched. CI takes ~1-3 min after push to update the Pages site.
- **Mini App bottom-nav overflow**: `admin-app/src/index.css` `.bottom-nav` is a fixed flex row. With many tabs (7 for super_admin) it overflows phone-width screens and clips trailing tabs. It is intentionally `overflow-x: auto` with `flex-shrink: 0` + `white-space: nowrap` on `.nav-item` so all tabs scroll into reach — do not "fix" it back to `justify-content: space-around` without keeping the overflow handling.
- **wrangler-action peer deps**: `cloudflare/wrangler-action@v3` installs Wrangler v3.x which peer-depends on `@cloudflare/workers-types@^4.x`, but this repo uses v5.x. Both deploy steps in `.github/workflows/deploy.yml` set `NPM_CONFIG_LEGACY_PEER_DEPS: 'true'` to avoid ERESOLVE. Do not remove this env var unless the peer dependency conflict is resolved upstream.
