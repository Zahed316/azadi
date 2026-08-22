# Security Audit Report — Azadi Coffee Roastery

**Date:** 2026-08-22
**Scope:** Worker backend (`src/`), admin mini app (`admin-app/`), menu website (`menu-app/`)
**Auditor:** Claude Code (automated security audit)
**Methodology:** Parallel security finders (auth, injection, secrets, dependencies, frontend) with adversarial self-verification per finding
**Findings:** 53 total — 0 Critical, 0 High, 1 Medium, 1 Low, 51 Informational

---

## Executive Summary

The Azadi Coffee Roastery codebase — a Telegram bot, admin Web App, and public menu site running on Cloudflare Workers — has a **solid security posture**. Across 53 findings from five parallel audit tracks, no Critical or High severity vulnerabilities were identified.

**Top finding (MEDIUM):** The AI chatbot's system prompt relies on text-based "SECURITY RULES" to resist prompt injection, with no structural delimiter separating system instructions from user input. The practical impact is limited because the bot has no sensitive data access, no write actions, and AI responses are HTML-sanitized before delivery. Worst case: the bot reveals its system prompt or produces off-topic responses.

**One LOW finding:** The bot's per-user AI cooldown (5s) uses an in-memory `Map` that doesn't survive Cloudflare Worker isolate boundaries. Under load, concurrent requests could hit different isolates, bypassing the cooldown and increasing OpenCode API costs. This is a known Workers limitation, acknowledged in code comments, and negligible at this project's scale.

**Everything else is clean:** Authentication uses HMAC-SHA256 with timing-safe comparison. Role enforcement (`super_admin` / `category_admin`) is consistent across all API handlers. SQL uses Drizzle ORM parameterized queries throughout. No XSS vectors exist in either frontend app. All production secrets use Cloudflare Worker secrets. npm audit vulnerabilities are exclusively in dev dependencies.

---

## Findings by Severity

### MEDIUM

#### M-01: AI System Prompt Injection — Text-Based Defense Only

**File:** `src/services/aiService.ts:4-62, 86-108`
**Category:** Injection (Prompt Injection)

The AI system prompt contains a `## SECURITY RULES (NEVER VIOLATE)` section instructing the model not to reveal instructions or follow injected commands. However, there is no structural delimiter (XML tags, special tokens) separating the system prompt from user input. The user message is sent as a separate `{ role: 'user' }` message — the correct API-level separation — but the model can still be influenced by crafted input that mimics system-level instructions.

**Evidence:**

```typescript
// aiService.ts:78-79 — 500-char input truncation limits surface
const MAX_QUERY_LENGTH = 500;
const truncatedQuery = query.slice(0, MAX_QUERY_LENGTH);

// aiService.ts:102-107 — user message appended after system prompt
body: JSON.stringify({
  model: OPENCODE_MODEL,
  messages: [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: truncatedQuery },
  ],
```

**Impact:** A user could extract the system prompt or cause the bot to respond outside its barista persona. Practical impact is low:

- The bot has no sensitive data access or write actions
- The "roguish barista" persona is a soft guardrail
- AI responses pass through `sanitizeTelegramHtml()` (tag allowlist) before Telegram delivery
- 500-char input truncation limits attack surface

**Remediation (optional, defense-in-depth):** Add XML-style delimiters around user input in the system prompt:

```
<user_message>
{query}
</user_message>
```

This gives the model a structural signal that user input is contained, complementing the text-based rules.

---

### LOW

#### L-01: Bot AI Cooldown Bypass Across Worker Isolates

**File:** `src/utils/rateLimit.ts:13`
**Category:** Rate Limiting

The bot's per-user AI cooldown uses a module-level `Map<string, number>` that only survives within a single Worker isolate. Cloudflare Workers can spawn multiple isolates under load, each with its own Map. A user sending concurrent requests could hit different isolates, bypassing the 5-second cooldown.

**Evidence:**

```typescript
// rateLimit.ts:13 — in-memory Map, not distributed
const lastRequestByUser = new Map<string, number>();

// rateLimit.ts:5-8 — code comment acknowledges this limitation
```

**Impact:** Low. This is a cost optimization, not a security boundary. Under extreme load, a user could make more AI queries than intended, increasing OpenCode API costs. For a coffee shop bot with a small user base, this is negligible. The public API's KV-based rate limiter (100 req/60s) is correctly distributed and not affected.

**Remediation (if scale demands):** Move the cooldown to KV storage, similar to the public API rate limiter pattern in `src/api/public.ts`.

---

### INFORMATIONAL (selected highlights)

