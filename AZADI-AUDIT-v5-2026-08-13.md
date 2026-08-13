# Azadi Repository Audit v5

## Fresh Repository Audit — Current `main`

**Repository:** `Zahed316/azadi`  
**Branch:** `main`  
**Validation date:** 2026-08-13  
**Validated HEAD:** `0e9a9fae502b2b3d57af7093e3eb92ced3698da4`  
**HEAD commit:** `chore: ignore .codegraph/ from root gitignore, remove tracked inner gitignore`  
**Previous audit baseline:** `AZADI-AUDIT-v4-2026-08-13.md`

## Audit standard

This is a fresh audit of the current repository state. Previous audit findings are not treated as evidence.

Every factual finding is classified as one of:

- **CONFIRMED** — directly observable in the current repository.
- **PARTIAL** — the concern exists, but the previous wording or impact was too broad.
- **RESOLVED** — the previous finding is no longer present in the current repository.
- **STALE** — the previous finding described an older repository state.
- **UNVERIFIED** — the repository does not contain enough evidence to establish the claim.

External runtime state is never inferred from source code. In particular, the exact production D1 state, deployed environment variables, provider account configuration, and real user traffic are outside the evidence boundary unless independently exposed by a repository-controlled test or deployment result.

---

# 1. Executive verdict

The repository has changed substantially since the previous audit. Several high-impact findings from v4 have been addressed:

- The old migration sequence was replaced by a two-step baseline + integrity-migration model.
- Database integrity enforcement was added through SQLite triggers.
- The old `ServiceContainer` graph was removed.
- Numeric REST ID validation utilities were added and adopted in resource handlers.
- Telegram `auth_date` freshness validation and explicit hash-length validation were added.
- The old log-based AI cooldown was replaced by an atomic check-and-set cooldown within a Worker isolate.
- CORS was restricted from wildcard access to an allowlist.
- The old deployment script was converted from a deployment script into a Node 22+ preflight script covering all three packages.
- `menu-app` was added to CI deployment.
- Frontend API origins are now configurable through `VITE_API_BASE`.
- Root gitignore coverage was improved.
- The latest GitHub Actions run for the current HEAD completed successfully.

The current repository is therefore materially healthier than the state covered by the original audit.

However, several important issues remain.

### Highest-priority current findings

1. **P0 — Migration baseline contains claims that are not independently reproducible from the repository.** `0000_baseline.sql` states that it captures production D1 and that previous migrations are archived, but no `drizzle/archive/` directory exists in the current tree and production D1 cannot be verified from source alone.
2. **P1 — AI rate limiting is only isolate-local.** The new limiter is better than the previous race-prone log check, but it is not a durable or cross-isolate limit. The state is also an unbounded module-level `Map`.
3. **P1 — Admin creation can silently accept an invalid `categoryId` as `null`.** `parseOptionalInt()` returns `null` for invalid input, and the admin handler treats that as equivalent to an omitted value.
4. **P1 — `category_admin` does not require a category at the API/database boundary.** A valid `category_admin` can therefore be created with `categoryId = null`.
5. **P1 — Menu reorder now reports failures but is still not atomic.** `Promise.allSettled()` is followed by an error check, so silent success was fixed, but partial updates can still remain when one update fails.
6. **P2 — CI lint remains non-blocking.** Worker, admin-app, and menu-app lint steps all use `continue-on-error: true`.
7. **P2 — `deploy.sh` and documentation disagree about `--dry-run`.** The documentation instructs `./deploy.sh --dry-run`, but the script only implements `--skip-tests` and `--help`.
8. **P2 — AI admin test endpoint has no independent rate limit.** It is super-admin protected, but repeated authenticated requests can still invoke the external AI provider.
9. **P2 — Request context is stored in module-level mutable state.** `src/requestContext.ts` itself warns that concurrent overlap must not use the context incorrectly, but the design remains fragile and relies on a non-local invariant.
10. **P2 — React Router remains on `6.30.4`.** Both frontend packages use React Router v6. The security relevance depends on the actual routing mode and must be evaluated against the current advisories rather than treated as an unconditional exploit.
11. **P3 — React 18 remains in both frontend applications.** This is maintenance work, not an immediate security issue.
12. **P3 — Telegram Apps SDK remains on v2 in admin-app.** This should be treated as maintenance/migration work unless a specific installed-package vulnerability is demonstrated.

