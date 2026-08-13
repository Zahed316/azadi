# Azadi Repository Audit v4

## Claim-by-Claim, Repository-Grounded Validation

**Repository:** `Zahed316/azadi`  
**Branch:** `main`  
**Validation date:** 2026-08-13  
**Validated commit:** `406bd172d843ebdc13f970365998b727a9275b5d`  
**Audit standard:** Every factual claim in this document must be traceable to the current repository state or explicitly marked as unverified.

---

## 1. Executive verdict

This audit intentionally does **not** treat the previous audit as evidence.

The current repository was inspected directly. Findings are classified as:

- **CONFIRMED** — directly observable in current repository code/configuration.
- **PARTIAL** — the underlying concern exists, but the previous wording, scope, severity, or impact was inaccurate.
- **STALE** — previously reported, but changed by the current repository.
- **UNVERIFIED** — the repository evidence available for this audit is insufficient to make the claim.
- **NOT A FINDING** — evidence contradicts the previous claim.

### Current high-confidence findings

1. **CONFIRMED — D1 migration history is inconsistent.**
2. **CONFIRMED — ServiceContainer is initialized from the Worker entry point while the active request path uses separate construction.**
3. **CONFIRMED — database CHECK constraints are absent and explicitly marked TODO.**
4. **CONFIRMED — externally supplied numeric values are not consistently validated before use.**
5. **CONFIRMED — `auth_date` is optional during Telegram Mini App init-data validation.**
6. **CONFIRMED — Telegram hash comparison lacks an explicit length equality check.**
7. **CONFIRMED — menu reordering ignores individual update failures.**
8. **CONFIRMED — AI cooldown depends on persisted logs that are written after the response path and can therefore be bypassed by concurrent requests.**
9. **CONFIRMED — AI input is length-limited, but calling this "sanitization" is technically imprecise.**
10. **CONFIRMED — CI lint is explicitly non-blocking for Worker, admin-app, and menu-app.**
11. **CONFIRMED — CI does not run the package `format:check` scripts.**
12. **CONFIRMED — `deploy.sh` masks lint failure and does not deploy `menu-app`.**
13. **CONFIRMED — `deploy.sh` accepts Node.js 18+, while CI is standardized on Node.js 22.**
14. **CONFIRMED — admin-app and menu-app hardcode the production Worker API origin.**
15. **CONFIRMED — project documentation in `AGENTS.md` contains architecture/provider information that does not match the current implementation.**
16. **CONFIRMED — React Router 6.30.4 is used by both frontend applications.**
17. **PARTIAL — the React Router security finding is valid, but exploitability and remediation must be described according to the actual Declarative/HashRouter usage.**
18. **STALE — previous formatting/lint baseline claims must not be reused as current failures because the latest commit explicitly reports formatting/lint fixes and `npm run check`.**
19. **UNVERIFIED — exact repository-wide counts such as "28 parseInt call sites" are not retained unless independently reproduced.**
20. **UNVERIFIED — production D1 state cannot be inferred solely from the Git repository.**

---

# 2. Repository baseline

## 2.1 Repository state

The repository is private, active, and uses `main` as its default branch.

Validated commit:

`406bd172d843ebdc13f970365998b727a9275b5d`

The commit message states that it introduced menu-app performance optimizations, lint fixes, formatting, and that `npm run check` passed for the changed menu-app work.

**Evidence:** Git commit `406bd172d843ebdc13f970365998b727a9275b5d`.

### Important interpretation

A commit message is evidence that the author reported a check passing; it is **not equivalent to an independently reproduced CI result**. This audit therefore does not convert that statement into "CI independently verified all checks."

---

# 3. Finding matrix