| ID       | Area      | Summary                                                                                   |
| -------- | --------- | ----------------------------------------------------------------------------------------- |
| AUTH-002 | Auth      | 24-hour `auth_date` window (deliberate trade-off for long-lived Mini App sessions)        |
| AUTH-003 | Auth      | No schema validation on `user` field from initData (malformed data → 403, not bypass)     |
| AUTH-005 | Auth      | Session data has no schema validation on read (D1-only access, grammY handles gracefully) |
| AUTH-009 | Auth      | Health endpoint exposes DB status without auth (standard practice, not sensitive)         |
| INJ-01   | Injection | `formatProduct()` inserts DB fields into HTML without escaping (admin-only data)          |
| INJ-02   | Injection | `formatBranch()` inserts DB fields into HTML without escaping (admin-only data)           |
| INJ-03   | Injection | `formatFaq()` inserts DB fields into HTML without escaping (admin-only data)              |
| INJ-04   | Injection | Menu config fields (categoryName, specialMessage, buttonLabel) unescaped in HTML          |
| DEP-01   | Deps      | 18 npm audit vulnerabilities — all in devDependencies, zero production impact             |
| DEP-06   | Deps      | In-memory cooldown bypass across isolates (same as L-01)                                  |
| DEP-07   | Deps      | Admin API has no rate limiting (acceptable — auth acts as implicit throttle)              |
| FRONT-03 | Frontend  | No Content-Security-Policy meta tag (React JSX escaping sufficient)                       |
| FRONT-04 | Frontend  | No runtime API response validation (trusted API, error boundary catches crashes)          |
| FRONT-05 | Frontend  | Image URLs rendered without client-side validation (server validates, `<img>` sandboxes)  |
| FRONT-10 | Frontend  | Role-based route guards are client-side only (server enforces)                            |

---

## Scope & Methodology

**In scope:**

- Worker backend (`src/`) — all TypeScript files, API routes, bot handlers, middleware, repositories, services
- Admin mini app (`admin-app/src/`) — auth flow, API client, components, routing
- Menu website (`menu-app/src/`) — public API client, components, routing
- Dependencies (`package.json` across all 3 packages, `npm audit`)
- Configuration (`wrangler.toml`, `.gitignore`, `.env`, CI/CD workflows)
- Git history (secrets exposure check)

**Out of scope:**

- Cloudflare dashboard configuration (binding IDs, DNS, access rules)
- Telegram bot token / webhook secret rotation procedures
- OpenCode API key management beyond verifying it's a Worker secret
- Infrastructure-level DDoS protection (Cloudflare's responsibility)
- Penetration testing (this is a code audit, not an active exploit attempt)

**Methodology:**

1. Five parallel security finders (auth, injection, secrets, dependencies, frontend) each read the codebase independently
2. Each finder performed adversarial self-verification — attempting to refute every finding before reporting
3. Only findings that survived self-verification are reported as confirmed
4. Severity follows OWASP-inspired scale: Critical (immediate exploit/RCE), High (moderate effort, significant impact), Medium (specific conditions, limited impact), Low (defense-in-depth), Informational (best practice)

**Limitations:**

- This is a static code audit — no dynamic testing, fuzzing, or active exploitation was performed
- The AI prompt injection finding (M-01) is inherently difficult to fully verify without testing against the live model
- Cloudflare Workers runtime behavior (isolate scaling, KV consistency) was assessed from documentation, not measured

---

## Files Reviewed

| File                             | What was checked                                          |
| -------------------------------- | --------------------------------------------------------- |
| `src/index.ts`                   | Worker entry point, error handling, request routing       |
| `src/api/auth.ts`                | HMAC validation, timing-safe comparison, auth_date window |
| `src/api/router.ts`              | CORS configuration, role enforcement, route ordering      |
| `src/api/public.ts`              | Unauthenticated endpoints, rate limiting, CORS wildcard   |
| `src/api/resources/*.ts`         | All REST resource handlers, role guards                   |
| `src/services/aiService.ts`      | OpenCode API calls, system prompt, input truncation       |
| `src/services/cache.ts`          | KV caching layer                                          |
| `src/services/data/index.ts`     | DataService, batch queries                                |
| `src/handlers/message.ts`        | AI fallback, HTML sanitization, rate limiting             |
| `src/handlers/callbackQuery.ts`  | Callback handling, escapeHtml usage                       |
| `src/utils/crypto.ts`            | timingSafeEqual implementation                            |
| `src/utils/htmlEscape.ts`        | HTML escaping utility                                     |
| `src/utils/formatters.ts`        | formatProduct, formatBranch, formatFaq                    |
| `src/utils/rateLimit.ts`         | In-memory cooldown mechanism                              |
| `src/database/schema.ts`         | D1 schema (11 tables)                                     |
| `src/database/sessionStorage.ts` | Session read/write                                        |
| `src/repositories/index.ts`      | All repository classes, query patterns                    |
| `src/middlewares/auth.ts`        | getAdminRole, requireSuperAdmin                           |
| `src/menus/*.ts`                 | Menu builders, HTML interpolation                         |
| `admin-app/src/api/client.ts`    | Mini App auth, SDK usage                                  |
| `admin-app/src/App.tsx`          | API base URL, routing, role guards                        |
| `menu-app/src/api/client.ts`     | Public API client                                         |
| `menu-app/src/App.tsx`           | Routing, data handling                                    |
| `wrangler.toml`                  | Bindings, secrets configuration                           |
| `.gitignore`                     | .env exclusion                                            |
| `.env`                           | Local dev overrides (no production secrets)               |
| `package.json` (×3)              | Dependencies, scripts                                     |
| `.github/workflows/deploy.yml`   | CI secrets, deploy configuration                          |