---

# 2. Current repository and deployment state

## 2.1 HEAD

**Status: CONFIRMED**

Current `main` HEAD is:

`0e9a9fae502b2b3d57af7093e3eb92ced3698da4`

The commit changes `.gitignore` to ignore `.codegraph/` and removes the tracked `.codegraph/.gitignore` file.

**Evidence:** GitHub commit `0e9a9fae502b2b3d57af7093e3eb92ced3698da4`.

## 2.2 Current CI result

**Status: CONFIRMED**

GitHub Actions run `31694064528` for the current HEAD completed with `success`.

The run contains three successful jobs:

- `test-and-deploy`
- `deploy-admin-app`
- `deploy-menu-app`

The Worker job successfully ran unit tests, lint, format check, typecheck, and Worker deployment.

The admin-app job successfully ran typecheck, lint, format check, build, and Pages deployment.

The menu-app job successfully ran typecheck, lint, format check, build, and Pages deployment.

### Important limitation

The CI run proves that these commands completed successfully for this commit. It does not prove production behavior, complete security correctness, or adequate test coverage.

---

# 3. Finding matrix

| ID | Finding | Status | Priority |
|---|---|---|---|
| DB-001 | Migration history was replaced by baseline + integrity migration | RESOLVED from v4 | — |
| DB-002 | Database integrity enforcement absent | RESOLVED/PARTIAL | P1 |
| DB-003 | Baseline claims production validation not independently reproducible | CONFIRMED | P0 |
| DB-004 | Baseline claims archived migrations, but no archive directory exists | CONFIRMED | P1 |
| ARCH-001 | Dead ServiceContainer architecture | RESOLVED | — |
| API-001 | Bare REST numeric parsing | LARGELY RESOLVED | P1 |
| API-002 | Invalid optional integer can become `null` silently | CONFIRMED | P1 |
| AUTH-001 | Telegram `auth_date` optional | RESOLVED | — |
| AUTH-002 | Telegram hash length not checked | RESOLVED | — |
| AUTH-003 | `category_admin` may be created without category | CONFIRMED | P1 |
| DATA-001 | Menu reorder silently ignores failures | RESOLVED | — |
| DATA-002 | Menu reorder is still non-atomic | CONFIRMED | P1 |
| AI-001 | Log-based AI cooldown race | RESOLVED | — |
| AI-002 | AI cooldown is isolate-local | CONFIRMED | P1 |
| AI-003 | AI cooldown map has no eviction | CONFIRMED | P2 |
| AI-004 | Admin AI test has no dedicated rate limit | CONFIRMED | P2 |
| CI-001 | Lint is non-blocking | CONFIRMED | P2 |
| CI-002 | Format checks absent from CI | RESOLVED | — |
| DEP-001 | deploy.sh masks lint failure | RESOLVED | — |
| DEP-002 | deploy.sh omits menu-app | RESOLVED | — |
| DEP-003 | deploy.sh accepts Node 18 | RESOLVED | — |
| DEP-004 | deploy.sh is preflight-only | CONFIRMED | Informational |
| DOC-001 | `--dry-run` documented for deploy.sh but unsupported | CONFIRMED | P2 |
| DOC-002 | AGENTS.md deployment documentation is behind current three-app model | PARTIAL | P3 |
| FE-001 | Hardcoded production API origin | RESOLVED | — |
| SEC-001 | Wildcard CORS | RESOLVED | — |
| SEC-002 | Health endpoint exposes DB availability | CONFIRMED | P3 |
| SEC-003 | Module-level request context | CONFIRMED | P2 |
| SEC-004 | React Router v6 security/maintenance review | CONFIRMED/PARTIAL | P2 |
| SDK-001 | Telegram Apps SDK v2 | CONFIRMED maintenance | P3 |
| TEST-001 | Current CI test execution | CONFIRMED | — |
| TEST-002 | Frontend automated test coverage | UNVERIFIED/limited | P3 |