| ID       | Finding                                                                  | Status                                        | Severity        |
| -------- | ------------------------------------------------------------------------ | --------------------------------------------- | --------------- |
| DB-001   | Migration journal inconsistent with SQL files                            | CONFIRMED                                     | P0 / High       |
| ARCH-001 | ServiceContainer initialized but not part of active request construction | CONFIRMED                                     | P2 / Medium     |
| DB-002   | Missing database CHECK constraints                                       | CONFIRMED                                     | P1 / Medium     |
| API-001  | Numeric input validation incomplete                                      | CONFIRMED                                     | P1 / Medium     |
| AUTH-001 | `auth_date` optional                                                     | CONFIRMED                                     | P1 / Medium     |
| AUTH-002 | Telegram hash length not explicitly checked                              | CONFIRMED                                     | P2 / Low-Medium |
| DATA-001 | Menu reorder can partially fail silently                                 | CONFIRMED                                     | P1 / Medium     |
| AI-001   | AI cooldown is not an atomic rate limiter                                | CONFIRMED                                     | P1 / Medium     |
| AI-002   | "Sanitization" terminology is inaccurate                                 | CONFIRMED                                     | P2 / Low        |
| CI-001   | Lint is non-blocking                                                     | CONFIRMED                                     | P2 / Medium     |
| CI-002   | Format checks absent from CI                                             | CONFIRMED                                     | P2 / Medium     |
| DEP-001  | deploy.sh masks lint failures                                            | CONFIRMED                                     | P2 / Medium     |
| DEP-002  | deploy.sh omits menu-app                                                 | CONFIRMED                                     | P2 / Medium     |
| DEP-003  | deploy.sh permits obsolete Node 18                                       | CONFIRMED                                     | P2 / Medium     |
| FE-001   | Production API origin hardcoded                                          | CONFIRMED                                     | P2 / Medium     |
| DOC-001  | AGENTS.md contains stale architecture/provider information               | CONFIRMED                                     | P3 / Low-Medium |
| DEP-004  | Local deploy tooling differs from CI deployment model                    | CONFIRMED                                     | P2 / Medium     |
| DEP-005  | Admin and menu apps are separate Pages deployments                       | CONFIRMED                                     | Informational   |
| SEC-001  | React Router dependency requires major-version/security review           | PARTIAL                                       | P2              |
| SEC-002  | Current routing model reduces applicability of some Router advisories    | PARTIAL                                       | Context         |
| TEST-001 | Repository-wide test coverage adequacy                                   | UNVERIFIED                                    | —               |
| DB-003   | Production schema exactly matches repository migrations                  | UNVERIFIED                                    | P0              |
| PERF-001 | Streak feature flag query on every update                                | CONFIRMED only if flag-enabled path is active | P3              |
| SDK-001  | Telegram Apps SDK migration                                              | MAINTENANCE                                   | P3              |

---

# 4. P0 — Database migration integrity

## DB-001 — Migration history is inconsistent

**Status: CONFIRMED**

The current `drizzle/` directory contains these SQL migration files:

```text
0000_whole_colleen_wing.sql
0001_lumpy_zuras.sql
0001_menu_update.sql
0002_sessions_table.sql
0003_menu_config.sql
0004_user_state.sql
0005_favorites.sql
0006_add_nutritional_and_brew_guide.sql
0007_messages.sql
0008_indexes.sql
0009_add_missing_indexes.sql
```

There are therefore **11 SQL migration files**, with duplicate numeric prefixes `0001`.

The current `drizzle/meta/_journal.json` contains only four journal entries:

```text
0000_whole_colleen_wing
0001_lumpy_zuras
0002_salty_jocasta
0007_messages
```

`0002_salty_jocasta` is referenced by the journal, but there is no SQL migration with that name in the current `drizzle/` directory.

At the same time, several SQL migrations present in the repository are absent from the journal.

### Why this matters

The repository's migration metadata and migration files do not describe one coherent ordered history.

This is an operational integrity problem because a clean environment reconstructed from the repository may not follow the same migration history assumed by the existing environment.

### What is NOT established

This audit does **not** claim that the production D1 database is currently broken.

The Git repository cannot establish the exact remote D1 schema or migration application state.

### Required action

Before changing the journal:

1. Obtain the actual production D1 schema.
2. Obtain the actual migration metadata/state used by the production database.
3. Compare production schema with `src/database/schema.ts`.
4. Compare production schema with every SQL migration.
5. Reconstruct the intended historical sequence.
6. Decide whether to repair history or establish a documented baseline.
7. Verify that a fresh database can be recreated deterministically.

