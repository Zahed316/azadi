# Conventions

Coding conventions, patterns, and rules that apply across the entire codebase. See also: [pitfalls.md](pitfalls.md) for what goes wrong when these are violated.

## Persian Text Handling

All bot UI text is in Persian (Farsi) using HTML parse mode. The conventions ensure proper display in Telegram's mixed RTL/LTR environment.

### Number Formatting

- **Prices and stock**: Convert to Persian digits using `toPersianDigits()` from `src/utils/numbers.ts`
- **Phone numbers and opening hours**: Keep Latin digits (for dial-ability)
- **Page numbers**: Convert to Persian digits

### Price Display

`formatPersianPrice(amount, unit)` from `src/utils/numbers.ts`:
- Formats the price with Persian digits
- Wraps the price run in **LRI/PDI isolates** (U+2066/U+2069) so the price stays LTR inside RTL sentences
- Uses the configurable `price_unit` setting (default: `تومان`) read via `ctx.dataService.getSetting('price_unit')`

```ts
// Example output: کافه لاته ۴۵,۰۰۰ ‏تومان
// The price is wrapped in LRI/PDI to stay LTR
```

**Always keep the LRI/PDI isolates** when modifying price formatting. Removing them causes the price to render RTL, which looks broken.

### RTL Layout

- Menu-app: `dir="rtl"` on `<html>` element
- Admin-app: `dir="auto"` on Persian data elements, English chrome stays LTR
- Both apps use Persian fonts (`@fontsource/vazirmatn`)

## Error Handling

### Bot Error Messages

All error replies to users are in Persian. Catch blocks log to `console.error` and reply with a user-friendly Persian message. Never expose technical error details to users.

### API Error Responses

The admin API returns structured errors:
- `401` — Missing or invalid `Authorization` header
- `403` — Not an admin, or `category_admin` accessing resources outside their category
- `404` — Resource not found
- `405` — Wrong HTTP method
- `500` — Internal error (stack traces are **never** included in responses — see [pitfalls.md](pitfalls.md))

### CORS

- **Admin API** (`/api/*`): `Access-Control-Allow-Origin: *` with explicit allowed origins for preflight
- **Public API** (`/api/public/*`): `Access-Control-Allow-Origin: *`
- **OPTIONS**: Returns 204 with CORS headers (preflight only)

## Delete Ordering

When deleting resources with cross-store references (D1 + external), **update D1 first, then the external store**:

1. Remove the D1 record
2. Remove the external reference (e.g., image URL)

**Why**: A dangling URL is less harmful than a missing resource with a live reference. If the external deletion fails, the orphaned data can be cleaned up. If D1 deletion fails first, the external reference points to nothing.

See [pitfalls.md](pitfalls.md) for the full rationale.

## Test Patterns

Tests are in `src/tests/*.test.ts`, using Vitest.

### Router Test Harness

`src/tests/_helpers/routerHarness.ts` provides a shared test harness for the admin API:
- Mocks Drizzle queries
- Mocks `validateInitData` (auth)
- Mocks `getAdminRole` (role-based access)
- Exposes `handleApiRequest` for end-to-end testing

**Caveat**: The harness's `extractEq()` parser only matches Drizzle's `eq()` shape. Other predicates (`and`, `or`, `gt`, etc.) silently no-op, so tests may pass without actually filtering. See [pitfalls.md](pitfalls.md).

### Cache Tests

Spy on `CacheService.prototype` methods, **not** the KV mock directly. `CacheService.deleteByPrefix` pages through `kv.list()` internally — mocking KV makes it silently no-op.

```ts
// Correct: spy on the service
vi.spyOn(CacheService.prototype, 'deleteByPrefix');

// Wrong: mocking KV directly
// This makes deleteByPrefix silently no-op
```

### Mocking Classes

Pass the class directly in `vi.mock()` — wrapping in `vi.fn().mockImplementation()` breaks the constructor:

```ts
// Correct
vi.mock('./module', () => ({ MyClass: MyClass }));

// Wrong — returns non-constructable mock
vi.mock('./module', () => ({ MyClass: vi.fn().mockImplementation(() => new MyClass()) }));
```

### Test Timeout

`vitest.config.mjs` sets a 30-second timeout for tests that use the router harness's dynamic imports. If a test imports the harness, it may need this headroom.

## Linting and Formatting

### Tools

- **ESLint**: Config files at root (`eslint.config.mjs`), `admin-app/eslint.config.mjs`, `menu-app/eslint.config.mjs`
- **Prettier**: Config at `.prettierrc.json`, ignores in `.prettierignore`
- Prettier checks **YAML files** too — run it on `.github/workflows/deploy.yml` after manual edits

### CI Enforcement

Both `deploy-admin-app` and `deploy-menu-app` jobs run lint and format checks as **hard gates** (no `continue-on-error`). The root `test-and-deploy` job also runs lint and format checks before deploy.

### `check` Scripts

Both `admin-app/package.json` and `menu-app/package.json` have `check` scripts that run: typecheck + lint + format:check + test. If you add a new check step, add it to the `check` script too.

### Shebang-Free Scripts

Both apps use `node ./node_modules/...` invocations instead of shebangs to avoid the Termux `/usr/bin/env` gap on ARM64 Android. Do not change these to direct shebang calls.

## Registered Bot Commands

Only these commands are registered via Telegram's `setMyCommands`:
- `/start` — Welcome message and main menu
- `/admin` — Opens admin Mini App (auth required)
- `/menu` — Opens menu website
- `/setup_bot` — Re-registers bot commands (bot owner only)

Do not add more commands without updating `setMyCommands` in `src/commands/admin.ts`.

## Menu Navigation

- Lists use `editMessageText(...).catch(() => ctx.reply(...))` — edit in place with fresh-reply fallback
- Detail replies carry a `back:main` inline button handled in `src/handlers/callbackQuery.ts`
- The `menuStack` in session data tracks navigation history for back-button behavior
- Menu visibility is controlled per-section via `menu_visible_*` keys in the `settings` table

## Product Display

- Products with `image_url` use `replyWithPhoto(url)`, falling back to `reply()` for text-only
- Coffee details show `brew_guide` for coffee bean products
- Nutritional info (calories, caffeine, allergens) shown when present via `formatProduct()` in `src/utils/formatters.ts`
- Stock is **hidden** when `unit === 'cup'` (drinks are made-to-order — per-drink inventory doesn't exist)