---

# 4. Database

## DB-001 — Previous migration inconsistency has been replaced

**Status: RESOLVED from v4**

The previous repository had multiple hand-written migration files with duplicate numeric prefixes and a journal that referenced a missing migration.

The current repository now contains only:

```text
drizzle/0000_baseline.sql
drizzle/0001_add_check_constraints.sql
drizzle/meta/_journal.json
```

The journal now contains exactly two entries:

```text
0000_baseline
0001_add_check_constraints
```

This removes the previous duplicate-prefix and missing-journal-entry problem from the active migration directory.

**Evidence:** current `drizzle/` directory and `drizzle/meta/_journal.json`.

---

## DB-002 — Database integrity enforcement has been added

**Status: RESOLVED/PARTIAL**

The previous audit reported missing data-integrity constraints.

The current implementation adds SQLite triggers for:

- non-negative product stock
- non-negative product price
- valid product unit
- valid menu section
- valid admin role
- message rating from 1 through 5

The schema also documents that these invariants are enforced by the migration triggers.

### Important terminology correction

These are **SQLite triggers**, not SQL `CHECK` constraints.

Therefore:

- "integrity constraints are absent" = stale
- "actual CHECK constraints exist" = false
- "equivalent write-time invariants are enforced through triggers" = confirmed

**Evidence:** `drizzle/0001_add_check_constraints.sql`, `src/database/schema.ts`.

---

## DB-003 — Production validation claim is not independently established

**Status: CONFIRMED**

`drizzle/0000_baseline.sql` contains comments stating that it:

- captures the production D1 schema as of 2026-08-13
- was generated by comparing `sqlite_master` with the application schema
- was validated against production with zero violations

The Git repository itself does not contain the production `sqlite_master` output, a production database dump, a CI artifact, or another independently reproducible proof of those statements.

### Required interpretation

The SQL file is usable as repository evidence of the **intended baseline**, but the claim that it exactly represents the live production database remains **UNVERIFIED from the repository alone**.

### Required action

Store or generate a reproducible schema-verification artifact outside the production database itself, for example:

1. dump `sqlite_master` from production
2. normalize it
3. compare it with the baseline
4. record the verification result in CI or a controlled audit artifact

Do not treat the comment alone as proof of production equivalence.

---

## DB-004 — Archived migration claim does not match the current tree

**Status: CONFIRMED**

`0000_baseline.sql` says:

> All prior migrations (0000-0009) are archived in `drizzle/archive/`.

The current `drizzle/` directory contains no `archive/` directory.

The old migration files are therefore not archived in the current working tree. They remain recoverable from Git history, but that is different from being present in `drizzle/archive/`.

### Required action

Either:

- create the stated archive directory and place the historical migrations there, or
- change the baseline comment to accurately describe Git history as the recovery source.

Do not leave the repository documentation claiming a directory that does not exist.

---

# 5. Architecture

## ARCH-001 — Dead ServiceContainer architecture removed

**Status: RESOLVED**

The previous audit identified `ServiceContainer` as an unused service graph initialized from the Worker entry point.

The current tree no longer contains `src/services/container.ts`, `src/services/ai/index.ts`, or `src/services/bot/index.ts`.

`src/index.ts` now directly manages the bot instance and does not instantiate `ServiceContainer`.

The active `src/services/aiService.ts` remains and is directly used by the message handler. It must not be confused with the removed dead `services/ai/` graph.

**Evidence:** current tree, `src/index.ts`, `src/handlers/message.ts`, `src/services/aiService.ts`.

---

# 6. REST API validation

## API-001 — Bare REST numeric parsing has been substantially addressed

**Status: LARGELY RESOLVED**

The current repository introduces:

```text
src/utils/validation.ts
```

with:

- `parseRequiredInt`
- `parseOptionalInt`
- `parseBoundedInt`

Representative resource handlers now use these helpers for route and category IDs.

The previous audit's claim of a repository-wide exact number of `parseInt()` call sites is not repeated because that exact count is not independently established by the available repository search interface.

### Remaining issue

The helper itself uses `parseInt`, so strings such as `"12abc"` can parse as `12`.