**Do not blindly rename or delete migration files.**

---

# 5. Architecture

## ARCH-001 — ServiceContainer is initialized but the active Worker path does not use it

**Status: CONFIRMED**

`src/index.ts` imports `ServiceContainer` and caches one instance:

```ts
let serviceContainer: ServiceContainer | null = null;

if (!serviceContainer) {
  serviceContainer = new ServiceContainer(env);
}
```

`ServiceContainer` eagerly constructs:

- `DataService`
- `AIService`

and can lazily construct `BotService`.

The same `src/index.ts` independently maintains:

```ts
let botInstance: ReturnType<typeof createBot> | null = null;
```

and the webhook path directly executes:

```ts
botInstance = createBot(env);
```

### Correct interpretation

The problem is not "the container is recreated on every request."

The code explicitly caches it across requests in the same Worker isolate.

The actual issue is:

> The Worker initializes a separate service graph even though the active request path directly uses repositories/services and separately manages the bot instance.

### Risk

- unnecessary initialization work
- duplicated architectural patterns
- confusing dependency ownership
- increased maintenance cost
- potential divergence between modular and active implementations

### Required action

Before deleting anything, perform an import-graph search for:

```text
ServiceContainer
DataService
AIService
BotService
services/ai
services/data
services/bot
```

Remove only components proven to be unreachable from the deployed application and tests.

**Do not delete `src/services/aiService.ts` merely because `ServiceContainer` is dead.** `src/handlers/message.ts` directly imports and uses that class.

---

# 6. Database integrity

## DB-002 — Critical CHECK constraints are missing

**Status: CONFIRMED**

`src/database/schema.ts` contains an explicit TODO requesting constraints including:

```text
stock >= 0
price >= 0
rating BETWEEN 1 AND 5
unit IN (...)
```

The current schema does not implement those constraints.

### Risk

Application-level validation alone does not provide the same invariant guarantee as database constraints.

### Recommended target

Where compatible with existing production data:

- `stock >= 0`
- `price >= 0` when price is present
- `rating BETWEEN 1 AND 5` when rating is present
- constrained `unit`
- additional domain invariants discovered during schema review

These should be enforced at both:

1. HTTP/application boundary
2. database boundary

Migration work must precede production rollout.

---

# 7. API input validation

## API-001 — Numeric input validation is incomplete

**Status: CONFIRMED**

`src/api/resources/products.ts` contains multiple direct `parseInt()` calls on externally supplied values.

Examples include:

```ts
const catId = parseInt(body.categoryId);
```

```ts
const id = parseInt(path.split('/')[1]);
```

```ts
parseInt(body.categoryId);
```

The code does not consistently verify that the result is:

- a finite number
- an integer
- within an expected domain/range

### Important correction

This audit does **not** claim:

> "NaN is definitely stored in D1."

That requires runtime reproduction against the actual D1 binding and relevant Drizzle behavior.

The confirmed issue is:

> Externally supplied numeric values are not consistently validated before authorization and persistence operations.

### Recommended fix

Create shared parsers:

```ts
parseRequiredInt(...)
parseOptionalInt(...)
parseBoundedInt(...)
```

Each should explicitly reject invalid input.

Apply them to:

- route IDs
- category IDs
- stock
- price where numeric representation is used
- ratings
- pagination parameters
- any other externally controlled numeric field

---

# 8. Telegram Mini App authentication

## AUTH-001 — `auth_date` is optional

**Status: CONFIRMED**

`src/api/auth.ts` verifies the HMAC and then performs freshness validation only when:

```ts
const authDateStr = urlParams.get('auth_date');

if (authDateStr) {
  ...
}
```

Therefore an otherwise valid signed init-data payload without `auth_date` is not rejected solely because the field is absent.

### Risk

The system does not enforce freshness for payloads missing the timestamp.

### Recommended fix

Require:

1. `auth_date` exists
2. it parses as a valid integer
3. it is inside the allowed freshness window
4. malformed values are rejected

