# Davia vs docs/ — Comparison Report

**Date**: 2026-08-21
**Davia version**: 0.1.14 (model: `openai:mimo-v2.5` via opencode.ai)
**Existing docs**: 10 Markdown files, ~2,000 lines total

---

## Summary

| Aspect            | Davia (`davia docs`)                 | `docs/` (hand-written)                                           |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------- |
| **Files**         | 6 HTML pages + 6 Excalidraw diagrams | 10 Markdown files                                                |
| **Total lines**   | ~241 lines of HTML                   | ~2,000 lines of Markdown                                         |
| **Depth**         | Mid-level overview per topic         | Deep reference per topic                                         |
| **Diagrams**      | 6 Excalidraw interactive diagrams    | Mermaid diagrams inline in Markdown                              |
| **Code examples** | 1 (local dev commands)               | 50+ (API payloads, auth flows, middleware, SQL, config)          |
| **Schema detail** | Table names + one-line description   | Full column-level schema for all 11 tables                       |
| **API detail**    | Auth flow + envelope pattern         | Every endpoint, method, request/response shape, role enforcement |
| **Bot detail**    | Middleware chain + command list      | Menu hierarchy, 15 callback patterns, message flow state machine |
| **Pitfalls**      | 4 deployment pitfalls                | 15+ pitfalls with WHY / WHAT GOES WRONG / PREVENTION             |
| **Conventions**   | Not covered                          | Full file (Persian text, error handling, test patterns, naming)  |
| **Cross-linking** | Internal `<a href>` between 5 pages  | Cross-linked via `[file.md](file.md)` at section tops            |
| **Format**        | HTML (requires Davia web viewer)     | Markdown (GitHub-renderable, CLI-readable)                       |

---

## File-by-File Coverage Matrix

| `docs/` file        | Davia covers it? | Davia file(s)                               | What's missing in Davia                                                                      |
| ------------------- | ---------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **README.md**       | ✅ Partial       | Root page                                   | Mermaid architecture diagram (Davia has Excalidraw), no table of contents                    |
| **architecture.md** | ✅ Partial       | `architecture.html`                         | No sequence diagrams, no middleware injection detail, no error handling flow                 |
| **database.md**     | ⚠️ Minimal       | `architecture.html` (list only)             | No column types, constraints, or relationships — just table names                            |
| **api.md**          | ⚠️ Minimal       | `backend-flows.html`                        | No endpoint-by-endpoint reference, no request/response shapes, no role enforcement           |
| **bot.md**          | ⚠️ Partial       | `backend-flows.html`, `frontend-flows.html` | No menu hierarchy, no callback patterns, no message handler detail                           |
| **admin-app.md**    | ✅ Partial       | `frontend-flows.html`                       | No page-by-page reference, no component inventory, no SDK migration detail                   |
| **menu-app.md**     | ✅ Partial       | `frontend-flows.html`                       | No route table, no component names, no API client signature                                  |
| **deployment.md**   | ✅ Good          | `deployment.html`                           | Missing env vars table, missing `wrangler.toml` binding reference, missing `deploy.sh` flags |
| **conventions.md**  | ❌ None          | —                                           | Not covered at all                                                                           |
| **pitfalls.md**     | ⚠️ Partial       | `deployment.html`                           | Only 4 deployment pitfalls; no code-level pitfalls (sessions, SDK, auth, bot behavior)       |

---

## What Davia Does Better

1. **Interactive diagrams** — 6 Excalidraw diagrams are visually richer than Mermaid text diagrams. The architecture overview, request flows, and deployment pipeline are genuinely easier to follow as visual assets.

2. **Cross-page navigation** — HTML pages with `<a href>` links provide a browsable documentation experience. The `docs/` files rely on markdown links that only work on GitHub.

3. **Concise overview density** — Each Davia page packs a topic into 35–50 lines with clear sections. A new developer can scan the root page in 2 minutes and understand the three deployable units.

4. **Auth protocol detail** — The 5-step HMAC auth description in `key-processes.html` is technically precise and well-explained (sign botToken with "WebAppData", constant-time comparison, 24-hour window).

5. **KV caching patterns** — The key format (`cache:<namespace>:<qualifier>`), TTL (300s), and `deleteByPrefix()` invalidation pattern are described clearly.

6. **Tool calling architecture** — The read/write classification of AI tools, `pendingActions` confirmation flow, and `POST /api/ai/execute` pattern are explained in a way that `docs/` doesn't cover as a cohesive narrative.

---

## What `docs/` Does Better

1. **Depth** — `docs/database.md` has full column-level schema for all 11 tables with types, constraints, and descriptions. Davia just lists table names. `docs/api.md` documents every endpoint with method, path, auth, request body, response shape, and role enforcement.