If strict integer syntax is required, validation should use a stricter rule such as a full-string decimal-integer match before conversion.

This is a correctness-hardening opportunity rather than proof of an active authorization bypass.

---

## API-002 — Invalid optional integers can silently become `null`

**Status: CONFIRMED**

`parseOptionalInt()` returns `null` when a supplied value is invalid.

The admin creation handler uses this behavior for `categoryId`.

The handler validates a category only when the parsed result is non-null, then later stores the parsed value.

Therefore an invalid supplied `categoryId` can become `null` instead of producing a `400` response.

### Recommended fix

Separate these states:

```text
missing -> null
invalid -> 400
valid -> integer
```

Do not use one return value to represent both "not provided" and "invalid" when the endpoint must distinguish them.

---

# 7. Admin authorization model

## AUTH-003 — `category_admin` can exist without a category

**Status: CONFIRMED**

The admin database model allows nullable `categoryId`.

The API validates the role against:

```text
super_admin
category_admin
```

but does not require `categoryId` when `role === 'category_admin'`.

The integrity migration validates the role enum but does not enforce the relationship:

```text
category_admin -> categoryId NOT NULL
```

### Risk

A category admin without a category is an invalid domain state. The exact downstream behavior depends on every authorization check consuming `allowedCategoryId`.

### Recommended fix

Enforce the domain rule at both layers:

- API: require a valid category for `category_admin`.
- Database: add an invariant that prevents a category admin from having a null category, if compatible with the production schema and SQLite trigger strategy.

---

# 8. Telegram authentication

## AUTH-001 — `auth_date` is now mandatory and fresh

**Status: RESOLVED**

The current `validateInitData()` rejects missing `auth_date` and rejects timestamps outside a five-minute absolute age window.

Tests explicitly cover:

- valid current timestamp
- missing timestamp
- old timestamp
- future timestamp
- malformed timestamp

**Evidence:** `src/api/auth.ts`, `src/tests/auth.test.ts`.

---

## AUTH-002 — Hash length check is now explicit

**Status: RESOLVED**

The current validator checks that the supplied hash length equals the generated SHA-256 hexadecimal signature length before character-by-character comparison.

Tests cover both truncated and extended hashes.

**Evidence:** `src/api/auth.ts`, `src/tests/auth.test.ts`.

---

# 9. Menu configuration

## DATA-001 — Silent reorder failures have been fixed

**Status: RESOLVED**

The repository still uses `Promise.allSettled()`, but it now counts rejected operations and throws an error when one or more updates fail.

The HTTP resource catches the failure and returns a 500 response.

Therefore the previous claim that failed updates are silently ignored is no longer correct.

---

## DATA-002 — Reorder remains non-atomic

**Status: CONFIRMED**

`MenuConfigRepository.reorder()` executes multiple independent updates and only checks the final settlement results afterward.

If some updates succeed and another update fails:

1. successful updates remain committed
2. the method throws
3. the client receives an error
4. the menu may nevertheless be partially reordered

### Required action

Use an appropriate D1 transaction/batch strategy if atomic reorder semantics are required.

At minimum, add a regression test that simulates a failure after one successful update and verifies the intended failure semantics.

---

# 10. AI security and cost controls

## AI-001 — Previous log-based cooldown race has been removed

**Status: RESOLVED**

The message handler now calls `checkAndSetCooldown()` before the external AI request.

The old mechanism depended on a D1 log written with `waitUntil()`, which allowed concurrent requests to observe stale state.

The current code no longer uses that log as the cooldown decision.

**Evidence:** `src/handlers/message.ts`, `src/utils/rateLimit.ts`.

---

## AI-002 — Rate limiter is isolate-local

**Status: CONFIRMED**

The new limiter stores timestamps in:

```ts
const lastRequestByUser = new Map<string, number>();
```

This state is local to a Worker isolate.

The implementation itself acknowledges that cross-isolate bypass is possible.

### Risk

The limiter is stronger than the previous D1-log race, but it is not a durable global per-user rate limit.

A user whose requests are handled by different isolates can potentially bypass the five-second limit.

### Recommended target

