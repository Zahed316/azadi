# Deep-Dive Security Audit Report

**Date:** 2026-08-08
**Scope:** Security, React Admin-App, CI/CD Pipeline
**Method:** Parallel workflow with 4 security finders, 2 admin-app finders, 1 CI/CD finder, each with adversarial verification

---

## Executive Summary

| Audit Area      | Total Findings | Critical | High  | Medium | Low    |
| --------------- | -------------- | -------- | ----- | ------ | ------ |
| Security        | 12             | 1        | 2     | 4      | 5      |
| React Admin-App | 16             | 0        | 1     | 5      | 10     |
| CI/CD           | 4              | 0        | 0     | 1      | 3      |
| **Total**       | **32**         | **1**    | **3** | **10** | **18** |

### Fixes Applied

| ID          | Severity | Title                                    | Status   |
| ----------- | -------- | ---------------------------------------- | -------- |
| AUTH-001    | CRITICAL | Missing auth_date freshness check        | ✅ Fixed |
| AUTH-002    | HIGH     | Self-deletion allows super_admin lockout | ✅ Fixed |
| INJ-001/002 | HIGH     | Prompt injection vulnerabilities         | ✅ Fixed |

---

## Security Audit Findings

### CRITICAL

#### AUTH-001: Missing auth_date freshness check in Telegram initData validation

- **File:** `src/api/auth.ts:8`
- **Impact:** A stolen or intercepted initData blob can be replayed indefinitely to impersonate any admin
- **Fix:** Added auth_date validation with 5-minute freshness window

### HIGH

#### AUTH-002: Self-deletion allows super_admin to remove own account

- **File:** `src/api/resources/admins.ts:56`
- **Impact:** Sole super_admin can accidentally remove their own account, locking out admin management
- **Fix:** Added guard to prevent self-deletion; added `telegramId` to `ResourceCtx`

#### INJ-001: Unsanitized user input passed directly to LLM

- **File:** `src/services/aiService.ts:112`
- **Impact:** Prompt injection attacks can extract system prompt or manipulate AI responses
- **Fix:** Added input length limit (500 chars)

#### INJ-002: System prompt lacks instruction hierarchy and output guardrails

- **File:** `src/services/aiService.ts:4`
- **Impact:** AI is more susceptible to prompt injection due to soft boundaries
- **Fix:** Added hard SECURITY RULES section to system prompt

### MEDIUM

#### AUTH-004: CORS wildcard on admin API

- **File:** `src/api/router.ts:61`
- **Impact:** Any origin can make credentialed requests to the admin API
- **Recommendation:** Replace `*` with specific Mini App origin

#### INJ-003: AI reply sent with HTML parse_mode without sanitization

- **File:** `src/handlers/message.ts:189`
- **Impact:** LLM could output arbitrary HTML including phishing links
- **Recommendation:** Whitelist allowed HTML tags before sending

#### SEC-005: GET /settings returns all settings without key filtering

- **File:** `src/api/resources/settings.ts:10`
- **Impact:** Sensitive keys stored in settings table would be exposed
- **Recommendation:** Add blocklist for sensitive keys

#### SEC-006: AI conversation logs endpoint exposes full user query history

- **File:** `src/api/resources/ai-logs.ts:17`
- **Impact:** Super_admin can view any user's conversation history
- **Recommendation:** Add retention limits or UI warnings

#### TG-003: Session-dependent idempotency guard has gap on session persistence failure

- **File:** `src/bot.ts:74`
- **Impact:** Duplicate processing on Telegram webhook retry
- **Recommendation:** Replace with D1-backed idempotency store

### LOW

| ID       | Title                                         | File                              |
| -------- | --------------------------------------------- | --------------------------------- |
| AUTH-003 | POST /admins allows arbitrary role strings    | src/api/resources/admins.ts:47    |
| INJ-004  | Database content can carry injection payloads | src/utils/menuContext.ts:60       |
| INJ-005  | ✅ SQL injection safe (positive finding)      | src/repositories/index.ts         |
| SEC-001  | setup_bot leaks raw error.message             | src/commands/admin.ts:30          |
| SEC-002  | OpenCode API error body logged raw            | src/services/aiService.ts:127     |
| SEC-003  | Telegram API error logged verbatim            | src/api/resources/messages.ts:102 |
| SEC-004  | Raw error objects in catch blocks             | src/handlers/message.ts:217       |
| SEC-009  | Health endpoint exposes DB status             | src/api/router.ts:66              |
| SEC-010  | Bot token in fetch URL                        | src/handlers/callbackQuery.ts:411 |

