# Mini App Gap Closure — Surfacing All Bot Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 13 identified gaps between bot features and the admin Mini App — AI logs visibility, streak configuration, AI testing, feature flags, health checks, and operational tooling.

**Architecture:** Each gap becomes a self-contained task: add the missing API endpoint(s) to `src/api/router.ts`, wire the `AiLogRepository`/`SettingsRepository`/`UserStateRepository` methods, add a React page in `admin-app/src/pages/`, register the route and nav tab in `App.tsx`, and add query keys. Tests added where the existing test harness supports the new endpoint.

**Tech Stack:** Cloudflare Workers (TypeScript), Drizzle ORM (D1), grammY, React + Vite + TanStack Query (`@tanstack/react-query`), `@telegram-apps/sdk`

## Global Constraints

- All bot text is **Persian (Farsi)** with HTML parse mode; admin Mini App UI is **English** (product data shows in original language via `dir="auto"`)
- REST API responses use `corsHeaders` (`Access-Control-Allow-Origin: *`)
- Auth: `Authorization: Telegram <initData>` → `validateInitData` → `getAdminRole`
- Super admin only: `/api/ai-logs`, `/api/feature-flags`, `/api/streaks/reset`, `/api/health`
- `SettingsRepository` uses key-value `settings` table; env flags (`STREAK_MESSAGES`, etc.) currently live in Worker secrets — this plan moves toggles to DB settings with env as fallback
- No new npm dependencies — use existing React Query + fetch patterns
- Tests: `npm test` (vitest), `npm run typecheck` (tsc), `npm run lint` (non-blocking)
- Deploy: `npm run deploy` (Worker), `cd admin-app && npm run build` + `wrangler pages deploy` (Mini App)

---

## Task 1: AI Logs API Endpoint

**Files:**

- Modify: `src/repositories/index.ts` — add `getAllLogs()` and `getLogsByUser()` to `AiLogRepository`
- Modify: `src/api/router.ts` — add `GET /api/ai-logs` route

**Interfaces:**

- Produces: `GET /api/ai-logs?userId=&limit=` → `{ logs: Array<{ id, userId, question, response, timestamp }> }`
- Auth: super_admin only

- [ ] **Step 1: Add `getAllLogs()` and `getLogsByUser()` to AiLogRepository**

```typescript
// In src/repositories/index.ts, inside AiLogRepository class (after getRecentLogs):
async getAllLogs(limit: number = 50, offset: number = 0) {
  return await this.db
    .select()
    .from(aiConversationLogs)
    .orderBy(desc(aiConversationLogs.timestamp))
    .limit(limit)
    .offset(offset);
}

async getLogsByUser(userId: string, limit: number = 50) {
  return await this.db
    .select()
    .from(aiConversationLogs)
    .where(eq(aiConversationLogs.userId, userId))
    .orderBy(desc(aiConversationLogs.timestamp))
    .limit(limit);
}
```

- [ ] **Step 2: Add `GET /api/ai-logs` route to router**

In `src/api/router.ts`, after the favorites admin read block (~line 636), add:

```typescript
// --- AI Conversation Logs (super_admin only) ---
if (path === 'ai-logs' && method === 'GET') {
  if (!isSuperAdmin)
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: corsHeaders,
    });
  const repo = new AiLogRepository(db);
  const userId = url.searchParams.get('userId');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const logs = userId ? await repo.getLogsByUser(userId, limit) : await repo.getAllLogs(limit);
  return new Response(JSON.stringify({ logs }), { headers: corsHeaders });
}
```

Also add `AiLogRepository` to the import at the top of `router.ts`.

- [ ] **Step 3: Run typecheck and tests**

```bash
cd /data/data/com.termux/files/home/repo/azadi && npm run typecheck && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/repositories/index.ts src/api/router.ts
git commit -m "feat(api): add GET /api/ai-logs endpoint for admin AI log visibility"
```

---

## Task 2: AI Logs Mini App Page

**Files:**

- Modify: `admin-app/src/api/keys.ts` — add `aiLogs` query key
- Create: `admin-app/src/pages/AILogsPage.tsx`
- Modify: `admin-app/src/App.tsx` — add route + nav tab