The exact accepted window should be an explicit project security decision.

---

## AUTH-002 — Hash length is not explicitly checked

**Status: CONFIRMED**

The implementation compares the generated 64-character SHA-256 HMAC representation against `hash` by iterating over the generated signature length.

The code comment says lengths "always match," but the code does not explicitly enforce:

```ts
hash.length === signatureHex.length;
```

### Correct severity

This is a validation-hardening issue, not evidence of a working authentication bypass.

### Recommended fix

Before character comparison:

```ts
if (hash.length !== signatureHex.length) return null;
```

Then perform the constant-time comparison.

---

# 9. Menu configuration correctness

## DATA-001 — Reordering can silently partially fail

**Status: CONFIRMED**

`MenuConfigRepository.reorder()` performs independent updates through:

```ts
Promise.allSettled(...)
```

and does not inspect the returned settlement results.

Therefore one or more updates can fail while the method resolves normally.

### Impact

A caller can observe apparent success while the menu ordering is only partially applied.

### Recommended fix

Use a transactional/batched strategy supported by the actual D1/Drizzle environment.

At minimum:

- inspect every operation result
- fail the request if any update fails
- return an explicit failure response
- add a regression test for partial failure

---

# 10. AI system

## AI-001 — Five-second cooldown is not an atomic rate limiter

**Status: CONFIRMED**

The message handler retrieves recent AI logs before invoking `AiService`:

```ts
aiLogRepo.getRecentLogs(userId, 5);
```

`AiService.processQuery()` checks the timestamp of the newest retrieved log and rejects if it is less than five seconds old.

However, after the AI response is sent, the new log is written through:

```ts
ctx.execCtx.waitUntil(...)
```

Therefore two concurrent requests can both read the same old state before either request's new log is persisted.

### Result

The 5-second mechanism is a **best-effort cooldown**, not an atomic distributed rate limiter.

### Recommended target

Separate:

- audit logging
- rate-limit state

Use an atomic mechanism appropriate to Cloudflare/D1.

Also consider:

- per-user burst limit
- hourly budget
- daily budget
- global provider budget
- failure/backoff handling

---

## AI-002 — Input "sanitization" terminology is inaccurate

**Status: CONFIRMED**

`AiService` truncates the query:

```ts
const MAX_QUERY_LENGTH = 500;
const sanitizedQuery = query.slice(0, MAX_QUERY_LENGTH);
```

This is **length limiting**, not sanitization.

The system also contains prompt-injection resistance instructions, but those are model instructions rather than a hard security boundary.

### Recommended terminology

Use:

- `truncateInput`
- `limitInputLength`
- `promptInjectionResistance`

Avoid calling truncation "sanitization."

---

## AI-003 — HTML output filtering exists

**Status: CONFIRMED**

`message.ts` removes tags not present in an allowlist before sending AI output as Telegram HTML.

This is a real output filtering control.

### Remaining limitation

Tag filtering is not equivalent to complete HTML security validation.

The project should test:

- malformed tags
- attributes
- dangerous links
- nested markup
- parser edge cases

The current code should not be described as a complete security sanitizer without those tests.

---

# 11. CI

## CI-001 — Lint is explicitly non-blocking

**Status: CONFIRMED**

`.github/workflows/deploy.yml` sets:

```yaml
continue-on-error: true
```

for:

- Worker lint
- admin-app lint
- menu-app lint

The workflow comments explicitly describe lint as a future hard gate.

### Risk

Deployment can proceed even if lint fails.

### Recommended sequence

1. Establish zero known lint errors/warnings.
2. Remove `continue-on-error`.
3. Make lint a required gate.

---

## CI-002 — Format checks are absent from CI

**Status: CONFIRMED**

The root, admin-app, and menu-app packages expose `format:check` scripts, but the deployment workflow does not invoke those scripts.

### Recommended action

Add:

```text
npm run format:check
```

to each relevant CI job.

---

## CI-003 — Current formatting baseline must not reuse old audit numbers

**Status: STALE**

