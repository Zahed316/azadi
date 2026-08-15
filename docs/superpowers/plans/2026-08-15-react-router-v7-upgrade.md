# react-router v7 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade react-router-dom from v6.30.4 to v7.18.2 in both apps, fixing the known open-redirect and arbitrary-constructor-injection vulnerabilities.

**Architecture:** Replace `react-router-dom` with `react-router` (v7 merges the two packages). All declarative APIs (BrowserRouter, HashRouter, Routes, Route, Link, NavLink, Navigate, useNavigate, useParams, useLocation, useSearchParams) are preserved in v7 with identical signatures. No routing pattern changes required — both apps stay in declarative mode.

**Tech Stack:** react-router v7.18.2, React 18 (unchanged), Vite 6

## Global Constraints

- React stays at ^18.2.0 — react-router-dom@7.18.2 has peer dep `react >=18`
- Do NOT upgrade to `react-router` latest (7.18.2 bare) which requires React 19 — use `react-router-dom@7.18.2` (thin wrapper, peer dep React >=18)
- Both apps must pass typecheck + lint + format:check + test + build after upgrade
- One branch, one commit per logical grouping

---

## File Structure

### admin-app (2 files change imports)

| File                                      | Current Import                                                         | New Import     |
| ----------------------------------------- | ---------------------------------------------------------------------- | -------------- |
| `admin-app/src/App.tsx:2`                 | `HashRouter, Routes, Route, NavLink, Navigate` from `react-router-dom` | `react-router` |
| `admin-app/src/pages/InventoryPage.tsx:2` | `useSearchParams` from `react-router-dom`                              | `react-router` |

### menu-app (10 files change imports)

| File                                     | Current Import                                                   | New Import     |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------- |
| `menu-app/src/App.tsx:2`                 | `BrowserRouter, Routes, Route, Navigate` from `react-router-dom` | `react-router` |
| `menu-app/src/components/Header.tsx:1`   | `Link, useLocation` from `react-router-dom`                      | `react-router` |
| `menu-app/src/components/Footer.tsx:1`   | `Link` from `react-router-dom`                                   | `react-router` |
| `menu-app/src/components/ProductRow.tsx` | `Link` from `react-router-dom`                                   | `react-router` |
| `menu-app/src/pages/HomePage.tsx`        | `Link` from `react-router-dom`                                   | `react-router` |
| `menu-app/src/pages/CategoryPage.tsx`    | `useParams, Link, useNavigate` from `react-router-dom`           | `react-router` |
| `menu-app/src/pages/ProductPage.tsx`     | `useParams, Link` from `react-router-dom`                        | `react-router` |
| `menu-app/src/pages/FeaturedPage.tsx`    | `Link, useNavigate` from `react-router-dom`                      | `react-router` |
| `menu-app/src/pages/SeasonalPage.tsx`    | `Link, useNavigate` from `react-router-dom`                      | `react-router` |
| `menu-app/src/pages/BranchesPage.tsx`    | `Link` from `react-router-dom`                                   | `react-router` |
| `menu-app/src/pages/FaqPage.tsx`         | `Link` from `react-router-dom`                                   | `react-router` |

### Config files

| File                       | Change                                                |
| -------------------------- | ----------------------------------------------------- |
| `admin-app/package.json`   | Remove `react-router-dom`, add `react-router@^7.18.2` |
| `admin-app/vite.config.ts` | Update manualChunks `vendor` array                    |
| `menu-app/package.json`    | Remove `react-router-dom`, add `react-router@^7.18.2` |

---

## Task 1: Upgrade admin-app

**Files:**

- Modify: `admin-app/package.json`
- Modify: `admin-app/src/App.tsx:2`
- Modify: `admin-app/src/pages/InventoryPage.tsx:2`
- Modify: `admin-app/vite.config.ts:11`

**Interfaces:**

- Consumes: nothing (first task)
- Produces: admin-app builds and tests pass with react-router v7

- [ ] **Step 1: Install react-router v7, remove react-router-dom**

```bash
cd admin-app
npm install react-router@^7.18.2
npm uninstall react-router-dom
```

- [ ] **Step 2: Update imports in App.tsx**

Change line 2 of `admin-app/src/App.tsx`:

```diff
- import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
+ import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router';
```

- [ ] **Step 3: Update imports in InventoryPage.tsx**

Change the import line of `admin-app/src/pages/InventoryPage.tsx`:

```diff
- import { useSearchParams } from 'react-router-dom';
+ import { useSearchParams } from 'react-router';
```

- [ ] **Step 4: Update vite.config.ts manualChunks**