**Interfaces:**

- Consumes: `GET /api/ai-logs` → `{ logs: [...] }`
- Produces: `/ai-logs` route, "🤖 AI Logs" nav tab (super_admin only)

- [ ] **Step 1: Add query key**

In `admin-app/src/api/keys.ts`:

```typescript
aiLogs: ['aiLogs'] as const,
```

- [ ] **Step 2: Create AILogsPage.tsx**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/Spinner';
import Field from '../components/Field';

type AiLog = {
  id: number;
  userId: string;
  question: string;
  response: string;
  timestamp: number | string;
};

function formatTime(t: number | string): string {
  const d = typeof t === 'number' ? new Date(t) : new Date(t);
  return d.toLocaleString();
}

export default function AILogsPage() {
  const { setError } = useAppContext();
  const [userFilter, setUserFilter] = useState('');

  const {
    data: logs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [...queryKeys.aiLogs, userFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (userFilter) params.set('userId', userFilter);
      params.set('limit', '100');
      return apiFetch<{ logs: AiLog[] }>(`/ai-logs?${params}`).then((r) => r.logs);
    },
  });

  if (isLoading) return <LoadingScreen />;
  if (error) setError((error as Error).message);

  return (
    <>
      <div className="card">
        <h2>AI Conversation Logs</h2>
        <Field label="Filter by User ID">
          <input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Telegram user ID (optional)"
          />
        </Field>
      </div>
      <div className="card">
        {logs.length === 0 ? (
          <EmptyState message="No AI logs yet." />
        ) : (
          <ul className="list">
            {logs.map((log) => (
              <li
                key={log.id}
                className="list-item"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
              >
                <div className="list-item-info" style={{ width: '100%' }}>
                  <span style={{ fontWeight: 600 }}>👤 {log.userId}</span>
                  <span className="list-item-meta">{formatTime(log.timestamp)}</span>
                </div>
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: '0.85em', color: '#888' }}>
                    Q: <span dir="auto">{log.question}</span>
                  </div>
                  <div style={{ fontSize: '0.85em', marginTop: 4 }}>
                    A: <span dir="auto">{log.response}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Register route and nav tab in App.tsx**

Add import: `import AILogsPage from './pages/AILogsPage';`

Add route inside `<Routes>`:

```tsx
<Route
  path="/ai-logs"
  element={isSuperAdmin ? <AILogsPage /> : <Navigate to="/products" replace />}
/>
```

Add nav tab in the super_admin nav block:

```tsx
<NavLink
  to="/ai-logs"
  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
  onClick={() => window.scrollTo(0, 0)}
>
  <span className="nav-icon">🤖</span>AI Logs
</NavLink>
```

- [ ] **Step 4: Typecheck Mini App**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/api/keys.ts admin-app/src/pages/AILogsPage.tsx admin-app/src/App.tsx
git commit -m "feat(admin-app): AI Logs page with user filter for super_admin"
```

---

## Task 3: Streak Config — Move Toggles to Settings Table

**Files:**

- Modify: `src/bot.ts` — read `streak_messages` and `streak_cron_enabled` from settings table (with env fallback)
- Modify: `src/repositories/index.ts` — add `resetStreak(telegramId)` to `UserStateRepository`
- Modify: `src/api/router.ts` — add `POST /api/streaks/reset` and `GET /api/streaks/config`

**Interfaces:**

- Consumes: `SettingsRepository.getValue('streak_messages')` / `getValue('streak_cron_enabled')` — returns `'true'`/`'false'`/`null`
- Produces: `GET /api/streaks/config` → `{ streakMessages: boolean, streakCronEnabled: boolean }`
- Produces: `POST /api/streaks/reset` body `{ telegramId: string }` → resets that user's streakDays to 0

- [ ] **Step 1: Update streak middleware in bot.ts to read from settings with env fallback**

Replace the streak middleware condition at line 45:

```typescript
// Before: if (ctx.from?.id && ctx.env.STREAK_MESSAGES === 'true') {
// After:
const streakRepo = new SettingsRepository(ctx.env.DB);
const streakEnabled = (await streakRepo.getValue('streak_messages')) ?? ctx.env.STREAK_MESSAGES;
if (ctx.from?.id && streakEnabled === 'true') {
```

Important: the settings read must be inside the middleware, not at module scope, because `ctx.env.DB` is only available at request time.

- [ ] **Step 2: Add `resetStreak()` to UserStateRepository**

```typescript
async resetStreak(telegramId: string): Promise<boolean> {
  const rows = await this.db
    .update(userState)
    .set({ streakDays: 0 })
    .where(eq(userState.telegramId, telegramId))
    .returning({ telegramId: userState.telegramId });
  return rows.length > 0;
}
```

- [ ] **Step 3: Add streak config and reset endpoints to router**

```typescript
// --- Streak Config (super_admin) ---
if (path === 'streaks/config' && method === 'GET') {
  if (!isSuperAdmin)
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: corsHeaders,
    });
  const repo = new SettingsRepository(db);
  const streakMessages = (await repo.getValue('streak_messages')) ?? env.STREAK_MESSAGES ?? 'false';
  const streakCronEnabled =
    (await repo.getValue('streak_cron_enabled')) ?? env.STREAK_CRON_ENABLED ?? 'false';
  return new Response(
    JSON.stringify({
      streakMessages: streakMessages === 'true',
      streakCronEnabled: streakCronEnabled === 'true',
    }),
    { headers: corsHeaders },
  );
}

if (path === 'streaks/config' && method === 'POST') {
  if (!isSuperAdmin)
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: corsHeaders,
    });
  const body: any = await request.json();
  const repo = new SettingsRepository(db);
  if (body.streakMessages !== undefined)
    await repo.setValue('streak_messages', body.streakMessages ? 'true' : 'false');
  if (body.streakCronEnabled !== undefined)
    await repo.setValue('streak_cron_enabled', body.streakCronEnabled ? 'true' : 'false');
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
}

// --- Streak Reset (super_admin) ---
if (path === 'streaks/reset' && method === 'POST') {
  if (!isSuperAdmin)
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: corsHeaders,
    });
  const body: any = await request.json();
  if (!body.telegramId)
    return new Response(JSON.stringify({ error: 'telegramId required' }), {
      status: 400,
      headers: corsHeaders,
    });
  const repo = new UserStateRepository(db);
  const ok = await repo.resetStreak(String(body.telegramId));
  return new Response(JSON.stringify({ success: ok }), { headers: corsHeaders });
}
```

- [ ] **Step 4: Run typecheck and tests**

```bash
cd /data/data/com.termux/files/home/repo/azadi && npm run typecheck && npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/bot.ts src/repositories/index.ts src/api/router.ts
git commit -m "feat(api): streak config endpoints + reset; bot reads from settings table with env fallback"
```

---

## Task 4: Streaks Page — Add Config Toggles and Reset Button

**Files:**

- Modify: `admin-app/src/pages/StreaksPage.tsx` — add config section + per-user reset

**Interfaces:**

- Consumes: `GET /api/streaks/config`, `POST /api/streaks/config`, `POST /api/streaks/reset`
- Query keys: add `streakConfig` to `admin-app/src/api/keys.ts`

- [ ] **Step 1: Add streakConfig query key**

```typescript
streakConfig: ['streakConfig'] as const,
```

- [ ] **Step 2: Add config section to StreaksPage**

At the top of the StreaksPage component, add a config query:

```typescript
const queryClient = useQueryClient();
const { data: config } = useQuery({
  queryKey: queryKeys.streakConfig,
  queryFn: () =>
    apiFetch<{ streakMessages: boolean; streakCronEnabled: boolean }>('/streaks/config'),
});
```

Add a config toggle section before the stat tiles:

```tsx
<div className="card">
  <h2>Streak Configuration</h2>
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="checkbox"
        checked={config?.streakMessages ?? false}
        onChange={(e) => {
          apiFetch('/streaks/config', {
            method: 'POST',
            body: { streakMessages: e.target.checked },
          })
            .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.streakConfig }))
            .catch((err) => setError(err.message));
        }}
      />
      Streak Messages
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="checkbox"
        checked={config?.streakCronEnabled ?? false}
        onChange={(e) => {
          apiFetch('/streaks/config', {
            method: 'POST',
            body: { streakCronEnabled: e.target.checked },
          })
            .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.streakConfig }))
            .catch((err) => setError(err.message));
        }}
      />
      Streak Sweep Cron
    </label>
  </div>