The latest commit explicitly reports:

- lint fixes
- Prettier formatting across 31 files
- `npm run check`

Therefore previous audit numbers such as "76 formatting errors" must not be presented as current repository failures unless independently reproduced against the current commit.

---

# 12. Deployment tooling

## DEP-001 — deploy.sh masks lint failure

**Status: CONFIRMED**

The script runs:

```bash
npm run lint 2>&1 | tail -3 || true
```

and then reports:

```text
Lint completed (warnings are non-blocking)
```

Therefore the script can continue after a non-zero lint exit.

### Recommended action

Make lint a real gate.

Do not use a pipeline structure that hides its exit status.

---

## DEP-002 — deploy.sh does not deploy menu-app

**Status: CONFIRMED**

The current script deploys:

- Worker
- admin-app

It does not deploy:

- menu-app

The GitHub Actions workflow, however, contains a dedicated `deploy-menu-app` job.

### Impact

Local "full deploy" and CI "full deploy" do not represent the same deployment topology.

---

## DEP-003 — Node.js requirement is outdated

**Status: CONFIRMED**

`deploy.sh` requires Node.js 18+.

The current GitHub Actions workflow uses Node.js 22.

Node.js 18 is no longer a supported runtime line.

### Recommended action

Standardize the project around the Node version used by CI and document it through:

- `engines`
- `.nvmrc` or `.node-version`
- CI

The exact minimum should be chosen after testing all packages.

---

## DEP-004 — deploy.sh and CI have different roles but the script describes itself as production deploy

**Status: CONFIRMED**

`deploy.sh` describes itself as:

```text
Single-command production deploy
```

while the repository's `AGENTS.md` describes CI as the automatic deployment path and local `deploy.sh` as pre-flight tooling.

The script also omits menu-app.

### Recommended action

Choose one explicit contract:

**Option A:** `deploy.sh` is a complete manual deployment tool.

**Option B:** `deploy.sh` is strictly a local validation/preflight tool.

If Option B is intended, rename/reword it accordingly.

---

# 13. Frontend architecture

## FE-001 — Production API origin is hardcoded

**Status: CONFIRMED**

Both frontend API clients contain the production Worker URL directly.

The current code does not use an environment variable such as:

```text
VITE_API_BASE
```

### Risk

Local development and staging can accidentally target production.

### Recommended action

Use environment-specific configuration:

```text
VITE_API_BASE
```

with an explicit development default if desired.

For production builds, consider validating the expected origin.

---

## FE-002 — Both applications use HashRouter

**Status: CONFIRMED**

`admin-app/src/App.tsx` uses `HashRouter`.

`menu-app/src/App.tsx` also uses `HashRouter`.

This matters when evaluating React Router security advisories because routing mode changes exploitability.

---

# 14. React Router security

## SEC-001 — Router dependency requires security review

**Status: PARTIAL**

Both frontend packages currently depend on:

```text
react-router-dom ^6.30.4
```

The applications use Declarative routing with `HashRouter`.

Current Router security advisories affecting the 6.x line should therefore be evaluated against:

- actual installed version
- actual routing mode
- absence/presence of SSR
- absence/presence of attacker-controlled redirects/navigation
- whether a major upgrade is operationally acceptable

### Correct remediation principle

Do not state:

> "Upgrade to the latest 6.x and the CVE is fixed."

The relevant security fixes are in the newer major line.

The appropriate action is to:

1. verify the exact advisory applicability,
2. test upgrade compatibility,
3. upgrade to a patched supported version,
4. regression-test both Mini Apps.

---

## SEC-002 — Some Router advisory applicability is reduced by current architecture

**Status: PARTIAL**

The current apps use `HashRouter` and declarative route definitions.

Therefore advisory applicability cannot be inferred solely from the package version.

### Correct conclusion

The dependency deserves remediation/review, but the repository evidence does **not** establish an immediately exploitable vulnerability in the deployed applications.

---

# 15. Documentation

## DOC-001 — AGENTS.md is partially stale

**Status: CONFIRMED**

`AGENTS.md` currently describes the AI provider as Cloudflare Workers AI.