For strict cost control, use a durable/atomic rate-limit mechanism backed by D1 or another Cloudflare state primitive appropriate to the traffic model.

Keep the in-memory limiter as a fast local guard if useful, but do not treat it as the sole provider-cost boundary.

---

## AI-003 — Rate limiter state has no eviction

**Status: CONFIRMED**

The module-level map retains a user ID and timestamp whenever a user passes the limiter.

There is no TTL cleanup or size bound.

A long-lived isolate receiving requests from many unique users can accumulate entries indefinitely until the isolate is recycled.

### Recommended action

Add bounded cleanup or use a state structure with expiration semantics.

---

## AI-004 — Admin AI test endpoint has no dedicated rate limit

**Status: CONFIRMED**

`POST /api/ai-test` requires `super_admin`, but it directly invokes `runAiQuery()` and the external OpenCode API.

The endpoint has no endpoint-specific cooldown, quota, or request budget.

The AI service truncates the actual prompt to 500 characters, but that does not limit request frequency.

### Severity

This is lower risk than an unauthenticated AI endpoint because authentication requires a valid Telegram admin identity and super-admin role.

### Recommended action

Add a modest per-admin cooldown and/or daily request budget if provider cost is material.

---

# 11. AI output handling

## AI-005 — Input terminology is now technically correct

**Status: RESOLVED**

The AI service now explicitly describes its 500-character operation as truncation rather than sanitization.

The source comments distinguish prompt-injection resistance from input length limiting.

---

# 12. API security

## SEC-001 — Wildcard CORS has been removed

**Status: RESOLVED**

The current router uses an explicit origin allowlist containing:

```text
https://azadi-admin.pages.dev
https://azadi-menu.pages.dev
https://web.telegram.org
```

Unknown origins fall back to the first allowlisted origin rather than receiving `*`.

This is materially safer than the previous wildcard configuration.

### Remaining consideration

The allowlist should be reviewed whenever deployment domains change.

---

## SEC-002 — Public health endpoint exposes database availability

**Status: CONFIRMED**

`GET /api/health` is intentionally unauthenticated and returns:

- `status`
- `db` boolean
- timestamp

It does not return credentials, schema contents, or stack traces.

### Severity

Low.

This is reasonable operational telemetry, but it reveals whether the database binding is currently reachable.

If minimizing public infrastructure information is a goal, expose a simpler liveness response publicly and keep dependency health authenticated/internal.

---

## SEC-003 — Module-level request context remains fragile

**Status: CONFIRMED**

`src/requestContext.ts` stores `env` and `ExecutionContext` in module-level variables.

The source comments explicitly acknowledge that correctness depends on how these values are consumed during asynchronous request processing.

The current design therefore creates a non-local concurrency invariant: correctness depends on every consumer using the stored context only inside the intended request flow.

### Recommended action

Prefer passing `env` and `ExecutionContext` explicitly through the call graph.

If the global context is retained, add a focused concurrency regression test that proves two overlapping webhook requests cannot observe each other's context.

Do not classify this as a confirmed cross-user data leak without such reproduction.

---

# 13. Frontend architecture

## FE-001 — Configurable API origins are implemented

**Status: RESOLVED**

Both frontend API clients now use:

```text
VITE_API_BASE
```

with a production fallback.

The repository also contains `.env.example` files documenting the variable.

This removes the previous hard dependency on the production Worker URL for development configuration.

---

## FE-002 — React Router remains on 6.30.4

**Status: CONFIRMED/PARTIAL**

Both `admin-app` and `menu-app` declare:

```text
react-router-dom ^6.30.4
```

The security significance depends on the actual routing mode and affected API surface.

Both applications use the v6 routing stack, and the previous audit identified Declarative/HashRouter usage as an important mitigating factor.

### Required action

Do not treat this as an automatic emergency upgrade.

Instead:

1. map actual router usage
2. compare against the currently applicable advisories
3. determine whether affected APIs such as server rendering/data routing are used
4. upgrade to a supported patched major when compatibility allows

---

## FE-003 — React 18 remains

**Status: CONFIRMED / MAINTENANCE**

Both frontend packages use React 18.2.x.

This is not automatically a security vulnerability.