2. **Bot reference** — `docs/bot.md` includes the full menu hierarchy tree, 15 callback query patterns, message handler state machine, and rate limiting rules. Davia mentions the middleware chain but not the handler behavior.

3. **Conventions** — `docs/conventions.md` covers Persian text handling (LRI/PDI isolates, `toPersianDigits()`), error handling patterns, test conventions (`vi.mock()` class wrapping, `CacheService.prototype` spying), and naming rules. Davia has zero coverage here.

4. **Pitfalls with actionability** — `docs/pitfalls.md` has 15+ pitfalls each with "What / Why it matters / What goes wrong / Prevention / Verification". Davia's deployment page mentions 4 pitfalls without the prevention steps.

5. **SDK migration notes** — `docs/admin-app.md` documents the `@telegram-apps/sdk` → `@tma.js/sdk` migration, the `retrieveRawInitData()` requirement, and the `mount()` before method call rule. Davia mentions the SDK but not the migration or pitfalls.

6. **Code examples** — `docs/` has 50+ code blocks covering auth headers, API payloads, middleware signatures, SQL patterns, config formats, and test setups. Davia has 1 code block.

7. **Mermaid diagrams** — `docs/` embeds Mermaid sequence diagrams, flow charts, and graph diagrams inline. These render natively on GitHub. Davia's Excalidraw diagrams require a separate viewer.

8. **Cross-linking strategy** — Every `docs/` file starts with "See also: [related.md]" links. Davia's pages link to each other but not to source files or `docs/` equivalents.

---

## Gaps in Each

### Davia Gaps (things docs/ covers that Davia doesn't)

- No database column-level reference
- No REST API endpoint reference (method, path, body, response)
- No bot menu hierarchy or callback patterns
- No conventions file (Persian text, error handling, test patterns)
- No SDK migration notes (`@tma.js/sdk` v3 changes)
- No conversation/wizard lifecycle documentation
- No admin app page-by-page component reference
- No menu app page-by-page reference
- No environment variables reference
- No `wrangler.toml` binding reference
- No test file organization or test harness documentation
- No `deploy.sh` flags reference
- Diagram path mismatch (`data-path="data/..."` but files live in `mermaids/`)

### docs/ Gaps (things Davia covers that docs/ doesn't)

- No interactive visual diagrams (Mermaid only, no Excalidraw)
- No browsable HTML experience (GitHub markdown only)
- No cohesive AI tool calling architecture narrative (scattered across files)
- No KV key format pattern documented as a naming convention
- No `buildAIContextBatch()` optimization explained as a pattern

---

## Recommendation

**Keep `docs/`. It is the authoritative reference.** The 10 files are deeper, more complete, more actionable, and GitHub-native. They cover topics Davia doesn't (conventions, column schemas, endpoint references, pitfalls with prevention steps).

**Use Davia's output as a visual companion** — the Excalidraw diagrams are genuinely valuable for onboarding. Consider:

1. **Extract the diagrams** — Convert Davia's 6 Excalidraw JSONs to Mermaid or static SVG and embed them in the relevant `docs/` files. This adds visual value without changing the docs structure.

2. **Adopt the overview structure** — Davia's root page is a cleaner project summary than `docs/README.md`. Consider restructuring `README.md` to match Davia's "three deployable units + tech stack + doc links" layout.

3. **Import the AI architecture narrative** — Davia's `key-processes.html` explains the tool calling flow (`<ai_action>` → parser → read/write classification → executor → confirmation) more cohesively than any single `docs/` file. This narrative could be added to `docs/architecture.md` or `docs/api.md`.

4. **Don't merge** — Davia's HTML format requires its web viewer. It can't be read on GitHub, in terminals, or in code reviews. The Markdown format of `docs/` is more portable and version-control-friendly.

---

## Verdict

|                 | Davia                                         | docs/                                     |
| --------------- | --------------------------------------------- | ----------------------------------------- |
| **Onboarding**  | ✅ Better — visual, scannable, 5-min read     | ⚠️ Dense — requires reading 10 files      |
| **Reference**   | ❌ Insufficient — no endpoint/schema detail   | ✅ Complete — every field documented      |
| **Portability** | ❌ HTML only — requires Davia viewer          | ✅ Markdown — GitHub, terminal, editors   |
| **Maintenance** | ⚠️ Auto-generated — regenerate on code change | ⚠️ Manual — must update when code changes |
| **Accuracy**    | ⚠️ Mostly accurate, some hallucinated details | ✅ Verified against codebase              |

**Bottom line**: Davia produces a good visual overview with diagrams, but it's not a replacement for hand-written reference documentation. Use it as a supplement, not a substitute.
