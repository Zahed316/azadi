# Dual-App UI Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public API endpoints and a new Menu Website mini-app for Azadi Coffee, deployed as a sibling Vite app to Cloudflare Pages.

**Architecture:** New `/api/public/*` routes (no auth, filtered data) on the existing Worker + a new `menu-app/` React app deployed to `azadi-menu.pages.dev`. The menu-app uses HashRouter, react-query with 60s staleTime, and no Telegram SDK dependency.

**Tech Stack:** React 18, Vite 6, react-router-dom 6, @tanstack/react-query 5, TypeScript 5, Cloudflare Workers (existing), D1 (existing), KV (existing)

## Global Constraints

- All bot UI text is **Persian (Farsi)** with HTML parse mode for bot messages; the menu-app uses `dir="rtl"` and Persian text for menu content
- Use `toPersianDigits()` and `formatPersianPrice(amount, unit)` from `src/utils/numbers.ts` for numeric display
- No `@telegram-apps/sdk` in the menu-app — it's a public site
- Menu-app API client has **no auth header**
- `wrangler deploy` validates all bindings — run `wrangler deploy --dry-run` after changes
- CI is the ONLY auto-deployment path — push to main deploys both Worker and Pages
- Existing lint baseline: ~137 root + ~294 admin warnings — ESLint is non-blocking in CI
- `node ./node_modules/...` shebang-free script invocations for Termux compatibility
- D1 database_id: `2c020279-a453-4105-984d-c09bdda89819`
- KV namespace CACHE id: `cf01f801bdae488b9196782f2541d288`
- Worker name: `azadi-coffee-bot`
- Pages projects: `azadi-admin` (existing), `azadi-menu` (new)

---

## File Structure

### New Files

| File                                       | Purpose                                               |
| ------------------------------------------ | ----------------------------------------------------- |
| `src/api/public.ts`                        | Public API handler — 9 routes, no auth, filtered data |
| `menu-app/package.json`                    | Menu app dependencies (no @telegram-apps/sdk)         |
| `menu-app/tsconfig.json`                   | TypeScript config (copied from admin-app)             |
| `menu-app/vite.config.ts`                  | Vite config (no telegram chunk)                       |
| `menu-app/eslint.config.mjs`               | ESLint config (copied from admin-app)                 |
| `menu-app/index.html`                      | Entry HTML                                            |
| `menu-app/src/main.tsx`                    | React entry point                                     |
| `menu-app/src/App.tsx`                     | Root component with HashRouter + React Query          |
| `menu-app/src/index.css`                   | Styles (RTL, mobile-first)                            |
| `menu-app/src/api/client.ts`               | API fetch wrapper (no auth)                           |
| `menu-app/src/api/keys.ts`                 | Query key constants                                   |
| `menu-app/src/components/Header.tsx`       | Site header with logo                                 |
| `menu-app/src/components/ProductCard.tsx`  | Product display card                                  |
| `menu-app/src/components/CategoryGrid.tsx` | Category navigation grid                              |
| `menu-app/src/components/BranchInfo.tsx`   | Branch hours/location display                         |
| `menu-app/src/components/EmptyState.tsx`   | Empty state component (copied)                        |
| `menu-app/src/components/Spinner.tsx`      | Loading spinner (copied)                              |
| `menu-app/src/pages/HomePage.tsx`          | Section navigation                                    |
| `menu-app/src/pages/CategoryPage.tsx`      | Products in a category                                |
| `menu-app/src/pages/ProductPage.tsx`       | Single product detail                                 |
| `menu-app/src/pages/FeaturedPage.tsx`      | Featured products                                     |
| `menu-app/src/pages/SeasonalPage.tsx`      | Seasonal products                                     |
| `menu-app/src/pages/BranchesPage.tsx`      | Active branches                                       |
| `menu-app/src/pages/FaqPage.tsx`           | FAQ list                                              |
| `menu-app/src/utils/numbers.ts`            | Persian digit utilities (copied)                      |

### Modified Files

| File                           | Change                                                         |
| ------------------------------ | -------------------------------------------------------------- |
| `src/index.ts`                 | Route `/api/public/*` to new handler before auth-gated handler |
| `src/api/router.ts`            | Add `https://azadi-menu.pages.dev` to `ALLOWED_ORIGINS`        |
| `.github/workflows/deploy.yml` | Add `deploy-menu-app` job                                      |

---

