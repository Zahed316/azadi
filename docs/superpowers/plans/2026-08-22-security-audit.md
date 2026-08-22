# Security Audit — AUDIT_REPORT.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `AUDIT_REPORT.md` — a security audit of the Azadi Coffee Roastery codebase (Worker backend, admin-app, menu-app) with confirmed findings, severity ratings, and remediation guidance.

**Architecture:** Run parallel security finders across the 3 packages, adversarially verify each finding (3 skeptic votes per finding), synthesize into a single Markdown report. No code changes — audit-only.

**Tech Stack:** Claude Code agents, CodeGraph (for call-path tracing), npm audit (for dependency CVEs)

**Spec:** The 2026-08-22 session's scope (auth, webhook, SQL, AI, XSS, secrets, dependencies) — see `.remember/today-2026-08-22.md`

## Global Constraints

- All bot/UI text is Persian (Farsi) with HTML parse mode
- Cloudflare Workers runtime (no Node.js APIs — `crypto.subtle` only)
- D1 (SQLite) via Drizzle ORM — no raw SQL with string interpolation
- Auth: `Authorization: Telegram <initData>` — HMAC-SHA256 signature validation
- Public API (`/api/public/*`) is unauthenticated — CORS wildcard
- `wrangler deploy` validates all bindings — do not add test bindings
- Findings must be **verified** (not suspected) to appear in the report — 3 independent skeptic votes required

---

## File Structure

**Create:**

- `AUDIT_REPORT.md` (repo root) — the final deliverable

**Read-only inputs (do not modify):**

- `src/api/auth.ts` — HMAC validation, timing-safe compare
- `src/api/router.ts` — CORS, role enforcement, route ordering
- `src/api/public.ts` — unauthenticated endpoints, rate limiting
- `src/services/aiService.ts` — OpenCode API calls, system prompt
- `src/services/data/index.ts` — data access layer
- `src/handlers/message.ts` — AI fallback, HTML sanitization
- `src/handlers/callbackQuery.ts` — callback handling, `escapeHtml`
- `src/utils/htmlEscape.ts` — HTML escaping utility
- `src/utils/rateLimit.ts` — bot-side rate limiting
- `src/utils/numbers.ts` — `toPersianDigits`, `formatPersianPrice`
- `src/database/schema.ts` — D1 schema (11 tables)
- `src/repositories/*.ts` — all repository classes
- `src/index.ts` — Worker entry point, error handling
- `admin-app/src/api/client.ts` — Mini App auth flow
- `admin-app/src/App.tsx` — API base URL
- `menu-app/src/api/client.ts` — public API client
- `wrangler.toml` — bindings, secrets
- `package.json` (root, admin-app/, menu-app/) — dependencies

---

### Task 1: Recon — Map the Attack Surface

**Files:**

- Read: all files listed above
- Create: none (working memory only)

**Interfaces:**

- Consumes: codebase
- Produces: mental map of entry points, trust boundaries, data flows

- [ ] **Step 1: Identify all entry points**

Worker `fetch` routes in `src/index.ts`:

- `/webhook` — Telegram bot (authenticated via `X-Telegram-Bot-Api-Secret-Token`)
- `/api/*` — Admin REST API (authenticated via `Authorization: Telegram <initData>`)
- `/api/public/*` — Public menu API (unauthenticated, CORS wildcard)
- Everything else → 404

- [ ] **Step 2: Identify trust boundaries**

| Boundary         | Trust level | Auth mechanism                                        |
| ---------------- | ----------- | ----------------------------------------------------- |
| Telegram webhook | High        | `X-Telegram-Bot-Api-Secret-Token` header              |
| Admin API        | Medium      | HMAC-validated `initData` + `admins` table lookup     |
| Public API       | None        | Rate limit only (100 req/60s per IP via KV)           |
| AI fallback      | Low         | User-controlled text → OpenCode API                   |
| Bot messages     | Medium      | User text → `escapeHtml()` → Telegram HTML parse mode |