</div>
```

- [ ] **Step 3: Add per-user reset button**

In the user list, replace the `streakDays` button with a reset action:

```tsx
<button
  type="button"
  className="secondary"
  onClick={async () => {
    if (!(await confirm(`Reset streak for ${u.telegramId}?`))) return;
    await apiFetch('/streaks/reset', { method: 'POST', body: { telegramId: u.telegramId } });
    void queryClient.invalidateQueries({ queryKey: queryKeys.streaks });
  }}
>
  🔥 {u.streakDays}d ↺
</button>
```

- [ ] **Step 4: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/api/keys.ts admin-app/src/pages/StreaksPage.tsx
git commit -m "feat(admin-app): streak config toggles and per-user reset button"
```

---

## Task 5: Settings Page — Expand with AI & About Settings

**Files:**

- Modify: `admin-app/src/pages/SettingsPage.tsx` — add `about` to BUILTIN_KEYS, add AI-related settings section

**Interfaces:**

- Consumes: existing `GET /api/settings`, `POST /api/settings`
- No new API needed — settings already stored via key-value

- [ ] **Step 1: Expand BUILTIN_KEYS and labels**

```typescript
const BUILTIN_KEYS = ['instagram', 'phone', 'price_unit', 'ai_greeting', 'about'];
const BUILTIN_LABELS: Record<string, string> = {
  instagram: 'Instagram URL',
  phone: 'Contact Phone',
  price_unit: 'Price Unit',
  ai_greeting: 'AI Greeting',
  about: 'About Text (shown in "درباره ما" and AI context)',
};
```