## Tasks

### Task 1: Public API Endpoints

**Files:**

- Create: `src/api/public.ts`
- Modify: `src/index.ts:24-34`
- Modify: `src/api/router.ts:23`

**Interfaces:**

- Consumes: `DataService` (from `src/services/data/index.ts`), `CacheService` (from `src/services/cache/index.ts`)
- Produces: `handlePublicApiRequest(request, env, ctx)` — returns `Promise<Response>`

- [ ] **Step 1: Create `src/api/public.ts`**

```typescript
import { Env } from '../bot';
import { getDb } from '../database/client';
import { CacheService } from '../services/cache';
import { DataService } from '../services/data';
import { settings } from '../database/schema';
import { eq, asc } from 'drizzle-orm';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const PUBLIC_SETTINGS_KEYS = ['about', 'price_unit', 'instagram'];

export async function handlePublicApiRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/public/', ''); // e.g. "products"
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Only GET is allowed for public endpoints
  if (method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const cache = env.CACHE ? new CacheService(env.CACHE) : undefined;
  const dataService = new DataService(env.DB, cache);

  try {
    // --- GET /api/public/menu ---
    if (path === 'menu') {
      const sections = ['drinks', 'beans', 'cakes', 'extras'];
      const menuData: Record<string, any[]> = {};
      for (const section of sections) {
        const entries = await dataService.getBySection(section);
        menuData[section] = entries.filter((e) => e.isVisible);
      }
      return new Response(JSON.stringify({ sections: menuData }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/products/featured ---
    if (path === 'products/featured') {
      const all = await dataService.getAllProductsWithDetails();
      const featured = all
        .filter((p) => p.products.featured && p.products.available)
        .map((p) => ({
          ...p.products,
          coffee_details: p.coffee_details,
          category: p.categories,
        }));
      return new Response(JSON.stringify({ products: featured }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/products/seasonal ---
    if (path === 'products/seasonal') {
      const all = await dataService.getAllProductsWithDetails();
      const seasonal = all
        .filter((p) => p.products.isSeasonal && p.products.available)
        .map((p) => ({
          ...p.products,
          coffee_details: p.coffee_details,
          category: p.categories,
        }));
      return new Response(JSON.stringify({ products: seasonal }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/products/:id ---
    const productMatch = path.match(/^products\/(\d+)$/);
    if (productMatch) {
      const id = parseInt(productMatch[1], 10);
      const product = await dataService.getProductById(id);
      if (!product || !product.available) {
        return new Response(JSON.stringify({ error: 'Product not found' }), {
          status: 404,
          headers: CORS_HEADERS,
        });
      }
      const details = await dataService.getCoffeeDetails(id);
      const categories = await dataService.getAllCategories();
      const category = categories.find((c) => c.id === product.categoryId);
      return new Response(
        JSON.stringify({
          product: { ...product, coffee_details: details, category },
        }),
        { headers: CORS_HEADERS },
      );
    }

    // --- GET /api/public/products ---
    if (path === 'products') {
      const all = await dataService.getAllProductsWithDetails();
      const available = all
        .filter((p) => p.products.available)
        .map((p) => ({
          ...p.products,
          coffee_details: p.coffee_details,
          category: p.categories,
        }));
      return new Response(JSON.stringify({ products: available }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/categories ---
    if (path === 'categories') {
      const categories = await dataService.getAllCategories();
      return new Response(JSON.stringify({ categories }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/branches ---
    if (path === 'branches') {
      const branches = await dataService.getActiveBranches();
      return new Response(JSON.stringify({ branches }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/faq ---
    if (path === 'faq') {
      const faqs = await dataService.getAllFaqs();
      return new Response(JSON.stringify({ faqs }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/settings ---
    if (path === 'settings') {
      const db = getDb(env.DB);
      const rows = await db.select().from(settings);
      const filtered: Record<string, string> = {};
      for (const row of rows) {
        if (PUBLIC_SETTINGS_KEYS.includes(row.key)) {
          filtered[row.key] = row.value;
        }
      }
      return new Response(JSON.stringify({ settings: filtered }), { headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        operation: 'public-api-error',
        method,
        path,
        error: errMsg,
      }),
    );
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
```

- [ ] **Step 2: Modify `src/index.ts` to route public API**

Add import and route before the auth-gated handler:

```typescript
// At top, add import:
import { handlePublicApiRequest } from './api/public';

// In the fetch handler, BEFORE the existing /api/ check (line 24):
if (path.startsWith('/api/public/')) {
  return handlePublicApiRequest(request, env, ctx);
}
```

- [ ] **Step 3: Update CORS whitelist in `src/api/router.ts`**

Change line 23:

```typescript
const ALLOWED_ORIGINS = [
  'https://azadi-admin.pages.dev',
  'https://azadi-menu.pages.dev',
  'https://web.telegram.org',
];
```

- [ ] **Step 4: Run existing tests to verify no regressions**

```bash
npm test
```

Expected: All 150+ tests pass.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/api/public.ts src/index.ts src/api/router.ts
git commit -m "feat: add public API endpoints for menu website

- 9 new routes under /api/public/* with no auth required
- Filtered data: available products, active branches, visible menu config
- Whitelisted settings keys: about, price_unit, instagram
- CORS wildcard for public access
- Route /api/public/* before auth-gated handler in index.ts"
```

---

### Task 2: Menu App Scaffold

**Files:**

- Create: `menu-app/package.json`
- Create: `menu-app/tsconfig.json`
- Create: `menu-app/vite.config.ts`
- Create: `menu-app/eslint.config.mjs`
- Create: `menu-app/index.html`
- Create: `menu-app/src/main.tsx`
- Create: `menu-app/src/App.tsx`
- Create: `menu-app/src/index.css`
- Create: `menu-app/src/api/client.ts`
- Create: `menu-app/src/api/keys.ts`
- Create: `menu-app/src/utils/numbers.ts`

**Interfaces:**

- Consumes: Public API endpoints from Task 1 (`/api/public/*`)
- Produces: Runnable Vite dev server, buildable production bundle

- [ ] **Step 1: Create `menu-app/package.json`**

```json
{
  "name": "menu-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "node ./node_modules/vite/bin/vite.js",
    "preview": "node ./node_modules/vite/bin/vite.js preview",
    "lint": "node ./node_modules/eslint/bin/eslint.js .",
    "format": "node ./node_modules/prettier/bin/prettier.cjs --write .",
    "format:check": "node ./node_modules/prettier/bin/prettier.cjs --check .",
    "typecheck": "node ./node_modules/typescript/bin/tsc --noEmit",
    "build": "node ./node_modules/typescript/bin/tsc && node ./node_modules/vite/bin/vite.js build",
    "check": "npm run typecheck && npm run lint && npm run format:check"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.101.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.30.4"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^9.39.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.26",
    "globals": "^15.15.0",
    "prettier": "^3.9.6",
    "typescript": "^5.2.2",
    "typescript-eslint": "^8.66.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `menu-app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `menu-app/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
```

- [ ] **Step 4: Create `menu-app/eslint.config.mjs`**

```javascript
import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [pluginJs.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': pluginReactHooks,
      'react-refresh': pluginReactRefresh,
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
);
```

- [ ] **Step 5: Create `menu-app/index.html`**

```html
<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ازادی کافه — منو</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `menu-app/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Create `menu-app/src/api/client.ts`**

```typescript
export const API_BASE = 'https://azadi-coffee-bot.zahedrastgar316.workers.dev/api/public';

export async function apiFetch<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 8: Create `menu-app/src/api/keys.ts`**

```typescript
export const queryKeys = {
  menu: ['menu'] as const,
  products: ['products'] as const,
  product: (id: number) => ['product', id] as const,
  featured: ['products', 'featured'] as const,
  seasonal: ['products', 'seasonal'] as const,
  categories: ['categories'] as const,
  branches: ['branches'] as const,
  faq: ['faq'] as const,
  settings: ['settings'] as const,
} as const;
```

- [ ] **Step 9: Create `menu-app/src/utils/numbers.ts`**

```typescript
export function toPersianDigits(input: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (d) => persianDigits[parseInt(d)]);
}

export function formatPersianPrice(amount: number, unit: string = 'تومان'): string {
  const formatted = amount.toLocaleString('fa-IR');
  return `${formatted} ${unit}`;
}
```

- [ ] **Step 10: Create `menu-app/src/App.tsx`**

```tsx
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from './components/Header';
import Spinner from './components/Spinner';

const HomePage = lazy(() => import('./pages/HomePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const FeaturedPage = lazy(() => import('./pages/FeaturedPage'));
const SeasonalPage = lazy(() => import('./pages/SeasonalPage'));
const BranchesPage = lazy(() => import('./pages/BranchesPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Header />
        <main className="container">
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/category/:id" element={<CategoryPage />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/featured" element={<FeaturedPage />} />
              <Route path="/seasonal" element={<SeasonalPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </HashRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 11: Create `menu-app/src/index.css`**

```css
:root {
  --bg: #faf9f6;
  --card-bg: #ffffff;
  --text: #1a1a1a;
  --text-secondary: #6b7280;
  --accent: #8b5e3c;
  --accent-light: #d4a574;
  --border: #e5e7eb;
  --radius: 12px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.container {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
  padding-top: 60px;
}

.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 0 16px;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--accent);
}

.card {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
}

.card-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}

.card-price {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent);
  margin-top: 8px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.grid-item {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px 16px;
  text-align: center;
  border: 1px solid var(--border);
  text-decoration: none;
  color: var(--text);
  transition: transform 0.15s ease;
}

.grid-item:active {
  transform: scale(0.97);
}

.grid-emoji {
  font-size: 32px;
  margin-bottom: 8px;
}

.grid-label {
  font-size: 14px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-secondary);
}

.spinner {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.spinner::after {
  content: '';
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.branch-card {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
}

.branch-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.branch-detail {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.faq-item {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
}

.faq-question {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
}

.faq-answer {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.back-link {
  display: inline-block;
  margin-bottom: 16px;
  color: var(--accent);
  text-decoration: none;
  font-size: 14px;
}

.back-link:hover {
  text-decoration: underline;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.detail-item {
  font-size: 13px;
}

.detail-label {
  color: var(--text-secondary);
  font-size: 12px;
}

.nav-links {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.nav-link {
  display: inline-block;
  padding: 8px 16px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s ease;
}

.nav-link:hover {
  background: var(--accent-light);
  color: white;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  margin-right: 6px;
}

.badge-featured {
  background: #fef3c7;
  color: #92400e;
}

.badge-seasonal {
  background: #d1fae5;
  color: #065f46;
}

.stock-info {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.about-section {
  background: var(--card-bg);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid var(--border);
  font-size: 15px;
  line-height: 1.8;
  color: var(--text-secondary);
}
```

- [ ] **Step 12: Install dependencies and verify build**

```bash
cd menu-app && npm install && npm run typecheck && npm run build
```

Expected: Clean typecheck, successful build.

- [ ] **Step 13: Commit**

```bash
git add menu-app/
git commit -m "feat: scaffold menu-app with Vite + React + HashRouter

- React 18, react-query v5, react-router-dom v6
- No @telegram-apps/sdk (public site)
- HashRouter with 7 routes
- React Query config: staleTime 60s, gcTime 5m
- RTL layout, mobile-first CSS
- API client without auth header
- Persian digit utilities"
```

---

### Task 3: Menu App Components

**Files:**

- Create: `menu-app/src/components/Header.tsx`
- Create: `menu-app/src/components/ProductCard.tsx`
- Create: `menu-app/src/components/CategoryGrid.tsx`
- Create: `menu-app/src/components/BranchInfo.tsx`
- Create: `menu-app/src/components/EmptyState.tsx`
- Create: `menu-app/src/components/Spinner.tsx`

**Interfaces:**

- Consumes: Query keys from `menu-app/src/api/keys.ts`
- Produces: Reusable UI components for pages

- [ ] **Step 1: Create `menu-app/src/components/Spinner.tsx`**

```tsx
export default function Spinner() {
  return <div className="spinner" role="status" aria-label="در حال بارگذاری" />;
}
```

- [ ] **Step 2: Create `menu-app/src/components/EmptyState.tsx`**

```tsx
interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = 'موردی یافت نشد' }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create `menu-app/src/components/Header.tsx`**

```tsx
export default function Header() {
  return (
    <header className="header">
      <h1>ازادی کافه</h1>
    </header>
  );
}
```

- [ ] **Step 4: Create `menu-app/src/components/ProductCard.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { toPersianDigits, formatPersianPrice } from '../utils/numbers';

interface ProductCardProps {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  unit: string;
  imageUrl?: string | null;
  featured?: boolean;
  isSeasonal?: boolean;
  stock?: number;
  priceOnRequest?: boolean;
}

export default function ProductCard({
  id,
  name,
  description,
  price,
  unit,
  imageUrl,
  featured,
  isSeasonal,
  stock,
  priceOnRequest,
}: ProductCardProps) {
  return (
    <Link
      to={`/product/${id}`}
      className="card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {imageUrl && <img src={imageUrl} alt={name} className="card-image" loading="lazy" />}
      <div className="card-title">
        {featured && <span className="badge badge-featured">⭐ ویژه</span>}
        {isSeasonal && <span className="badge badge-seasonal">🌿 فصلی</span>}
        {name}
      </div>
      {description && <div className="card-subtitle">{description}</div>}
      {price != null && !priceOnRequest && (
        <div className="card-price">{formatPersianPrice(price)}</div>
      )}
      {priceOnRequest && <div className="card-price">قیمت به درخواست</div>}
      {unit !== 'cup' && stock != null && (
        <div className="stock-info">
          موجودی: {toPersianDigits(stock)}{' '}
          {unit === 'kg' ? 'کیلوگرم' : unit === 'g' ? 'گرم' : 'عدد'}
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 5: Create `menu-app/src/components/CategoryGrid.tsx`**

```tsx
import { Link } from 'react-router-dom';

interface Category {
  id: number;
  name: string;
  emoji?: string | null;
}

interface CategoryGridProps {
  categories: Category[];
}

export default function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <div className="grid">
      {categories.map((cat) => (
        <Link key={cat.id} to={`/category/${cat.id}`} className="grid-item">
          {cat.emoji && <div className="grid-emoji">{cat.emoji}</div>}
          <div className="grid-label">{cat.name}</div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `menu-app/src/components/BranchInfo.tsx`**

```tsx
interface Branch {
  id: number;
  name: string;
  address: string;
  phone?: string | null;
  location?: string | null;
  openingHours?: string | null;
}

interface BranchInfoProps {
  branch: Branch;
}

export default function BranchInfo({ branch }: BranchInfoProps) {
  return (
    <div className="branch-card">
      <div className="branch-name">{branch.name}</div>
      <div className="branch-detail">📍 {branch.address}</div>
      {branch.phone && <div className="branch-detail">📞 {branch.phone}</div>}
      {branch.openingHours && <div className="branch-detail">🕐 {branch.openingHours}</div>}
      {branch.location && (
        <div className="branch-detail">
          <a href={branch.location} target="_blank" rel="noopener noreferrer">
            🗺️ مشاهده در نقشه
          </a>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify components build**

```bash
cd menu-app && npm run typecheck
```

Expected: Clean.

- [ ] **Step 8: Commit**

```bash
git add menu-app/src/components/
git commit -m "feat: add menu-app components (Header, ProductCard, CategoryGrid, BranchInfo)

- Spinner and EmptyState (simple reusable)
- ProductCard with image, badges (featured/seasonal), price, stock
- CategoryGrid with emoji navigation
- BranchInfo with address, phone, hours, map link"
```

---

### Task 4: Menu App Pages

**Files:**

- Create: `menu-app/src/pages/HomePage.tsx`
- Create: `menu-app/src/pages/CategoryPage.tsx`
- Create: `menu-app/src/pages/ProductPage.tsx`
- Create: `menu-app/src/pages/FeaturedPage.tsx`
- Create: `menu-app/src/pages/SeasonalPage.tsx`
- Create: `menu-app/src/pages/BranchesPage.tsx`
- Create: `menu-app/src/pages/FaqPage.tsx`

**Interfaces:**

- Consumes: Components from Task 3, API client from Task 2, query keys from Task 2
- Produces: Complete page components for all routes

- [ ] **Step 1: Create `menu-app/src/pages/HomePage.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import CategoryGrid from '../components/CategoryGrid';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

interface MenuSection {
  id: number;
  categoryId: number;
  menuSection: string;
  displayOrder: number;
  isVisible: boolean;
  buttonLabel: string | null;
  specialMessage: string | null;
  categoryName: string | null;
  categoryEmoji: string | null;
}

interface MenuResponse {
  sections: Record<string, MenuSection[]>;
}

const SECTION_LABELS: Record<string, string> = {
  drinks: '☕ نوشیدنی‌ها',
  beans: '🫘 قهوه تخصصی',
  cakes: '🍰 شیرینی و کیک',
  extras: '✨ سایر',
};

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.menu,
    queryFn: () => apiFetch<MenuResponse>('/menu'),
  });

  if (isLoading) return <Spinner />;
  if (!data?.sections || Object.keys(data.sections).length === 0) {
    return <EmptyState message="منو در دسترس نیست" />;
  }

  return (
    <div>
      <div className="nav-links">
        <Link to="/featured" className="nav-link">
          ⭐ ویژه
        </Link>
        <Link to="/seasonal" className="nav-link">
          🌿 فصلی
        </Link>
        <Link to="/branches" className="nav-link">
          📍 شعب
        </Link>
        <Link to="/faq" className="nav-link">
          ❓ سوالات
        </Link>
      </div>

      {Object.entries(data.sections).map(([section, entries]) => (
        <div key={section} style={{ marginBottom: 24 }}>
          <h2 className="section-title">{SECTION_LABELS[section] || section}</h2>
          <CategoryGrid
            categories={entries.map((e) => ({
              id: e.categoryId,
              name: e.buttonLabel || e.categoryName || '',
              emoji: e.categoryEmoji,
            }))}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `menu-app/src/pages/CategoryPage.tsx`**

```tsx
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

interface Product {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  unit: string;
  imageUrl?: string | null;
  featured?: boolean;
  isSeasonal?: boolean;
  stock?: number;
  priceOnRequest?: boolean;
  categoryId: number;
}

interface ProductsResponse {
  products: Product[];
}

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const categoryId = parseInt(id || '0', 10);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => apiFetch<ProductsResponse>('/products'),
  });

  if (isLoading) return <Spinner />;
  if (!data?.products) return <EmptyState />;

  const filtered = data.products.filter((p) => p.categoryId === categoryId);

  return (
    <div>
      <Link to="/" className="back-link">
        ← بازگشت
      </Link>
      {filtered.length === 0 ? (
        <EmptyState message="محصولی در این دسته‌بندی نیست" />
      ) : (
        filtered.map((product) => <ProductCard key={product.id} {...product} />)
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `menu-app/src/pages/ProductPage.tsx`**

```tsx
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import { toPersianDigits, formatPersianPrice } from '../utils/numbers';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

interface CoffeeDetails {
  origin?: string | null;
  farm?: string | null;
  altitude?: string | null;
  processing?: string | null;
  variety?: string | null;
  roastLevel?: string | null;
  flavorNotes?: string | null;
  recommendedBrew?: string | null;
  brewGuide?: string | null;
}

interface ProductDetail {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  unit: string;
  imageUrl?: string | null;
  featured?: boolean;
  isSeasonal?: boolean;
  stock?: number;
  priceOnRequest?: boolean;
  calories?: number | null;
  caffeineMg?: number | null;
  allergens?: string | null;
  coffee_details?: CoffeeDetails | null;
  category?: { name: string; emoji?: string | null } | null;
}

interface ProductResponse {
  product: ProductDetail;
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id || '0', 10);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.product(productId),
    queryFn: () => apiFetch<ProductResponse>(`/products/${productId}`),
  });

  if (isLoading) return <Spinner />;
  if (!data?.product) return <EmptyState message="محصول یافت نشد" />;

  const p = data.product;
  const isCoffee = p.coffee_details != null;

  return (
    <div>
      <Link to="/" className="back-link">
        ← بازگشت
      </Link>
      <div className="card">
        {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="card-image" />}
        <div className="card-title">
          {p.featured && <span className="badge badge-featured">⭐ ویژه</span>}
          {p.isSeasonal && <span className="badge badge-seasonal">🌿 فصلی</span>}
          {p.name}
        </div>
        {p.category && (
          <div className="card-subtitle">
            {p.category.emoji} {p.category.name}
          </div>
        )}
        {p.description && <p style={{ marginTop: 8, lineHeight: 1.7 }}>{p.description}</p>}
        {p.price != null && !p.priceOnRequest && (
          <div className="card-price">{formatPersianPrice(p.price)}</div>
        )}
        {p.priceOnRequest && <div className="card-price">قیمت به درخواست</div>}
        {p.unit !== 'cup' && p.stock != null && (
          <div className="stock-info">موجودی: {toPersianDigits(p.stock)}</div>
        )}

        {/* Nutritional info */}
        {(p.calories || p.caffeineMg || p.allergens) && (
          <div className="detail-grid">
            {p.calories && (
              <div className="detail-item">
                <div className="detail-label">کالری</div>
                <div>{toPersianDigits(p.calories)}</div>
              </div>
            )}
            {p.caffeineMg && (
              <div className="detail-item">
                <div className="detail-label">کافئین</div>
                <div>{toPersianDigits(p.caffeineMg)} میلی‌گرم</div>
              </div>
            )}
            {p.allergens && (
              <div className="detail-item">
                <div className="detail-label">آلرژن‌ها</div>
                <div>{p.allergens}</div>
              </div>
            )}
          </div>
        )}

        {/* Coffee details */}
        {isCoffee && (
          <div className="detail-grid">
            {p.coffee_details!.origin && (
              <div className="detail-item">
                <div className="detail-label">خاستگاه</div>
                <div>{p.coffee_details!.origin}</div>
              </div>
            )}
            {p.coffee_details!.farm && (
              <div className="detail-item">
                <div className="detail-label">مزرعه</div>
                <div>{p.coffee_details!.farm}</div>
              </div>
            )}
            {p.coffee_details!.altitude && (
              <div className="detail-item">
                <div className="detail-label">ارتفاع</div>
                <div>{p.coffee_details!.altitude}</div>
              </div>
            )}
            {p.coffee_details!.processing && (
              <div className="detail-item">
                <div className="detail-label">فرآوری</div>
                <div>{p.coffee_details!.processing}</div>
              </div>
            )}
            {p.coffee_details!.roastLevel && (
              <div className="detail-item">
                <div className="detail-label">برشته‌کاری</div>
                <div>{p.coffee_details!.roastLevel}</div>
              </div>
            )}
            {p.coffee_details!.flavorNotes && (
              <div className="detail-item">
                <div className="detail-label">نتایج طعمی</div>
                <div>{p.coffee_details!.flavorNotes}</div>
              </div>
            )}
            {p.coffee_details!.recommendedBrew && (
              <div className="detail-item">
                <div className="detail-label">روش دم</div>
                <div>{p.coffee_details!.recommendedBrew}</div>
              </div>
            )}
          </div>
        )}

        {p.coffee_details!.brewGuide && (
          <div style={{ marginTop: 12, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
            <div className="detail-label" style={{ marginBottom: 4 }}>
              راهنمای دم‌آوری
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>{p.coffee_details!.brewGuide}</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `menu-app/src/pages/FeaturedPage.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

interface ProductsResponse {
  products: Array<{
    id: number;
    name: string;
    description?: string | null;
    price?: number | null;
    unit: string;
    imageUrl?: string | null;
    featured?: boolean;
    isSeasonal?: boolean;
    stock?: number;
    priceOnRequest?: boolean;
  }>;
}

export default function FeaturedPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.featured,
    queryFn: () => apiFetch<ProductsResponse>('/products/featured'),
  });

  if (isLoading) return <Spinner />;
  if (!data?.products?.length) return <EmptyState message="محصول ویژه‌ای نیست" />;

  return (
    <div>
      <Link to="/" className="back-link">
        ← بازگشت
      </Link>
      <h2 className="section-title">⭐ محصولات ویژه</h2>
      {data.products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `menu-app/src/pages/SeasonalPage.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

interface ProductsResponse {
  products: Array<{
    id: number;
    name: string;
    description?: string | null;
    price?: number | null;
    unit: string;
    imageUrl?: string | null;
    featured?: boolean;
    isSeasonal?: boolean;
    stock?: number;
    priceOnRequest?: boolean;
  }>;
}

export default function SeasonalPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.seasonal,
    queryFn: () => apiFetch<ProductsResponse>('/products/seasonal'),
  });

  if (isLoading) return <Spinner />;
  if (!data?.products?.length) return <EmptyState message="محصول فصلی نیست" />;

  return (
    <div>
      <Link to="/" className="back-link">
        ← بازگشت
      </Link>
      <h2 className="section-title">🌿 محصولات فصلی</h2>
      {data.products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Create `menu-app/src/pages/BranchesPage.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import BranchInfo from '../components/BranchInfo';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

interface Branch {
  id: number;
  name: string;
  address: string;
  phone?: string | null;
  location?: string | null;
  openingHours?: string | null;
}

interface BranchesResponse {
  branches: Branch[];
}

export default function BranchesPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiFetch<BranchesResponse>('/branches'),
  });

  if (isLoading) return <Spinner />;
  if (!data?.branches?.length) return <EmptyState message="شعبه‌ای فعال نیست" />;

  return (
    <div>
      <Link to="/" className="back-link">
        ← بازگشت
      </Link>
      <h2 className="section-title">📍 شعب ازادی کافه</h2>
      {data.branches.map((branch) => (
        <BranchInfo key={branch.id} branch={branch} />
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Create `menu-app/src/pages/FaqPage.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

interface Faq {
  id: number;
  question: string;
  answer: string;
}

interface FaqResponse {
  faqs: Faq[];
}

export default function FaqPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.faq,
    queryFn: () => apiFetch<FaqResponse>('/faq'),
  });

  if (isLoading) return <Spinner />;
  if (!data?.faqs?.length) return <EmptyState message="سوالی ثبت نشده" />;

  return (
    <div>
      <Link to="/" className="back-link">
        ← بازگشت
      </Link>
      <h2 className="section-title">❓ سوالات متداول</h2>
      {data.faqs.map((faq) => (
        <div key={faq.id} className="faq-item">
          <div className="faq-question">{faq.question}</div>
          <div className="faq-answer">{faq.answer}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Verify full build**

```bash
cd menu-app && npm run typecheck && npm run build
```

Expected: Clean typecheck, successful build with dist/ output.

- [ ] **Step 9: Commit**

```bash
git add menu-app/src/pages/
git commit -m "feat: add menu-app pages (Home, Category, Product, Featured, Seasonal, Branches, FAQ)

- HomePage: section navigation with category grid
- CategoryPage: products filtered by category
- ProductPage: full detail with coffee details, nutritional info, brew guide
- FeaturedPage: featured products list
- SeasonalPage: seasonal products list
- BranchesPage: active branches with info
- FaqPage: FAQ list"
```

---

### Task 5: CI Pipeline

**Files:**

- Modify: `.github/workflows/deploy.yml`

**Interfaces:**

- Consumes: menu-app/ directory from Task 2-4
- Produces: CI job that builds and deploys menu-app to Cloudflare Pages

- [ ] **Step 1: Add `deploy-menu-app` job to `.github/workflows/deploy.yml`**

Append after the `deploy-admin-app` job:

```yaml
deploy-menu-app:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  concurrency:
    group: ${{ github.workflow }}-menu-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

    - name: Setup Node.js
      uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
      with:
        node-version: '22'
        cache: 'npm'
        cache-dependency-path: menu-app/package-lock.json

    - name: Install menu-app dependencies
      working-directory: menu-app
      run: npm ci

    - name: Typecheck menu-app
      working-directory: menu-app
      run: npm run typecheck

    - name: Lint menu-app (non-blocking)
      working-directory: menu-app
      continue-on-error: true
      run: npm run lint

    - name: Build menu-app
      working-directory: menu-app
      run: npm run build

    - name: Deploy menu-app to Cloudflare Pages
      if: github.event_name == 'push' && github.ref == 'refs/heads/main'
      uses: cloudflare/wrangler-action@392082e81ffbcb9ebdde27400634aa004b35ea37 # v3.14.0
      env:
        NPM_CONFIG_LEGACY_PEER_DEPS: 'true'
      with:
        apiToken: ${{ secrets.CF_API_TOKEN }}
        command: pages deploy menu-app/dist --project-name=azadi-menu
```

- [ ] **Step 2: Verify workflow syntax**

```bash
cat .github/workflows/deploy.yml | head -120
```

Expected: Valid YAML with 3 jobs.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add deploy-menu-app job for Cloudflare Pages

- Installs, typechecks, lints (non-blocking), builds menu-app
- Deploys to azadi-menu.pages.dev on push to main
- Same concurrency pattern as deploy-admin-app"
```

---

### Task 6: Final Verification

**Files:**

- No new files (verification only)

**Interfaces:**

- Consumes: All tasks complete
- Produces: Verified build, clean typecheck, no regressions

- [ ] **Step 1: Run full Worker test suite**

```bash
npm test
```

Expected: All existing tests pass (150+).

- [ ] **Step 2: Run Worker typecheck**

```bash
npm run typecheck
```

Expected: Clean.

- [ ] **Step 3: Run menu-app full check**

```bash
cd menu-app && npm run check
```

Expected: Clean typecheck, lint (non-blocking), format check.

- [ ] **Step 4: Build menu-app**

```bash
cd menu-app && npm run build
```

Expected: Successful build with `dist/` output.

- [ ] **Step 5: Verify CI workflow is valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
```

Expected: No error.

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix: final verification adjustments"
```