Change line 11 of `admin-app/vite.config.ts`:

```diff
- vendor: ['react', 'react-dom', 'react-router-dom'],
+ vendor: ['react', 'react-dom', 'react-router'],
```

- [ ] **Step 5: Run admin-app checks**

```bash
cd admin-app
npm run check
```

Expected: typecheck passes, lint passes, format passes, all 47 tests pass.

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: build succeeds, `dist/assets/vendor-*.js` chunk contains react-router.

- [ ] **Step 7: Commit**

```bash
cd ..
git add admin-app/
git commit -m "fix(admin-app): upgrade react-router-dom v6 → react-router v7.18.2

Fixes GHSA-wrjc-x8rr-h8h6 (open redirect) and GHSA-337j-9hxr-rhxg
(arbitrary constructor injection during SSR hydration). Declarative
routing APIs unchanged — drop-in replacement.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Upgrade menu-app

**Files:**

- Modify: `menu-app/package.json`
- Modify: `menu-app/src/App.tsx:2`
- Modify: `menu-app/src/components/Header.tsx:1`
- Modify: `menu-app/src/components/Footer.tsx:1`
- Modify: `menu-app/src/components/ProductRow.tsx` (import line)
- Modify: `menu-app/src/pages/HomePage.tsx` (import line)
- Modify: `menu-app/src/pages/CategoryPage.tsx` (import line)
- Modify: `menu-app/src/pages/ProductPage.tsx` (import line)
- Modify: `menu-app/src/pages/FeaturedPage.tsx` (import line)
- Modify: `menu-app/src/pages/SeasonalPage.tsx` (import line)
- Modify: `menu-app/src/pages/BranchesPage.tsx` (import line)
- Modify: `menu-app/src/pages/FaqPage.tsx` (import line)

**Interfaces:**

- Consumes: nothing (independent of Task 1)
- Produces: menu-app builds and tests pass with react-router v7

- [ ] **Step 1: Install react-router v7, remove react-router-dom**

```bash
cd menu-app
npm install react-router@^7.18.2
npm uninstall react-router-dom
```

- [ ] **Step 2: Update all imports**

Replace every `from 'react-router-dom'` with `from 'react-router'` in these 10 files:

```bash
cd menu-app
node -e "
const fs = require('fs');
const path = require('path');
function update(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f === 'node_modules' || f === '.git') continue;
    if (fs.statSync(p).isDirectory()) { update(p); continue; }
    if (!f.endsWith('.ts') && !f.endsWith('.tsx')) continue;
    let c = fs.readFileSync(p, 'utf8');
    if (c.includes(\"'react-router-dom'\")) {
      c = c.replaceAll(\"'react-router-dom'\", \"'react-router'\");
      fs.writeFileSync(p, c);
      console.log('updated:', p);
    }
  }
}
update('src');
"
```

- [ ] **Step 3: Run menu-app checks**

```bash
npm run check
```

Expected: typecheck passes, lint passes, format passes, all 13 tests pass.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
cd ..
git add menu-app/
git commit -m "fix(menu-app): upgrade react-router-dom v6 → react-router v7.18.2

Fixes GHSA-wrjc-x8rr-h8h6 (open redirect) and GHSA-337j-9hxr-rhxg
(arbitrary constructor injection during SSR hydration). Declarative
routing APIs unchanged — drop-in replacement.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Final verification

- [ ] **Step 1: Run root checks**

```bash
npm run check
```

Expected: 249 tests pass, typecheck/lint/format clean.

- [ ] **Step 2: Run npm audit in all three directories**

```bash
npm audit                    # root
cd admin-app && npm audit    # admin-app
cd ../menu-app && npm audit  # menu-app
```

Expected: react-router vulnerabilities no longer appear. Record remaining counts.

- [ ] **Step 3: Merge to main**

```bash
git checkout main
git merge fix/router-v7-upgrade --no-ff -m "Merge fix/router-v7-upgrade into main"
git branch -d fix/router-v7-upgrade
```

---

## Risk Assessment

- **Low risk:** The upgrade is a drop-in replacement. react-router v7 preserves all v6 declarative APIs with identical signatures.
- **No routing pattern changes:** Both apps stay in declarative mode (BrowserRouter/HashRouter + Routes/Route). No need to adopt createBrowserRouter or data loaders.
- **React 18 compatible:** react-router-dom@7.18.2 has peer dep `react >=18`. No React upgrade needed.
- **Vulnerability fix confirmed:** The advisory range is `6.0.0 - 7.17.0`. Version 7.18.2 is outside this range.