- [ ] **Step 2: Make `about` textarea instead of input**

Add a conditional render in the form:

```tsx
{
  key === 'about' ? (
    <textarea
      value={localSettings.find((s: any) => s.key === key)?.value || ''}
      onChange={(e) => updateSetting(key, e.target.value)}
      dir="auto"
      rows={4}
    />
  ) : (
    <input
      value={localSettings.find((s: any) => s.key === key)?.value || ''}
      onChange={(e) => updateSetting(key, e.target.value)}
      dir={key === 'ai_greeting' || key === 'about' ? 'auto' : undefined}
    />
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/pages/SettingsPage.tsx
git commit -m "feat(admin-app): expand settings page with about text field"
```

---

## Task 6: AI Chat Test Panel — API Endpoint

**Files:**

- Modify: `src/api/router.ts` — add `POST /api/ai-test` endpoint
- Modify: `src/handlers/message.ts` — extract AI query logic into a shared function

**Interfaces:**

- Produces: `POST /api/ai-test` body `{ query: string }` → `{ response: string }`
- Auth: super_admin only
- The endpoint builds the same context the bot uses (products, branches, FAQs, settings, popular products) and calls `AiService.processQuery()`

- [ ] **Step 1: Extract AI query logic from message handler**

In `src/handlers/message.ts`, extract the AI path into a reusable function:

```typescript
export async function runAiQuery(
  db: D1Database,
  query: string,
  userId: string = 'admin-test',
): Promise<string> {
  const productRepo = new ProductRepository(db);
  const branchRepo = new BranchRepository(db);
  const faqRepo = new FaqRepository(db);
  const menuConfigRepo = new MenuConfigRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const favoritesRepo = new FavoritesRepository(db);

  const [productsWithDetails, branches, faqs, visibleCategoryIds, aboutSetting, popularProducts] =
    await Promise.all([
      productRepo.getAllProductsWithDetails(),
      branchRepo.getAllBranches(),
      faqRepo.getAll(),
      menuConfigRepo.getVisibleCategoryIds(),
      settingsRepo.getValue('about'),
      productRepo.getPopularProducts(5),
    ]);

  const menuContext = buildMinimalContext({
    query,
    productsWithDetails,
    branches,
    faqs,
    visibleCategoryIds,
    settings: aboutSetting ? { about: aboutSetting } : undefined,
    popularProducts,
  });

  const aiService = new AiService(process.env.OPENCODE_API_KEY ?? '', menuContext);
  return aiService.processQuery(query, userId, [], []);
}
```