---

## React Admin-App Audit Findings

### HIGH

#### REACT-002: MessagesPage uses raw useEffect instead of React Query

- **File:** `admin-app/src/pages/MessagesPage.tsx:14`
- **Impact:** Missing automatic retries, caching, and consistent error handling
- **Recommendation:** Refactor to use useQuery like all other pages

### MEDIUM

| ID     | Title                                                     | File                                     |
| ------ | --------------------------------------------------------- | ---------------------------------------- |
| UX-007 | Seven pages show empty states before data loads           | Multiple pages                           |
| UX-008 | List item action buttons overflow on narrow screens       | admin-app/src/index.css:155              |
| UX-013 | Settings menu visibility toggles have no loading feedback | admin-app/src/pages/SettingsPage.tsx:170 |
| UX-015 | Bottom nav remains visible when virtual keyboard opens    | admin-app/src/index.css:179              |
| UX-017 | Confirm dialog buttons below 44px touch target            | admin-app/src/index.css:382              |

### LOW

| ID        | Title                                                            | File                                          |
| --------- | ---------------------------------------------------------------- | --------------------------------------------- |
| REACT-001 | No error boundaries                                              | admin-app/src/App.tsx:54                      |
| REACT-003 | Toast timer leaks                                                | admin-app/src/components/Toast.tsx:13         |
| REACT-004 | SettingsPage state-during-render                                 | admin-app/src/pages/SettingsPage.tsx:57       |
| REACT-005 | AboutUsPage state-during-render _(refuted - documented pattern)_ | admin-app/src/pages/AboutUsPage.tsx:24        |
| REACT-006 | ConfirmDialog useEffect missing dependency                       | admin-app/src/components/ConfirmDialog.tsx:33 |
| REACT-007 | AppContext value recreated every render                          | admin-app/src/App.tsx:42                      |
| REACT-008 | NavLink onClick handlers unstable                                | admin-app/src/App.tsx:112                     |
| REACT-009 | ProductsPage 30 useState calls                                   | admin-app/src/pages/ProductsPage.tsx:33       |
| REACT-010 | AITestPage uses array index as key                               | admin-app/src/pages/AITestPage.tsx:58         |
| REACT-011 | StreaksPage confirm undefined risk                               | admin-app/src/pages/StreaksPage.tsx:34        |
| REACT-012 | No Suspense boundaries                                           | admin-app/src/App.tsx:54                      |

---

## CI/CD Pipeline Audit Findings

### MEDIUM

#### CICD-001: Actions pinned to floating tags, not SHA

- **File:** `.github/workflows/deploy.yml:16`
- **Impact:** Supply-chain attack risk from compromised upstream actions
- **Recommendation:** Pin each action to full 40-character commit SHA

### LOW

| ID       | Title                                          | File                            |
| -------- | ---------------------------------------------- | ------------------------------- |
| CICD-005 | cancel-in-progress on main can kill mid-deploy | .github/workflows/deploy.yml:10 |
| CICD-006 | No timeout-minutes on any job or step          | .github/workflows/deploy.yml:12 |
| CICD-007 | PR trigger runs full test suite for fork PRs   | .github/workflows/deploy.yml:6  |

---

## Verification

- ✅ All 149 tests pass
- ✅ Typecheck passes
- ⚠️ ESLint has pre-existing error on workflow script files (non-blocking in CI)

---

## Recommendations for Future Sprints

1. **High Priority:** Add error boundaries to admin-app (REACT-001)
2. **High Priority:** Refactor MessagesPage to use React Query (REACT-002)
3. **Medium Priority:** Restrict CORS to specific origins (AUTH-004)
4. **Medium Priority:** Sanitize AI HTML output (INJ-003)
5. **Medium Priority:** Add loading states to 7 pages (UX-007)
6. **Low Priority:** Pin GitHub Actions to SHA (CICD-001)
7. **Low Priority:** Add timeout-minutes to CI jobs (CICD-006)