Upgrade should be handled as a compatibility and maintenance project rather than mixed into P0/P1 security work.

---

## SDK-001 — Telegram Apps SDK v2 remains

**Status: CONFIRMED / MAINTENANCE**

`admin-app` uses `@telegram-apps/sdk ^2.0.0`.

No repository evidence in this audit establishes that this dependency itself is an active exploitable vulnerability.

Treat migration as maintenance unless a specific affected package/advisory is identified.

---

# 14. CI/CD

## CI-001 — Lint remains non-blocking

**Status: CONFIRMED**

The current workflow still contains:

```yaml
continue-on-error: true
```

for Worker, admin-app, and menu-app lint steps.

Therefore a lint failure does not block deployment.

### Recommended action

Once the lint baseline is clean, remove `continue-on-error` from all three lint steps.

---

## CI-002 — Format checks are now enforced

**Status: RESOLVED**

The current workflow runs `format:check` for:

- Worker
- admin-app
- menu-app

The latest HEAD's GitHub Actions run reports all three format checks as successful.

---

## CI-003 — Typecheck/build/test coverage of deployment units is materially improved

**Status: CONFIRMED**

The current CI workflow has separate jobs for all three deployable units.

The latest successful run confirms execution of:

- Worker tests
- Worker typecheck
- Worker format check
- Worker lint
- admin-app typecheck
- admin-app format check
- admin-app lint
- admin-app build
- menu-app typecheck
- menu-app format check
- menu-app lint
- menu-app build

This is a significant improvement over the older deployment pipeline.

---

# 15. Deployment tooling

## DEP-001 — deploy.sh no longer masks lint failure

**Status: RESOLVED**

The current script uses `set -euo pipefail` and runs lint without `|| true`.

---

## DEP-002 — deploy.sh now validates all three packages

**Status: RESOLVED**

The current script explicitly validates:

- Worker
- admin-app
- menu-app

It runs tests, typechecks, lint, format checks, and frontend builds.

---

## DEP-003 — Node version is standardized to 22+

**Status: RESOLVED**

`deploy.sh` rejects Node versions below 22.

`.node-version` contains `22`.

CI also uses Node 22.

This is now consistent across the primary local preflight and CI configuration.

---

## DEP-004 — deploy.sh is preflight-only

**Status: CONFIRMED**

Despite its filename, the current script explicitly states that it does not deploy. CI is the deployment path.

This is a design choice, not a defect.

However, naming it `preflight.sh` would better communicate its actual role if the project wants to eliminate ambiguity.

---

# 16. Documentation consistency

## DOC-001 — deploy.sh `--dry-run` documentation is incorrect

**Status: CONFIRMED**

`AGENTS.md` and `CLAUDE.md` document:

```text
./deploy.sh --dry-run
```

The current script accepts:

```text
--skip-tests
--help / -h
```

There is no `--dry-run` case in the current script.

### Required action

Replace the documented command with:

```text
./deploy.sh
```

or

```text
./deploy.sh --skip-tests
```

If a dry-run mode is desired, implement it explicitly.

---

## DOC-002 — AGENTS.md is behind the current deployment architecture

**Status: PARTIAL**

`AGENTS.md` now correctly identifies OpenCode API and the admin Mini App, but its CI/deployment description still focuses on the older admin-only deployment model.

`CLAUDE.md` documents all three deployable units and is closer to the current architecture.

### Required action

Make `AGENTS.md` and `CLAUDE.md` describe the same current system:

- Worker
- admin-app
- menu-app
- CI deployment of all three
- current `deploy.sh` semantics
- current migration baseline model

---

# 17. Repository hygiene

## HYG-001 — Root ignore rules are substantially improved

**Status: RESOLVED from previous audit**

The current `.gitignore` includes:

```text
dist/
*.log
.wrangler/
.claude/
.codegraph/
.superpowers/
wrangler-dry/
```

The newest commit specifically adds `.codegraph/` and removes the tracked inner `.codegraph/.gitignore`.

The previous missing-ignore findings for these paths should not be repeated.

---

## HYG-002 — Old stale scripts were removed

**Status: RESOLVED from previous audit**