- [ ] **Step 2: Add `POST /api/ai-test` route**

```typescript
// --- AI Test Panel (super_admin only) ---
if (path === 'ai-test' && method === 'POST') {
  if (!isSuperAdmin)
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: corsHeaders,
    });
  const body: any = await request.json();
  if (!body.query || typeof body.query !== 'string')
    return new Response(JSON.stringify({ error: 'query required' }), {
      status: 400,
      headers: corsHeaders,
    });
  try {
    const response = await runAiQuery(db, body.query);
    return new Response(JSON.stringify({ response }), { headers: corsHeaders });
  } catch (e: any) {
    console.error('ai-test error:', e);
    return new Response(JSON.stringify({ error: 'AI query failed' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
```

- [ ] **Step 3: Run typecheck and tests**

```bash
cd /data/data/com.termux/files/home/repo/azadi && npm run typecheck && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/api/router.ts src/handlers/message.ts
git commit -m "feat(api): POST /api/ai-test endpoint for admin AI testing"
```

---

## Task 7: AI Chat Test Panel — Mini App UI

**Files:**

- Modify: `admin-app/src/api/keys.ts` — no new key needed (use mutation)
- Create: `admin-app/src/pages/AITestPage.tsx`
- Modify: `admin-app/src/App.tsx` — add route + nav tab

**Interfaces:**

- Consumes: `POST /api/ai-test` body `{ query }` → `{ response }`
- Produces: `/ai-test` route, "🧪 AI Test" nav tab (super_admin only)

- [ ] **Step 1: Create AITestPage.tsx**

```tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAppContext } from '../AppContext';
import { apiFetch } from '../api/client';
import Field from '../components/Field';

export default function AITestPage() {
  const { setError, showToast } = useAppContext();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Array<{ q: string; a: string; ts: Date }>>([]);

  const testMutation = useMutation({
    mutationFn: (q: string) =>
      apiFetch<{ response: string }>('/ai-test', { method: 'POST', body: { query: q } }),
    onSuccess: (data, variables) => {
      setHistory((prev) => [{ q: variables, a: data.response, ts: new Date() }, ...prev]);
      setQuery('');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    testMutation.mutate(query);
  };

  return (
    <>
      <div className="card">
        <h2>AI Chat Test</h2>
        <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
          Send a test query to the AI assistant. Uses the same context as the bot.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <Field label="Test Query">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. What do you recommend?"
              dir="auto"
              style={{ flex: 1 }}
            />
          </Field>
          <button type="submit" className="primary" disabled={testMutation.isPending}>
            {testMutation.isPending ? '⏳ Sending...' : 'Send'}
          </button>
        </form>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h2>Results</h2>
          <ul className="list">
            {history.map((item, i) => (
              <li
                key={i}
                className="list-item"
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9em' }}>
                    Q: <span dir="auto">{item.q}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: '0.9em' }}>
                    A: <span dir="auto">{item.a}</span>
                  </div>
                  <div style={{ fontSize: '0.75em', color: '#aaa', marginTop: 2 }}>
                    {item.ts.toLocaleTimeString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Register route and nav tab in App.tsx**

Add import and route/nav similar to Task 2.

- [ ] **Step 3: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/pages/AITestPage.tsx admin-app/src/App.tsx
git commit -m "feat(admin-app): AI Chat Test page for super_admin testing"
```

---

## Task 8: Feature Flags Display in Settings

**Files:**

- Modify: `admin-app/src/pages/SettingsPage.tsx` — add read-only feature flags section
- Modify: `admin-app/src/api/keys.ts` — add `featureFlags` key (or reuse streakConfig)

**Interfaces:**

- Consumes: `GET /api/streaks/config` (already built in Task 3) + settings table
- Produces: Read-only display of all feature flag states

- [ ] **Step 1: Add feature flags section to SettingsPage**

After the Custom Settings section, add a card that queries the streak config and displays all flags:

