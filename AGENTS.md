# Memory

## Project Overview
Azadi Coffee Roastery — Telegram bot + admin panel for a coffee shop in Iranshahr, Iran. Cloudflare Workers backend, grammY bot framework, D1 database (Drizzle ORM), Cloudflare Workers AI for chat fallback. Admin management via a standalone React Mini App (admin-app/). Persian UI text in all bot replies.

## Build & Test
```
npm ci                          # install (CI uses npm, not pnpm)
npm test                        # vitest run (unit tests only)
./node_modules/.bin/tsc --noEmit  # typecheck
npm run deploy                  # wrangler deploy
npm run deploy:dry              # wrangler deploy --dry-run to ~/wrangler-dry
npm run setup:webhook           # curl to set Telegram webhook
```
CI (GitHub Actions): npm ci → vitest → tsc --noEmit → wrangler deploy (main only).
Admin Mini App is deployed separately to Cloudflare Pages — see Deployment section below.

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
```

## Dev Environment
- **Runtime**: Cloudflare Workers (TypeScript, `"type": "commonjs"`)
- **tsconfig**: ES2022 target/module, strict mode, `@cloudflare/workers-types`
- **Database**: Cloudflare D1 (SQLite), Drizzle ORM. Schema: `src/database/schema.ts`. Migrations: `drizzle/` directory.
- **Wrangler config**: `wrangler.toml` — bindings: `DB` (D1), `AI` (Workers AI)
- **Required secrets** (gitignored via `.env`): `TELEGRAM_BOT_TOKEN`, `SECRET_TOKEN`
- **AI model**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Cloudflare Workers AI

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

## Architecture Notes

- **Module-level request context**: `src/requestContext.ts` stores `env` and `ExecutionContext` as module globals, set per-request in `src/index.ts`. This works because Workers isolate each request, but means you cannot import these in tests without mocking.
- **Repository pattern**: All DB access goes through repository classes in `src/repositories/index.ts`. Each takes a D1 binding in its constructor and wraps a `getDb()` call. Follow this pattern for new data access.
- **grammY Conversations Persistence**: When using `@grammyjs/conversations` (v2.x) in a serverless environment (Cloudflare Workers), NEVER initialize it with `bot.use(conversations())` as it defaults to an in-memory map that wipes between requests. You MUST explicitly configure it to use persistent storage (e.g., `D1SessionStorage`) and provide a unique prefix (`prefix: "convo_"`) to prevent overwriting the main session data.
- **Conversations & AI Race Conditions**: When using `@grammyjs/conversations` alongside a slow fallback handler (like an AI service), Telegram webhook retries can cause race conditions. If the final step of a conversation (e.g., database update) takes too long, Telegram will retry the webhook. Because `session` data is only saved at the *end* of the request, session-based idempotency (`lastUpdateId`) fails for concurrent retries. The retry will find an empty conversation state and fall through to the AI handler.
  - **Definitive Solution applied to this codebase**: We completely removed admin conversational wizards from the chat interface. Admin multi-step data entry is now handled via a standalone Telegram Mini App (Web App) connecting to REST endpoints on the Cloudflare Worker, entirely isolating it from the webhook AI loop.
- **Admin auth**: Two roles — `super_admin` (full access) and `category_admin` (restricted to one category). Auth middleware in `src/middlewares/auth.ts`. API routes in `src/api/router.ts` use Telegram Mini App `initData` for auth (header: `Authorization: Telegram <initData>`).
- **Bot context type**: `MyContext` (defined in `src/types/context.ts`) combines grammY `Context`, `SessionFlavor<SessionData>`, `ConversationFlavor`, and custom fields (`env`, `execCtx`, `hasActiveConversation`). Always use this type for bot handlers.
- **Conversation leak guard**: A middleware snapshots `conversation.active()` into `ctx.hasActiveConversation` *before* `createConversation()` runs. The message handler checks this flag to prevent a completed wizard's final message from falling through to the AI handler.

## Conventions
- All user-facing bot text is in **Persian (Farsi)**, using HTML parse mode.
- Repositories: one class per table group, constructor takes `d1Binding: any`.
- Tests: `src/tests/*.test.ts`, use vitest (`import { expect, test } from 'vitest'`). No vitest config file — uses defaults.
- Drizzle schema uses `sqliteTable` with explicit column name strings matching snake_case DB columns.
- Error handling: catch blocks log to `console.error`, reply with Persian error messages to users.

## Common Workflows
Document frequently used workflows and commands here.

## Pitfalls
- `pnpm-lock.yaml` exists but CI uses `npm ci`. If you add/remove deps, update both lockfiles or switch CI to pnpm.
- `wrangler.toml` has a hardcoded D1 `database_id`. Do not change it without updating the Cloudflare dashboard binding.
- `requestContext.ts` module globals are not safe to share across test cases. Tests should mock `env` directly rather than calling `setRequestContext`.
- The `setup:webhook` script embeds a hardcoded `secret_token` — rotate it if compromised.
- `admin-app/` is a separate package with its own `node_modules`. Run `npm install` inside it independently.
- **Cloudflare Pages staleness**: The admin Mini App is hosted on Cloudflare Pages (`azadi-admin.pages.dev`), NOT served by the Worker. `wrangler deploy` only updates the Worker. If the Mini App UI looks outdated, verify the Pages deployment — the live bundle hash can be checked with `curl -s https://azadi-admin.pages.dev | grep -o '/assets/index-[^"]*\.css'` (or `\.js`) and compared against `admin-app/dist/assets/`. CSS-only edits change only the CSS hash; check whichever asset you touched. CI takes ~1-3 min after push to update the Pages site.
- **Mini App bottom-nav overflow**: `admin-app/src/index.css` `.bottom-nav` is a fixed flex row. With many tabs (7 for super_admin) it overflows phone-width screens and clips trailing tabs. It is intentionally `overflow-x: auto` with `flex-shrink: 0` + `white-space: nowrap` on `.nav-item` so all tabs scroll into reach — do not "fix" it back to `justify-content: space-around` without keeping the overflow handling.
- **pnpm test quirk (local/Termux)**: `pnpm run test` fails before tests start when `node_modules` were installed via `npm ci` — pnpm's deps-status check crashes on the mismatched install state. Use `npm test` (what CI runs). This is an environment quirk, not a code failure.
- **wrangler-action peer deps**: `cloudflare/wrangler-action@v3` installs Wrangler v3.x which peer-depends on `@cloudflare/workers-types@^4.x`, but this repo uses v5.x. Both deploy steps in `.github/workflows/deploy.yml` set `NPM_CONFIG_LEGACY_PEER_DEPS: 'true'` to avoid ERESOLVE. Do not remove this env var unless the peer dependency conflict is resolved upstream.