The previous stale webhook/latency scripts were removed in the latest cleanup series.

They should not be reported as current repository files.

---

# 18. Testing assessment

## TEST-001 — Current CI test execution is confirmed

**Status: CONFIRMED**

The latest GitHub Actions run successfully executed `npm test` for the Worker package.

The repository contains dedicated tests for authentication, rate limiting, menu configuration, routing, product behavior, formatting, AI greeting behavior, coffee details, pagination, and related areas.

### Important limitation

A successful test suite is not proof of complete coverage.

---

## TEST-002 — Frontend automated test coverage is not established

**Status: UNVERIFIED/LIMITED**

The current frontend package scripts contain typecheck, lint, format check, build, dev, and preview commands, but no frontend test script or frontend test framework is declared in either frontend `package.json`.

This does not prove that no tests exist elsewhere, but it establishes that frontend tests are not part of the package-level standard validation command.

### Recommended action

Add tests for the highest-risk frontend behavior:

- Telegram init-data/auth integration
- API client failure handling
- admin authorization UX
- menu rendering from API data
- critical CRUD forms

---

# 19. Recommended priority order

## P0 — Evidence and production integrity

1. Establish a reproducible production D1 schema verification artifact.
2. Correct the misleading `drizzle/0000_baseline.sql` archive/production-validation comments.
3. Verify the baseline against actual production before future migration changes.

## P1 — Correctness and abuse resistance

4. Reject invalid optional integers instead of converting them to `null` when a value was supplied.
5. Require `categoryId` for `category_admin`.
6. Make menu reorder atomic if partial reorder state is unacceptable.
7. Replace or supplement the isolate-local AI limiter with a durable cross-isolate rate-limit/budget mechanism.

## P2 — CI/deployment reliability

8. Remove `continue-on-error` from lint steps.
9. Fix the `deploy.sh --dry-run` documentation mismatch.
10. Add a dedicated AI-test endpoint rate limit.
11. Add a concurrency regression test for request-context handling.

## P3 — Maintenance

12. Synchronize `AGENTS.md` and `CLAUDE.md`.
13. Add frontend automated tests.
14. Plan React Router major upgrade after routing compatibility review.
15. Plan React 19 migration.
16. Plan Telegram Apps SDK migration.
17. Consider renaming `deploy.sh` to `preflight.sh` if no deployment behavior will ever be added.

---

# 20. Definition of done for the next audit

The project should be considered materially hardened when:

- [ ] Production D1 schema has a reproducible comparison against `0000_baseline.sql`.
- [ ] Baseline comments accurately describe what is actually stored in Git.
- [ ] Invalid supplied integer values return 400 instead of silently becoming null.
- [ ] `category_admin` always has a valid category.
- [ ] Menu reorder has explicit atomic semantics.
- [ ] AI rate limiting has a durable cross-isolate cost boundary.
- [ ] AI rate-limit state is bounded/evicted.
- [ ] Admin AI testing has a request budget.
- [ ] Lint is a blocking CI gate.
- [ ] `deploy.sh` documentation matches its real CLI.
- [ ] Request context concurrency has either been removed or formally tested.
- [ ] Frontend critical paths have automated tests.
- [ ] React Router migration decision is documented.

---

# 21. Final assessment

The current repository is **substantially improved compared with the state covered by the original audit**.

The previous audit should not be applied mechanically. A significant portion of its findings are now stale because the project has undergone a focused cleanup and security-hardening pass.

The most important remaining issue is no longer the old migration-file chaos itself. The active concern is **whether the new production baseline can be independently proven to match the real D1 database**.

The second major concern is **rate-limit durability**: the new AI limiter correctly removes the old race, but it should not be mistaken for a globally enforced Cloudflare rate limit.

The current GitHub Actions result is healthy, but deployment success should be interpreted as evidence of build/test pipeline success, not as proof that all runtime invariants are correct.

**Overall assessment:** `GOOD / HARDENING REQUIRED`

The repository is no longer in the state represented by the earlier 66-finding hygiene/security audit. Future audits should start from `0e9a9fae502b2b3d57af7093e3eb92ced3698da4` and classify old findings as resolved/stale instead of carrying them forward.
