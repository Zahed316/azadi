# Known Pitfalls

Every pitfall in this project, expanded with WHY it matters and WHAT goes wrong when violated. Organized by category. Derived from `CLAUDE.md` pitfalls section plus codebase exploration. See also: [conventions.md](conventions.md) for the patterns that prevent these.

## Deployment

### Pages Staleness

**What**: `wrangler deploy` only updates the Worker. The admin app and menu website are separate Cloudflare Pages deployments.

**Why it matters**: After pushing to `main`, the Worker deploys immediately but Pages takes 1–3 minutes. During this window, the Mini App shows stale assets while the API is already updated.

**What goes wrong**: Users see broken functionality because the frontend code references API endpoints or data shapes that changed in the Worker deployment. The admin app shows a blank page or JavaScript errors.

**Verification**:

```bash
curl -s https://azadi-admin.pages.dev | grep -o '/assets/index-[^"]*\.css'
# Compare with ls admin-app/dist/assets/
```

### Wrangler Deploy Validates Bindings

**What**: If `wrangler.toml` references a non-existent R2 bucket, KV namespace, or D1 database, `wrangler deploy` fails — even if the code doesn't use that binding.

**Why it matters**: Deleting a Cloudflare resource (R2, KV, D1) without updating `wrangler.toml` blocks all future deploys.

**What goes wrong**: CI fails on every push until `wrangler.toml` is updated to remove the dangling binding.

**Prevention**: Run `wrangler deploy --dry-run` after changing bindings.

### Legacy Peer Deps

**What**: `wrangler-action@v3` (and v4 with pinned Wrangler 3.x) installs Wrangler v3.x, which wants `@cloudflare/workers-types@^4.x`. This repo uses v5.x.

**Why it matters**: Without `NPM_CONFIG_LEGACY_PEER_DEPS: 'true'`, `npm ci` fails with peer dependency conflicts.

**What goes wrong**: CI `npm ci` step fails, blocking all deployments.

**Prevention**: The `NPM_CONFIG_LEGACY_PEER_DEPS: 'true'` env var is set in all CI jobs. Do not remove it.

### D1 Migrations: Never Use `drizzle-kit push`

**What**: D1 doesn't have a connection URL. `drizzle-kit push` requires one and will fail.

**Why it matters**: The migration workflow is: `npx drizzle-kit generate` (creates SQL in `drizzle/`) → `wrangler d1 execute azadi-db --remote --file=drizzle/XXXX_name.sql` (applies to D1).

**What goes wrong**: Running `drizzle-kit push` produces a cryptic connection error. Developers waste time debugging when the answer is "use `wrangler d1 execute` instead."

### D1 Migrations: No DROP TABLE

**What**: Drizzle `generate` does not create `DROP TABLE` migrations. D1 migrations are additive only.

**Why it matters**: If you remove a table from the schema and run `generate`, no migration is produced to drop the old table.

**What goes wrong**: The old table remains in D1 indefinitely, taking up space and potentially causing confusion.

**Prevention**: Write manual SQL for `DROP TABLE` migrations.

### wrangler-action Version Pin

**What**: `wrangler-action@v4` defaults to Wrangler v4, which has breaking changes.

**Why it matters**: Without pinning `wranglerVersion`, CI may pick up a different Wrangler version than expected.

**What goes wrong**: Deploy fails or behaves unexpectedly because Wrangler v4 changed API behavior.

**Prevention**: Pin `wranglerVersion: '3.90.0'` in the workflow file.

## Data

### Category Admin Write Enforcement

**What**: `category_admin` role restricts access to one category. Write paths must enforce `allowedCategoryId` against `body.categoryId` / `product.categoryId`.

**Why it matters**: Without enforcement, a `category_admin` could modify products in other categories.

**What goes wrong**: Data integrity violation — a coffee shop employee modifies menu items they shouldn't have access to.

### public API Settings Whitelist

**What**: The public API only exposes whitelisted settings: `about`, `price_unit`, `instagram`, `welcome_message`, `vat_note`, `announcement`.

**Why it matters**: Other settings (like `menu_visible_*` keys) are admin-only and should not be public.

**What goes wrong**: Internal configuration is exposed to the public, potentially revealing admin-only information.

### CLAUDE.md Settings Drift

**What**: `CLAUDE.md` only lists 3 settings keys (`about`, `price_unit`, `instagram`) in the public API section, but the code whitelists 6 (`about`, `price_unit`, `instagram`, `welcome_message`, `vat_note`, `announcement`).

