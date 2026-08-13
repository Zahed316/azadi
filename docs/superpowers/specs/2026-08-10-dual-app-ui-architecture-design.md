# Dual-App UI Architecture Design

> **Date:** 2026-08-10
> **Status:** Approved
> **Decisions finalized via:** collaborative brainstorming (6 questions)

## Overview

Azadi Coffee Roastery runs two Cloudflare-deployed web apps alongside a Telegram bot. This design defines the architecture for:

1. **Admin Mini App** (existing) — standardize and optimize the current management interface
2. **Menu Website** (new) — a public-facing, read-only menu site for customers

Both apps share the same Worker backend but differ in auth, data access, and UI complexity.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Network                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐          ┌──────────────────────────┐ │
│  │  Admin Mini App   │          │    Menu Website           │ │
│  │  azadi-admin.     │          │    azadi-menu.            │ │
│  │  pages.dev        │          │    pages.dev              │ │
│  │                   │          │                           │ │
│  │  React 18 + Vite  │          │  React 18 + Vite          │ │
│  │  HashRouter       │          │  HashRouter               │ │
│  │  react-query v5   │          │  react-query v5           │ │
│  │  @telegram-apps/  │          │  (no telegram SDK)        │ │
│  │  sdk              │          │                           │ │
│  └────────┬─────────┘          └──────────┬───────────────┘ │
│           │                               │                  │
│           │  Authorization: Telegram      │  No auth         │
│           ▼                               ▼                  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Worker: azadi-coffee-bot.                               │ │
│  │           zahedrastgar316.workers.dev                    │ │
│  │                                                          │ │
│  │  /api/*          → Admin API (auth required)            │ │
│  │  /api/public/*   → Menu API (no auth, filtered)        │ │
│  │  /webhook        → Telegram bot webhook                 │ │
│  └──────────────────────────┬──────────────────────────────┘ │
│                             │                                │
│                    ┌────────┴────────┐                       │
│                    │    D1 (azadi-db)│                       │
│                    │    KV (CACHE)   │                       │
│                    └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Decision Record

| #   | Decision         | Choice                                          | Rationale                                                                                                      |
| --- | ---------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Menu data access | Public API endpoints                            | Menu data is public by nature; no PII. Live data avoids staleness. `DataService` already implements filtering. |
| 2   | Repo structure   | Sibling Vite app (`menu-app/`)                  | Mirrors existing `admin-app/` pattern. Independent builds, no workspace linker overhead.                       |
| 3   | Deployment       | Separate Pages project (`azadi-menu.pages.dev`) | Cloudflare Pages doesn't support path-based routing across projects. Isolated deploys.                         |
| 4   | Routing          | HashRouter                                      | Works in Telegram in-app browser, direct links, shared URLs. Consistent with admin app.                        |
| 5   | Data freshness   | React Query with `staleTime: 60_000`            | 1-minute stale window. Instant re-navigation from cache, background refetch for freshness.                     |
| 6   | Shared code      | Copy & adapt                                    | Zero coupling between apps. Some duplication (~6 components, CSS tokens) is acceptable for independence.       |

## Component Comparison

| Aspect            | Admin App                                  | Menu Website                                  |
| ----------------- | ------------------------------------------ | --------------------------------------------- |
| **Auth**          | Telegram Mini App `initData`               | None (public)                                 |
| **API base**      | `/api/*` (auth-gated)                      | `/api/public/*` (open)                        |
| **State**         | AppContext (user role, toast, confirm)     | Minimal — just menu data via react-query      |
| **Mutations**     | CRUD on products, categories, etc.         | Read-only (no mutations)                      |
| **UI complexity** | Forms, tables, drag-reorder                | Product cards, category browsing, branch info |
| **Routing depth** | 5 top-level tabs, nested pages             | Flat — sections → category → products         |
| **Caching**       | react-query (staleTime: Infinity for user) | react-query (staleTime: 60s for menu data)    |

## Public API Design

### New Routes (no auth required)

All public routes are prefixed with `/api/public/` and filter to visible/available/active data only.

| Endpoint                            | Method | Response                                              | Notes                                             |
| ----------------------------------- | ------ | ----------------------------------------------------- | ------------------------------------------------- |
| `GET /api/public/menu`              | GET    | `{ sections: { [sectionName]: MenuSectionEntry[] } }` | Visible menuConfig entries grouped by section     |
| `GET /api/public/products`          | GET    | `{ products: ProductWithDetails[] }`                  | Available products with coffee_details + category |
| `GET /api/public/products/:id`      | GET    | `{ product: ProductWithDetails }`                     | Single product with full details                  |
| `GET /api/public/products/featured` | GET    | `{ products: ProductWithDetails[] }`                  | Featured + available products                     |
| `GET /api/public/products/seasonal` | GET    | `{ products: ProductWithDetails[] }`                  | Seasonal + available products                     |
| `GET /api/public/categories`        | GET    | `{ categories: Category[] }`                          | All categories (sorted)                           |
| `GET /api/public/branches`          | GET    | `{ branches: Branch[] }`                              | Active branches only                              |
| `GET /api/public/faq`               | GET    | `{ faqs: Faq[] }`                                     | All FAQ items                                     |
| `GET /api/public/settings`          | GET    | `{ settings: { [key]: string } }`                     | Filtered settings (about, price_unit, instagram)  |

### Filtering Rules

- **Products:** `available = true` only. `stock` is shown for `item` units, hidden for `cup` units.
- **Menu Config:** `isVisible = true` only. Entries ordered by `displayOrder`.
- **Branches:** `isActive = true` only.
- **Settings:** Only whitelisted keys: `about`, `price_unit`, `instagram`.

### Implementation Approach

New file: `src/api/public.ts` — a single function `handlePublicApiRequest()` that mirrors the structure of `handleApiRequest()` but skips auth validation. Called from `src/index.ts` before the auth-gated `handleApiRequest()`.

```typescript
// src/index.ts (conceptual)
if (url.pathname.startsWith('/api/public/')) {
  return handlePublicApiRequest(request, env, ctx);
}
return handleApiRequest(request, env, ctx);
```

## Menu Website Structure

### Directory Layout

```
menu-app/
  src/
    api/
      client.ts          # fetch wrapper (no auth header)
      keys.ts            # query key constants
    components/
      EmptyState.tsx      # copied from admin-app
      Spinner.tsx         # copied from admin-app
      Toast.tsx           # copied from admin-app
      ProductCard.tsx     # NEW — product display card
      CategoryGrid.tsx    # NEW — category navigation
      BranchInfo.tsx      # NEW — branch hours/location
      Header.tsx          # NEW — site header with logo
    pages/
      HomePage.tsx        # Section navigation (drinks, beans, cakes, extras)
      CategoryPage.tsx    # Products in a category
      ProductPage.tsx     # Single product detail
      FeaturedPage.tsx    # Featured products
      SeasonalPage.tsx    # Seasonal products
      BranchesPage.tsx    # Active branches
      FaqPage.tsx         # FAQ list
    utils/
      numbers.ts          # toPersianDigits, formatPersianPrice
    App.tsx
    index.css
    main.tsx
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  eslint.config.mjs
```

### Dependencies (package.json)

```json
{
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
    "prettier": "^3.9.6",
    "typescript": "^5.2.2",
    "vite": "^6.0.0"
  }
}
```

No `@telegram-apps/sdk` — this is a public site, not a Mini App.

### API Client (no auth)

```typescript
// menu-app/src/api/client.ts
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

### Routing (HashRouter)

```typescript
// menu-app/src/App.tsx (conceptual)
<HashRouter>
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
</HashRouter>
```

### React Query Configuration

```typescript
// menu-app/src/App.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      gcTime: 5 * 60_000, // 5 minutes (was cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

### Visual Design

- **RTL layout** (`dir="rtl"` on `<html>`) — consistent with bot and admin app
- **Persian text** for all menu content, product names, categories
- **Product images** via `replyWithPhoto(url)` pattern — `imageUrl` field from products
- **Mobile-first** responsive design — most users will open from Telegram
- **Minimal chrome** — the menu is the hero, not the UI framework

## Deployment Pipeline

### CI Workflow Changes

Add a third job to `.github/workflows/deploy.yml`:

```yaml
deploy-menu-app:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  concurrency:
    group: ${{ github.workflow }}-menu-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
    - name: Setup Node.js
      uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af
      with:
        node-version: '22'
        cache: 'npm'
        cache-dependency-path: menu-app/package-lock.json
    - name: Install dependencies
      working-directory: menu-app
      run: npm ci
    - name: Typecheck
      working-directory: menu-app
      run: npm run typecheck
    - name: Lint (non-blocking)
      working-directory: menu-app
      continue-on-error: true
      run: npm run lint
    - name: Build
      working-directory: menu-app
      run: npm run build
    - name: Deploy to Cloudflare Pages
      if: github.event_name == 'push' && github.ref == 'refs/heads/main'
      uses: cloudflare/wrangler-action@392082e81ffbcb9ebdde27400634aa004b35ea37
      env:
        NPM_CONFIG_LEGACY_PEER_DEPS: 'true'
      with:
        apiToken: ${{ secrets.CF_API_TOKEN }}
        command: pages deploy menu-app/dist --project-name=azadi-menu
```

### CORS Update

`src/api/router.ts` — add the new Pages domain:

```typescript
const ALLOWED_ORIGINS = [
  'https://azadi-admin.pages.dev',
  'https://azadi-menu.pages.dev',
  'https://web.telegram.org',
];
```

## Scope Boundaries

### In Scope

- Public API endpoints (`/api/public/*`) with read-only data
- `menu-app/` directory with Vite + React + HashRouter
- Product browsing (list, detail, featured, seasonal)
- Category navigation
- Branch info display
- FAQ display
- React Query caching (60s staleTime)
- CI deployment to `azadi-menu.pages.dev`
- CORS update for new domain

### Out of Scope (Future)

- Admin App UI optimization (separate effort)
- Shared component library / workspace package
- SSR or ISR for the Menu Website
- PWA / offline support
- Custom domain setup (managed via Cloudflare dashboard)
- Search functionality (deferred to v2)
- Favorites / user-specific features on the Menu Website
- Price calculation or ordering (read-only menu display)

## Risks & Mitigations

| Risk                                  | Impact | Mitigation                                                                                  |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Public API adds Worker load           | Medium | KV caching at Worker level (already wired). 60s client staleTime reduces refetch frequency. |
| Menu data staleness after admin edits | Low    | React Query refetches every 60s. Admin can force refresh via browser.                       |
| CORS mismatch if domain changes       | Low    | Single source of truth in `ALLOWED_ORIGINS` array. CI validates.                            |
| Component drift (copied code)         | Low    | Acceptable tradeoff for independence. Only ~6 simple components.                            |
| Telegram in-app browser quirks        | Medium | HashRouter avoids most issues. Test on iOS + Android Telegram.                              |