```tsx
const { data: streakConfig } = useQuery({
  queryKey: queryKeys.streakConfig,
  queryFn: () =>
    apiFetch<{ streakMessages: boolean; streakCronEnabled: boolean }>('/streaks/config'),
});

// In the JSX:
<div className="card">
  <h2>Feature Flags (read-only)</h2>
  <ul className="list">
    <li className="list-item">
      <div className="list-item-info">
        <span>STREAK_MESSAGES</span>
        <span className="list-item-meta">{streakConfig?.streakMessages ? '✅ ON' : '❌ OFF'}</span>
      </div>
    </li>
    <li className="list-item">
      <div className="list-item-info">
        <span>STREAK_CRON_ENABLED</span>
        <span className="list-item-meta">
          {streakConfig?.streakCronEnabled ? '✅ ON' : '❌ OFF'}
        </span>
      </div>
    </li>
    <li className="list-item">
      <div className="list-item-info">
        <span>USE_CONVERSATIONS</span>
        <span className="list-item-meta" style={{ color: '#999' }}>
          🔒 Requires code changes
        </span>
      </div>
    </li>
    <li className="list-item">
      <div className="list-item-info">
        <span>PERF_LOG</span>
        <span className="list-item-meta" style={{ color: '#999' }}>
          🔒 Set via wrangler secret
        </span>
      </div>
    </li>
  </ul>
</div>;
```