**Why it matters**: Documentation drift causes confusion — new developers trust `CLAUDE.md` as the source of truth.

**What goes wrong**: A developer adds a new setting key to the whitelist but doesn't update `CLAUDE.md`, or removes one thinking it's not supposed to be there.

**Prevention**: This documentation (`docs/api.md`) reflects the actual code. `CLAUDE.md` should be updated to match.

## Bot

### Conversations Middleware Gate

**What**: The `conversations()` middleware is gated by `env.USE_CONVERSATIONS === 'true'` (off by default). Re-introducing it requires:

1. `ctx.hasActiveConversation` snapshot middleware **before** `createConversation()` enter
2. A `if (ctx.hasActiveConversation) return;` skip in `src/handlers/message.ts`

**Why it matters**: Without the snapshot middleware, a wizard's final message is answered by the AI fallback instead of the wizard.

**What goes wrong**: A user in a multi-step admin wizard sends their final message, and the AI chatbot answers instead of completing the wizard. This happened before the gate was added — it's why conversations were turned off.

### Message Handler Skip

**What**: `src/handlers/message.ts` skips when text starts with `/` (commands handled upstream). When `USE_CONVERSATIONS` is enabled, you must also add `ctx.hasActiveConversation` skip.

**Why it matters**: Without the skip, active conversations get interrupted by the AI fallback.

**What goes wrong**: A conversation wizard receives AI-generated responses mid-flow, corrupting the wizard state.

### Drinks Don't Show Stock

**What**: `formatProduct()` in `src/utils/formatters.ts` intentionally hides stock when `unit === 'cup'`.

**Why it matters**: Drinks are made-to-order — there's no per-drink inventory. Showing stock implies inventory management that doesn't exist.

**What goes wrong**: Customers see "Stock: 0" for a latte and think it's unavailable, even though the shop makes it fresh.

### auth_date Window

**What**: `MAX_AGE_SECONDS` in `src/api/auth.ts` is 86400 (24 hours) instead of Telegram's recommended 300 (5 minutes).

**Why it matters**: The admin Mini App stays open for hours. With a 5-minute window, auth fails and the app shows degraded state (wrong role).

**What goes wrong**: Admins see a blank page or wrong permissions after the app has been open for more than 5 minutes. The risk is acceptable for trusted admin users.

**Impact on tests**: Tests in `src/tests/auth.test.ts` assert on the 24-hour window boundary.

### Only 2 Bot Commands

**What**: Only `/start` and `/admin` (plus `/setup_bot` for the bot owner) are registered via `setMyCommands`.

**Why it matters**: Adding commands without updating `setMyCommands` in `src/commands/admin.ts` means they won't appear in Telegram's command menu.

**What goes wrong**: Users don't discover new commands because Telegram doesn't show them in the `/` autocomplete.

## Admin App

### @tma.js/sdk Migration

**What**: The old `@telegram-apps/*` packages are deprecated. All imports use `@tma.js/sdk`.

**Why it matters**: The API surface changed significantly between packages.

**Key changes**:

- `themeParamsState` → `themeParams.state`
- `mountThemeParams` → `themeParams.mount()`
- `bindThemeParamsCssVars` → `themeParams.bindCssVars()`

**What goes wrong**: Stale imports cause TypeScript errors and runtime failures. The `check` script catches these via typecheck.

### retrieveRawInitData Required

**What**: `initDataRaw` was removed from `retrieveLaunchParams()` in `@tma.js/sdk` v3. Use `retrieveRawInitData()` instead.

**Why it matters**: Destructuring `{ initDataRaw }` from `retrieveLaunchParams()` returns `undefined` at runtime. TypeScript casts hide this.

**What goes wrong**: The `Authorization` header is empty → silent auth failure → admin app shows degraded state (wrong role or no role).

### Stateful SDK Singletons Need mount()

**What**: `backButton`, `mainButton`, `themeParams`, and other stateful SDK singletons require explicit `mount()` before calling methods.

**Why it matters**: `init()` only sets global config — it does NOT mount components.

**What goes wrong**: Calling `.show()`, `.setParams()`, `.onClick()` on unmounted components throws `FunctionUnavailableError`, caught by ErrorBoundary. The feature silently doesn't work.

**Prevention**: Always `mount()` in `useEffect` setup and `unmount()` in cleanup.

### Mini App Bottom Nav Overflow

**What**: `admin-app/src/index.css` `.bottom-nav` uses `overflow-x: auto` with `flex-shrink: 0` + `white-space: nowrap` on `.nav-item`.