- [ ] **Step 3: Identify data flows**

1. User message → `message:text` handler → AI fallback → OpenCode API → sanitized HTML reply
2. Admin app → `Authorization: Telegram <initData>` → `validateInitData()` → role check → D1 query
3. Menu app → `/api/public/*` → D1 query → JSON response (envelope-wrapped)
4. Bot callback → `callbackQuery` handler → D1 query → `escapeHtml()` → Telegram reply

- [ ] **Step 4: Read all security-sensitive files**

Read each file listed in the File Structure section. Note any red flags for later verification.

---

### Task 2: Auth & Authorization Audit

**Files:**

- Read: `src/api/auth.ts`, `src/api/router.ts`, `src/middlewares/auth.ts`, `admin-app/src/api/client.ts`

**Interfaces:**

- Consumes: Task 1 recon
- Produces: auth findings (verified or rejected)

- [ ] **Step 1: Verify HMAC validation**

In `src/api/auth.ts`, check:

- Is `timingSafeEqual` used for hash comparison? (yes — line 63)
- Is `auth_date` checked against `MAX_AGE_SECONDS`? What is the value?
- Is `hash` removed from params before signing?
- Are all required Telegram fields present in the check string?

- [ ] **Step 2: Verify role enforcement**

In `src/api/router.ts` and `src/middlewares/auth.ts`, check:

- Does `category_admin` enforcement actually block writes to other categories?
- Is `allowedThreadId` checked on every admin API call?
- Can a `category_admin` escalate to `super_admin` by manipulating the request?

- [ ] **Step 3: Verify session storage**

In `src/database/sessionStorage.ts`, check:

- Is session data validated on read?
- Can a malformed session payload cause injection?

- [ ] **Step 4: Run adversarial verification (3 skeptics per finding)**

For each finding from Steps 1-3:

```
Agent: "Try to REFUTE this finding: {description}. Check if the code actually has this vulnerability. Default to refuted=true if uncertain."
```

A finding survives only if ≥2 of 3 skeptics cannot refute it.

---

### Task 3: Injection Audit (SQL, XSS, Prompt Injection)

**Files:**

- Read: `src/repositories/*.ts`, `src/utils/htmlEscape.ts`, `src/handlers/message.ts`, `src/handlers/callbackQuery.ts`, `src/services/aiService.ts`, `src/utils/formatters.ts`

**Interfaces:**

- Consumes: Task 1 recon
- Produces: injection findings (verified or rejected)

- [ ] **Step 1: Check SQL injection vectors**

Grep all repositories for raw SQL. Drizzle ORM uses parameterized queries by default, but check:

- Any `sql\`` tagged template literals?
- Any string interpolation in query builders?
- Any `eq()` / `and()` / `or()` with user-controlled values?

- [ ] **Step 2: Check XSS in bot messages**

In `src/handlers/callbackQuery.ts` and `src/handlers/message.ts`:

- Is `escapeHtml()` applied to ALL user-derived or DB-derived strings before HTML parse mode?
- Check `formatProduct()`, `formatBranch()`, `formatFaq()` — do they escape before passing to `reply()` / `replyWithPhoto()`?
- Check `flow.name` / `flow.content` in callback handlers — the Aug 21 fix escaped these, verify it holds.

- [ ] **Step 3: Check XSS in admin-app and menu-app**

Grep `admin-app/src/` and `menu-app/src/` for:

- `dangerouslySetInnerHTML` (already confirmed: none)
- `eval()`, `Function()`, `setTimeout(string)` (already confirmed: none)
- Unescaped `{...}` in JSX that could render raw HTML
- `href` with user-controlled URLs (javascript: protocol)

- [ ] **Step 4: Check prompt injection in AI fallback**

In `src/services/aiService.ts` and `src/handlers/message.ts`:

- Does the system prompt resist prompt extraction? (has "SECURITY RULES" section)
- Is user input sanitized before sending to OpenCode API?
- Can a user message override the system prompt?
- Is the AI response sanitized before sending to Telegram? (check `sanitizeTelegramHtml`)

- [ ] **Step 5: Run adversarial verification (3 skeptics per finding)**

Same pattern as Task 2, Step 4.

---

### Task 4: Secrets & Configuration Audit

**Files:**

- Read: `.gitignore`, `wrangler.toml`, `.env`, `src/index.ts`, `src/api/router.ts`

**Interfaces:**

- Consumes: Task 1 recon
- Produces: secrets/config findings (verified or rejected)

- [ ] **Step 1: Verify .env handling**

- Is `.env` in `.gitignore`? (confirmed: yes)
- Has `.env` ever been committed? (`git log --all -- .env` — confirmed: no)
- Are secrets stored as Cloudflare Worker secrets (`wrangler secret put`)?
- Check `wrangler.toml` for any hardcoded tokens

- [ ] **Step 2: Check error response leakage**

In `src/index.ts`, check the catch block:

- Does the 500 response include `err.stack` or internal paths?
- Are error messages sanitized before returning to clients?

- [ ] **Step 3: Check CORS configuration**

In `src/api/router.ts` and `src/api/public.ts`:

- Admin API: is CORS restricted to known origins? (yes — `ALLOWED_ORIGINS` list)
- Public API: is CORS wildcard (`*`) acceptable for public menu data?
- Are preflight (`OPTIONS`) responses properly handled?

- [ ] **Step 4: Check secrets in git history**

```bash
git log --all --diff-filter=D -- "*.env" "*.key" "*.pem" "*.secret"
git log --all -p --grep="password\|token\|secret\|key" -- "*.ts" "*.js" "*.toml" | head -100
```

- [ ] **Step 5: Run adversarial verification (3 skeptics per finding)**

---

### Task 5: Dependency & Infrastructure Audit

**Files:**

- Read: `package.json` (all 3), `package-lock.json` (all 3), `wrangler.toml`

**Interfaces:**

- Consumes: Task 1 recon
- Produces: dependency/infra findings (verified or rejected)

- [ ] **Step 1: Run npm audit on all packages**

```bash
cd /home/zahedrastgar/Documents/_Projects/azadi && npm audit --json 2>/dev/null | head -100
cd admin-app && npm audit --json 2>/dev/null | head -100
cd ../menu-app && npm audit --json 2>/dev/null | head -100
```

Record: total vulnerabilities, critical/high/medium/low breakdown.

- [ ] **Step 2: Check Cloudflare binding configuration**

In `wrangler.toml`:

- Are D1 database IDs hardcoded? (yes — verify they match production)
- Are there unused R2/KV bindings that could cause deploy failures?
- Is `wrangler deploy --dry-run` needed after changes? (per CLAUDE.md: yes)

- [ ] **Step 3: Check rate limiting completeness**

- Public API: 100 req/60s per IP via KV (`src/api/public.ts`)
- Bot: `checkAndSetCooldown` in `src/utils/rateLimit.ts`
- Admin API: any rate limiting? If not, is that acceptable for trusted admins?
- AI fallback: any rate limiting beyond the bot cooldown?

- [ ] **Step 4: Run adversarial verification (3 skeptics per finding)**

---

### Task 6: Frontend Security Audit

**Files:**

- Read: `admin-app/src/api/client.ts`, `menu-app/src/api/client.ts`, `admin-app/src/App.tsx`, `menu-app/src/App.tsx`

**Interfaces:**

- Consumes: Task 1 recon
- Produces: frontend findings (verified or rejected)

- [ ] **Step 1: Check Mini App auth flow**

In `admin-app/src/api/client.ts`:

- Is `retrieveRawInitData()` used (not `retrieveLaunchParams().initDataRaw`)?
- Is the raw init data sent as `Authorization: Telegram <initData>`?
- What happens if the SDK is unavailable? (graceful degradation vs crash?)

- [ ] **Step 2: Check API base URL handling**

- Admin app: hardcoded `https://azadi-coffee-bot.zahedrastgar316.workers.dev/api`?
- Menu app: hardcoded `https://azadi-coffee-bot.zahedrastgar316.workers.dev/api/public`?
- Dev mode: does `VITE_API_BASE` env var work? Error message if missing?

- [ ] **Step 3: Check for client-side data exposure**

- Are any secrets logged to console in dev mode?
- Is `localStorage` used for sensitive data?
- Are API responses validated before rendering?

- [ ] **Step 4: Run adversarial verification (3 skeptics per finding)**

---

### Task 7: Synthesize Findings & Adversarial Verification

**Files:**

- Read: outputs from Tasks 2-6
- Create: working notes (temporary)

**Interfaces:**

- Consumes: all verified findings from Tasks 2-6
- Produces: deduplicated, severity-rated finding list

- [ ] **Step 1: Aggregate all verified findings**

Collect findings from Tasks 2-6. Deduplicate by file+line. Keep only findings that survived adversarial verification (≥2 of 3 skeptics could not refute).

- [ ] **Step 2: Assign severity ratings**

| Severity      | Definition                                              |
| ------------- | ------------------------------------------------------- |
| Critical      | Immediate exploitation possible, data breach or RCE     |
| High          | Exploitable with moderate effort, significant impact    |
| Medium        | Requires specific conditions, limited impact            |
| Low           | Defense-in-depth improvement, minimal real-world impact |
| Informational | Best practice recommendation, no current vulnerability  |

- [ ] **Step 3: Cross-validate top findings**

For each Critical/High finding, run one additional adversarial check:

```
Agent: "Given the full codebase context, is this finding actually exploitable in production? Consider: Cloudflare Workers runtime, D1 parameterized queries, Telegram bot constraints."
```

---

### Task 8: Write AUDIT_REPORT.md

**Files:**

- Create: `AUDIT_REPORT.md` (repo root)

**Interfaces:**

- Consumes: Task 7 synthesized findings
- Produces: final audit report

- [ ] **Step 1: Write report header**

```markdown
# Security Audit Report — Azadi Coffee Roastery

**Date:** 2026-08-22
**Scope:** Worker backend (`src/`), admin mini app (`admin-app/`), menu website (`menu-app/`)
**Auditor:** Claude Code (automated security audit)
**Methodology:** Parallel security finders + adversarial verification (3 skeptics per finding)
**Findings:** [N] total — [C] Critical, [H] High, [M] Medium, [L] Low, [I] Informational
```

- [ ] **Step 2: Write Executive Summary**

2-3 paragraph overview: what was audited, overall security posture, top risks.

- [ ] **Step 3: Write Finding Details**

For each finding:

```markdown
### [SEVERITY] FINDING-NN: Title

**File:** `path/to/file.ts:line`
**Category:** Authentication | Injection | Secrets | Dependencies | Configuration
**Status:** Confirmed (N/3 skeptics refuted)

**Description:**
What the vulnerability is and why it matters.

**Evidence:**
Code snippet or trace showing the issue.

**Impact:**
What an attacker could achieve.

**Remediation:**
Specific fix with code example.
```

- [ ] **Step 4: Write Scope & Methodology**

Describe what was in scope, what was out of scope, tools used, limitations.

- [ ] **Step 5: Write Appendix — Files Reviewed**

List every file reviewed with a one-line summary of what was checked.

- [ ] **Step 6: Format and verify**

```bash
npx prettier --write AUDIT_REPORT.md
```

- [ ] **Step 7: Commit**

```bash
git add AUDIT_REPORT.md
git commit -m "docs: add security audit report (2026-08-22)"
```