The current implementation uses OpenCode API:

```text
https://opencode.ai/zen/go/v1/chat/completions
```

with model:

```text
mimo-v2.5
```

The documentation also describes deployment architecture that must be kept synchronized with the current three deployment units:

- Worker
- admin-app
- menu-app

### Recommended action

Make `CLAUDE.md`/project documentation the canonical source and update companion documents from that source.

Do not allow provider, deployment, or architecture descriptions to diverge.

---

# 16. Streak system

## PERF-001 — Streak database access can occur on every eligible bot update

**Status: CONDITIONAL / CONFIRMED IN CODE PATH**

The project documentation states that streak handling is gated by:

```text
STREAK_MESSAGES === 'true'
```

When enabled, the middleware records visits through `UserStateRepository.upsertVisit()`.

Therefore the database access concern exists **when the feature flag is enabled**.

### Important correction

It is not accurate to describe this as unconditional current production load without verifying the deployed environment's `STREAK_MESSAGES` value.

### Recommended action

If enabled in production:

- cache the feature flag
- consider whether every eligible update needs a DB write
- preserve correctness of daily streak semantics
- measure D1 write volume before optimizing

---

# 17. Telegram Apps SDK

## SDK-001 — SDK migration is maintenance, not automatically a security finding

**Status: MAINTENANCE**

Both frontend applications currently use:

```text
@telegram-apps/sdk ^2.0.0
```

This should be reviewed against the current Telegram Apps SDK ecosystem.

However:

> "The SDK is deprecated"

should not be used as an audit finding unless the exact installed package/version is proven deprecated.

Treat this as:

- dependency maintenance
- compatibility review
- future migration work

not as a confirmed security vulnerability.

---

# 18. Claims deliberately excluded

The following claims are **not included as confirmed findings** because they require evidence not currently established by the repository inspection:

### Production database state

The repository does not prove:

- which migrations are applied remotely
- the exact production schema
- whether production contains data violating proposed constraints
- whether production is currently unrecoverable

### Exact repository-wide counts

Claims such as:

```text
28 parseInt call sites
76 formatting errors
X unused imports
Y dead files
```

must not appear unless generated from a reproducible current-tree search.

### Runtime performance measurements

The repository alone does not prove:

- exact Worker cold-start overhead
- exact D1 latency
- exact AI latency
- actual cache hit ratio
- production request volume
- actual rate-limit bypass frequency

These require runtime telemetry or controlled reproduction.

### Exploitability claims

A code smell or insecure pattern is not automatically a working exploit.

Every security finding should distinguish:

```text
pattern exists
        ↓
security impact plausible
        ↓
exploit preconditions present
        ↓
exploit reproduced
```

This audit only labels the first two levels unless repository evidence establishes more.

---

# 19. Revised priority plan

## P0 — Do before relying on migrations

### 1. Reconstruct D1 migration truth

Deliverables:

- production schema snapshot
- migration application state
- intended migration sequence
- corrected repository history or explicit baseline
- clean-database reconstruction test

**Do not modify migration history blindly.**

---

## P1 — Correctness and security

### 2. Implement shared numeric validation

Cover:

- route IDs
- category IDs
- stock
- rating
- pagination
- all numeric request fields

### 3. Add database invariants

At minimum evaluate:

- stock
- price
- rating
- unit

### 4. Harden Telegram init-data validation

Require:

- `auth_date`
- valid timestamp
- freshness window
- explicit hash length equality

### 5. Replace AI cooldown with atomic rate limiting

Separate:

- rate-limit state
- AI audit log

Add bounded usage budgets.

### 6. Make menu reorder failure-safe

Use D1-supported transactional/batch semantics or explicit failure handling.

---

# 20. P2 — CI and deployment

### 7. Make lint blocking

Remove all three:

```yaml
continue-on-error: true
```

for lint jobs after the current baseline is clean.

### 8. Add format checks

Run `format:check` in all relevant packages.

### 9. Repair deploy.sh

Decide whether it is:

- complete production deployer, or
- local preflight tool