- [ ] **Step 2: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/pages/SettingsPage.tsx
git commit -m "feat(admin-app): feature flags display in settings page"
```

---

## Task 9: Webhook Health Endpoint

**Files:**

- Modify: `src/api/router.ts` — add `GET /api/health`

**Interfaces:**

- Produces: `GET /api/health` → `{ status: 'ok', db: boolean, uptime: number }`
- No auth required (health check endpoint)

- [ ] **Step 1: Add health endpoint at the top of the router (before auth check)**

Insert before the auth validation block:

```typescript
// --- Health check (no auth) ---
if (path === 'health' && method === 'GET') {
  let dbOk = false;
  try {
    const testDb = getDb(env.DB);
    await testDb.select().from(settings).limit(1);
    dbOk = true;
  } catch {
    /* db unreachable */
  }
  return new Response(
    JSON.stringify({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk,
      timestamp: new Date().toISOString(),
    }),
    { headers: corsHeaders },
  );
}
```

- [ ] **Step 2: Run typecheck and tests**

```bash
cd /data/data/com.termux/files/home/repo/azadi && npm run typecheck && npm test
```

- [ ] **Step 3: Commit**

```bash
git add src/api/router.ts
git commit -m "feat(api): GET /api/health endpoint for webhook health checks"
```

---

## Task 10: Mini App — Product Image Preview

**Files:**

- Modify: `admin-app/src/pages/ProductsPage.tsx` — add image preview in edit form

**Interfaces:**

- No API change — uses existing `imageUrl` field
- Adds a clickable preview that opens the image in a new tab

- [ ] **Step 1: Add image preview link next to the image URL input**

After the image URL `<Field>`, add:

```tsx
{
  prodImageUrl && (
    <div style={{ marginBottom: 8 }}>
      <a
        href={prodImageUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: '0.85em', color: '#4a90d9' }}
      >
        🔗 Preview image in new tab
      </a>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/pages/ProductsPage.tsx
git commit -m "feat(admin-app): product image preview link in edit form"
```

---

## Task 11: Webhook Health Display in Mini App

**Files:**

- Modify: `admin-app/src/api/keys.ts` — add `health` key
- Modify: `admin-app/src/pages/SettingsPage.tsx` — add health status card

**Interfaces:**

- Consumes: `GET /api/health` → `{ status, db, timestamp }`
- Produces: Health status card in Settings page

- [ ] **Step 1: Add health query key**

```typescript
health: ['health'] as const,
```

- [ ] **Step 2: Add health status card to SettingsPage**

```tsx
const { data: health } = useQuery({
  queryKey: queryKeys.health,
  queryFn: () => apiFetch<{ status: string; db: boolean; timestamp: string }>('/health'),
  refetchInterval: 30000, // auto-refresh every 30s
});

// In JSX:
<div className="card">
  <h2>System Health</h2>
  <ul className="list">
    <li className="list-item">
      <div className="list-item-info">
        <span>API Status</span>
        <span className="list-item-meta">
          {health?.status === 'ok' ? '✅ Healthy' : '⚠️ ' + (health?.status ?? 'Unknown')}
        </span>
      </div>
    </li>
    <li className="list-item">
      <div className="list-item-info">
        <span>Database</span>
        <span className="list-item-meta">{health?.db ? '✅ Connected' : '❌ Unreachable'}</span>
      </div>
    </li>
  </ul>
</div>;
```

- [ ] **Step 3: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/api/keys.ts admin-app/src/pages/SettingsPage.tsx
git commit -m "feat(admin-app): system health display in settings page"
```

---

## Task 12: Menu Config Preview Hint

**Files:**

- Modify: `admin-app/src/pages/MenuConfigPage.tsx` — add a note explaining the bot menu tree

**Interfaces:**

- No API change — purely a UX hint

- [ ] **Step 1: Add preview hint**

After the `<h2>Menu Configuration</h2>` heading, add:

```tsx
<p style={{ fontSize: '0.85em', color: '#888', marginBottom: 12 }}>
  Menu order here controls the bot's inline keyboard layout. Sections: ☕ Drinks, 🌱 Beans, 🍰
  Cakes, 📍 Branches. Use the bot's <code>/start</code> command to preview the result.
</p>
```

- [ ] **Step 2: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/pages/MenuConfigPage.tsx
git commit -m "feat(admin-app): menu config preview hint in admin UI"
```

---

## Task 13: AI Personality Settings Hint

**Files:**

- Modify: `admin-app/src/pages/SettingsPage.tsx` — add a note about AI personality configuration

**Interfaces:**

- No API change — purely a UX hint

- [ ] **Step 1: Add AI configuration hint card**

After the Feature Flags section:

```tsx
<div className="card">
  <h2>🤖 AI Assistant</h2>
  <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
    The AI assistant's personality and behavior are configured in the bot's source code (
    <code>AiService</code>). The settings below affect the context the AI uses:
  </p>
  <ul className="list">
    <li className="list-item">
      <div className="list-item-info">
        <span>
          <b>about</b> — Shop description in AI context
        </span>
        <span className="list-item-meta">↑ Set above</span>
      </div>
    </li>
    <li className="list-item">
      <div className="list-item-info">
        <span>
          <b>ai_greeting</b> — Initial greeting message
        </span>
        <span className="list-item-meta">↑ Set above</span>
      </div>
    </li>
    <li className="list-item">
      <div className="list-item-info">
        <span>
          <b>Products / FAQs / Branches</b> — All managed data feeds the AI
        </span>
        <span className="list-item-meta">↑ Managed in their pages</span>
      </div>
    </li>
  </ul>
</div>
```

- [ ] **Step 2: Typecheck**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/pages/SettingsPage.tsx
git commit -m "feat(admin-app): AI assistant configuration guide in settings"
```

---

## Final: Full Build + Deploy

After all tasks are complete:

- [ ] **Step 1: Run all Worker tests**

```bash
cd /data/data/com.termux/files/home/repo/azadi && npm test && npm run typecheck
```

- [ ] **Step 2: Build Mini App**

```bash
cd /data/data/com.termux/files/home/repo/azadi/admin-app && npm run build
```

- [ ] **Step 3: Deploy Worker**

```bash
cd /data/data/com.termux/files/home/repo/azadi && npm run deploy
```

- [ ] **Step 4: Deploy Mini App**

```bash
cd /data/data/com.termux/files/home/repo/azadi && npx wrangler pages deploy admin-app/dist --project-name=azadi-admin
```

## Verification

After deploy, test in Telegram and Mini App:

1. Open Mini App → Settings → verify health card shows ✅
2. Open Mini App → AI Logs → verify log list loads (empty is fine)
3. Open Mini App → AI Test → send "what do you recommend?" → verify response
4. Open Mini App → Streaks → toggle streak messages on → verify setting persists
5. Open Mini App → Settings → verify feature flags display
6. Bot: send a message → verify AI still responds correctly