**Why it matters**: There are 7 tabs for super_admin. Without scrolling, tabs overflow and become unreachable.

**What goes wrong**: Reverting to `justify-content: space-around` clips the rightmost tabs. Users can't access Settings or Insights.

### Mini App Two URLs

**What**: Two URLs must stay in sync:

1. Mini App URL (opened by bot): hardcoded in `src/commands/admin.ts` as `https://azadi-admin.pages.dev`
2. API base URL (called by app): hardcoded in `admin-app/src/App.tsx` as `https://azadi-coffee-bot.zahedrastgar316.workers.dev/api`

**Why it matters**: Changing one without the other breaks the connection between the bot's "Open Admin" button and the API the app calls.

**What goes wrong**: The Mini App opens but can't reach the API (blank page or auth errors), or the API points to a different environment.

## Testing

### requestContext.ts Not Safe for Tests

**What**: `src/requestContext.ts` uses module globals. These are safe per-request in Workers (each request is isolated) but NOT safe across test cases.

**Why it matters**: Test cases share the same module scope. One test's `env` leaks into the next.

**What goes wrong**: Flaky tests, incorrect auth results, or wrong database access depending on test execution order.

**Prevention**: Mock `env` directly in tests.

### Router Harness extractEq() Limitation

**What**: The test harness's `extractEq()` parser only matches Drizzle's `eq()` shape. Other predicates (`and`, `or`, `gt`, etc.) silently no-op.

**Why it matters**: Tests that use `and()` or `or()` predicates pass without actually filtering data.

**What goes wrong**: A test asserts "only active products returned" but the filter predicate is silently ignored, so the test passes even if the filter is broken.

### Cache Tests: Spy on CacheService, Not KV

**What**: `CacheService.deleteByPrefix` pages through `kv.list()` internally. Mocking the KV mock directly makes `deleteByPrefix` silently no-op.

**Why it matters**: The cache invalidation test passes but doesn't actually test anything.

**What goes wrong**: Cache invalidation bugs ship to production because the test was testing the mock, not the real behavior.

**Prevention**: Spy on `CacheService.prototype` methods, not the KV mock.

### Vitest Mock Class Wrapping

**What**: Pass the class directly in `vi.mock()`. Wrapping in `vi.fn().mockImplementation()` returns a non-constructable mock.

**Why it matters**: The mock can't be instantiated with `new`, breaking any code that constructs the class.

**What goes wrong**: Tests fail with "not a constructor" errors, or worse, silently produce `undefined` instances.

### worktrees Lack node_modules

**What**: SDD (Software Design Document) worktrees don't have `node_modules`.

**Why it matters**: Running `typecheck`, `lint`, or `format` from a worktree fails because dependencies aren't installed.

**What goes wrong**: CI-like checks fail in worktrees. Developers think the code is broken when it's just missing dependencies.

**Prevention**: Run typecheck/lint/format from the main repo before merge, or install dependencies in the worktree.

### subagent Prettier Skips Docs

**What**: Subagents may not format docs files with Prettier.

**Why it matters**: `format:check` in CI fails on unformatted doc files.

**What goes wrong**: CI fails on a formatting issue in a markdown file that a subagent wrote but didn't format.

**Prevention**: Run `npm run format` after subagent writes to docs files.

## AI

### AI Chat Two-Round Execution

**What**: When the AI model reads data but doesn't generate writes, feed results back in a second API call.

**Why it matters**: The model may need two rounds — first to read data, second to generate a response based on that data.

**What goes wrong**: The AI returns a "I don't have that information" response when it could have answered after reading the data.

### OpenCode mimo-v2.5 No Function Calling

**What**: OpenCode `mimo-v2.5` rejects or garbles OpenAI function calling.

**Why it matters**: Don't send tool definitions to this model — it doesn't support function calling.

**What goes wrong**: The API returns an error or garbled response when tools are included in the request.

## Naming and Identity

### admin-app and menu-app Are Separate Packages

**What**: Both `admin-app/` and `menu-app/` have their own `node_modules`. Run `npm install` inside each independently.

**Why it matters**: Running `npm install` at the root doesn't install frontend dependencies.

**What goes wrong**: `npm run dev` or `npm run build` in either app fails with missing module errors.

### Worker Does Not Serve Apps

**What**: The Cloudflare Worker only handles `/webhook`, `/api/*`, and `/api/public/*`. It does **not** serve the admin app or menu website HTML/JS.

**Why it matters**: Both apps are deployed to Cloudflare Pages separately.

**What goes wrong**: Developers try to serve the apps through the Worker, creating unnecessary complexity.