Then make its behavior match its name/documentation.

### 10. Add menu-app deployment if deploy.sh remains a full deployer

### 11. Standardize Node.js

Align local tooling with CI's supported Node.js line.

---

# 21. P3 — Architecture and maintenance

### 12. Remove proven-dead service graph

Only after import-graph verification.

### 13. Configure API origin

Introduce environment-based frontend API configuration.

### 14. Synchronize documentation

Make current architecture/provider/deployment information consistent.

### 15. Review React Router upgrade

Upgrade after testing both applications.

### 16. Review Telegram Apps SDK

Treat as maintenance.

---

# 22. Definition of done

The project should not be called "audit clean" until the following are demonstrably true:

- [ ] Production D1 schema is known.
- [ ] Repository migration history is coherent.
- [ ] Clean database can be reconstructed from the repository.
- [ ] Numeric HTTP inputs are explicitly validated.
- [ ] Critical DB invariants are enforced.
- [ ] `auth_date` is mandatory and freshness-checked.
- [ ] Telegram hash length is explicitly checked.
- [ ] Menu reorder cannot silently partially succeed.
- [ ] AI cooldown/rate limiting is atomic.
- [ ] AI usage has bounded cost controls.
- [ ] Worker lint is blocking.
- [ ] admin-app lint is blocking.
- [ ] menu-app lint is blocking.
- [ ] Worker format check runs in CI.
- [ ] admin-app format check runs in CI.
- [ ] menu-app format check runs in CI.
- [ ] deploy.sh does not hide failures.
- [ ] deploy.sh's deployment scope matches its documented contract.
- [ ] Node version is standardized.
- [ ] Frontend API origins are configurable.
- [ ] Dead service architecture is removed only after import-graph verification.
- [ ] Current documentation matches implementation.
- [ ] Router upgrade/security review is completed.
- [ ] Critical-path tests cover the repaired behavior.

---

# 23. Final assessment

### Overall status

**Needs improvement — with one release-blocking infrastructure concern.**

The most important issue is the migration history inconsistency.

The most important application-level correctness issues are:

1. incomplete numeric validation,
2. non-atomic menu reordering,
3. non-atomic AI cooldown,
4. optional Telegram `auth_date`.

The most important engineering-process issues are:

1. non-blocking CI lint,
2. missing CI format gates,
3. deployment-script drift,
4. stale documentation.

The ServiceContainer issue is real but should be treated as an architectural cleanup rather than a critical runtime vulnerability.

The React Router issue requires dependency/security review, but the current `HashRouter`/Declarative architecture materially changes the threat model and should prevent exaggerated severity claims.

---

# 24. Evidence index

Primary repository evidence used for this audit:

- `src/index.ts` — Worker request entry point and ServiceContainer initialization
- `src/services/container.ts` — modular service graph
- `src/repositories/index.ts` — repository/database operations
- `src/api/resources/products.ts` — numeric request handling
- `src/api/auth.ts` — Telegram Mini App authentication
- `src/handlers/message.ts` — AI request flow and logging
- `src/services/aiService.ts` — AI cooldown, truncation, provider call
- `src/database/schema.ts` — database invariants and indexes
- `drizzle/*.sql` — migration files
- `drizzle/meta/_journal.json` — migration journal
- `.github/workflows/deploy.yml` — CI/deployment gates
- `deploy.sh` — local deployment tooling
- `admin-app/src/App.tsx` — Admin routing
- `menu-app/src/App.tsx` — Menu routing
- `admin-app/package.json` — frontend dependencies/check scripts
- `menu-app/package.json` — frontend dependencies/check scripts
- `admin-app/src/api/client.ts` — Admin API origin
- `menu-app/src/api/client.ts` — Menu API origin
- `AGENTS.md` — project documentation

---

## Audit integrity rule

**No statement in this audit should be converted into an implementation task solely because it appears here.**

For each implementation item, the engineer should first reproduce the referenced repository condition against the current branch and then implement the smallest verified correction.

This rule exists specifically to prevent the audit itself from becoming a source of unverified assumptions.
