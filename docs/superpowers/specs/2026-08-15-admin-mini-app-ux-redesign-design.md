# Admin Mini App — UI/UX Redesign (Final, decisions locked)

**Date:** 2026-08-15
**Status:** Final — decisions locked 2026-08-15
**Author:** Zahed + Claude
**Companion spec:** `2026-08-14-ai-admin-design.md` (AI chat + merged Inventory tab; ships this work)
**Source:** Drafted as `2026-08-15-admin-mini-app-ux-redesign-v2.md` (verified against `github.com/Zahed316/azadi` source)

> **Reading order:** This document is a forward-looking design exploration. The AI admin work in `2026-08-14-ai-admin-design.md` has already shipped the merged `/inventory` tab and the floating chat panel. This spec addresses everything that spec did NOT touch: role separation, per-branch mechanics, Telegram-native affordances, visual system, and the operational barista experience.

---

## Decisions Locked (2026-08-15)

All six open questions from the v2 draft are resolved. These are the binding constraints for the implementation phases (§9):

| # | Decision | Choice | Implication |
|---|---|---|---|
| 1 | Per-branch stock model | **Path A** — duplicate menu per branch | No schema migration. Phase 6 ships only a "Clone to other branch" UI action. Path B deferred to a separate spec if ever needed. |
| 2 | Chat panel accessibility | **Both roles** | Removes `ChatButton.tsx:14` `if (!isSuperAdmin) return null` gate. Backend already enforces role guards. Category admins land on `/counter` with the chat tab visible. |
| 3 | Counter screen scope | **`category_admin` only** | Super admin still lands on `/inventory?tab=categories`. Routing keyed by exact role value, not "is non-super-admin". Easy to extend when a third role appears. |
| 4 | Branch context persistence | **Local state, reset to 'all' each session** | Selected branch is `useState` in `<BranchSelector>`. No `localStorage`, no API persistence. One tap to pick a branch; no yesterday's branch leaking into today's shift. |
| 5 | Configure + Info consolidation | **Merge into one `تنظیمات` tab** | Trims super_admin nav to 3 tabs: `موجودی` / `آمار` / `تنظیمات` + chat. Sub-tabs: `عمومی` (Settings + MenuConfig) / `محتوا` (FAQ + AboutUs) / `مدیریت` (Admins + Messages). Phase 6 work. |
| 6 | Font loading | **CDN (Vazirmatn + Geist via jsDelivr)** | One CSS line; Telegram WebView caches across launches. ~80KB first load. No runtime dependency risk that isn't already present (the WebView already requires Telegram to be online). |

**Global impact:** Phase 6 is now ~1–2 days (Path A clone UI + empty states + motion polish) instead of the 3–5 days the v2 draft estimated for Path B.

---

## 1. Problem Statement

The current `admin-app/` is functionally complete but feels heavy for daily operational use. Three concrete pain points:

1. **One bottom nav serves two very different users.** `super_admin` sees 4 tabs (موجودی / آمار / تنظیمات / اطلاعات). `category_admin` sees 1 tab (موجودی). Confirmed in `App.tsx`: the nav renders exactly this split via `{isSuperAdmin && (...)}`. The roles are not just permission tiers — they have different *cadence* and *intent*. The current UI forces both through the same surface.
2. **The inventory editor is one massive page.** `admin-app/src/components/ProductsSubTab.tsx` is 504 lines — a single file containing the category picker, batch selector, edit form, list rendering, and four mutations (`saveProductMutation`, `deleteProductMutation`, `toggleProductField`, `batchMutation`). Baristas coming in for "I ran out of croissants" have to scroll past the entire form chrome to get to a stock number.
3. **Telegram-native affordances are not used.** `main.tsx` calls `init()` from `@telegram-apps/sdk` but nothing reads theme params, no `mainButton`, no `backButton`, no `hapticFeedback`. The app feels like a generic web page stuffed into a WebView instead of a Mini App.

The data model is a *major* constraint that shapes everything: see [§3 Per-branch inventory mechanics](#3-per-branch-inventory-mechanics). Confirmed directly against `admin-app/src/api/types.ts`: products are scoped to a single branch (`Product.branchId: number | null`) with a single `stock: number` field — NOT a per-branch stock matrix. The redesign accommodates today's model (Path A) without painting itself into a corner for a future migration.

---

## 2. Recommended Direction

**Direction A — "One app, two home screens."** The barista and the owner share one codebase, one Mini App URL, one deploy, but they open to fundamentally different experiences.

### 2.1 Why not two separate Mini Apps?

A reasonable alternative is to maintain two separate Telegram Mini Apps (`azadi-admin.pages.dev` for owner, `azadi-counter.pages.dev` for baristas). Rejected for four reasons:

| Concern | Two-app cost | One-app cost |
|---|---|---|
| Auth / admin lookup | Each app has to validate initData and look up role independently | Already happens once via `/api/currentUser` |
| Shared components | Duplicate the chat panel, theme, batch ops, error boundary | Single source |
| Deploy surface | Two Pages projects, two CI jobs, two URLs to keep in sync | Already there |
| Branching logic | Drift between two codebases is inevitable | Role logic lives in one place |

The cost of two apps is real for a two-branch shop with two roles. Direction A keeps that surface tiny.

### 2.2 Why not "one app with a mode switcher"?

The alternative is a single home screen with a toggle between "Barista view" / "Owner view." Rejected because (a) every accidental toggle would be a context-loss event, (b) the barista UX is so different it would be confusing to put them in the same room, and (c) Telegram already gives us `role` in the auth response (`admin-app/src/api/types.ts`, `CurrentUser.role: string`) — we should use that as the determinant and never let the user override it.

### 2.3 The recommended split

| Role | Lands on | Sees in bottom nav | Primary verb |
|---|---|---|---|
| `super_admin` | `/inventory` (categories sub-tab, full editor) | موجودی / آمار / تنظیمات + chat tab | "Manage" |
| `category_admin` | `/counter` (a NEW landing screen — see §4.2) | پیشخوان / موجودی + chat tab | "Toggle" |

The "موجودی" tab on a `category_admin` should land on `/inventory?tab=products` filtered to their `allowedCatId`.

> **⚠️ Verified gap — not currently true.** `InventoryPage.tsx` hardcodes `const initialTab = (searchParams.get('tab') as SubTab) || 'categories'` with no role check. Today, a `category_admin` who opens `/inventory` lands on the **categories** sub-tab (read-only for them) by default, not `products`. This needs an explicit one-line code change — see §7.1 and Phase 1 (§9).

The chat panel is accessible to both roles per the AI's own role guard on `/api/ai/chat` (backend already refuses out-of-scope requests for `category_admin`).

> **⚠️ Verified gap — not currently true.** `ChatButton.tsx` has a hard client-side gate: `if (!isSuperAdmin) return null;` (line 14). The chat FAB is invisible to `category_admin` today regardless of what the backend allows. Making the chat reachable by both roles requires removing/relaxing this check — see §7.1 and Phase 4 (§9). **Per Decision #2, this change is in scope.**

---

## 3. Per-branch Inventory Mechanics

### 3.1 Today's data model (confirmed against source)

```typescript
// admin-app/src/api/types.ts (verbatim, lines 12–29)
export interface Product {
  id: number;
  branchId: number | null;   // null = available at both branches
  categoryId: number;
  name: string;
  description: string | null;
  price: number | null;
  stock: number;             // SINGLE number, not per-branch
  unit: string;
  imageUrl: string | null;
  available: boolean | null;
  featured: boolean | null;
  priceOnRequest: boolean | null;
  isSeasonal: boolean | null;
  sizeOptions: string | null;
  syrupOptions: string | null;
  calories: number | null;
  allergens: string | null;
  caffeineMg: number | null;
  createdAt: string;
  updatedAt: string;
}
```

The schema treats products as either belonging to branch A, branch B, or both (when `branchId IS NULL`). `src/api/resources/products.ts` confirms the backend has two distinct stock/availability write paths — `PUT /products/:id/stock` (`repo.updateStock`) and `PUT /products/:id/toggle` (`repo.toggleAvailability`) — both updating a single row, not a per-branch matrix. **A given product does not currently have two different stock counts at the two branches.**

### 3.2 Path A is the design path (per Decision #1)

Many small F&B businesses duplicate their menu per branch (cold brew at branch A has its own row, cold brew at branch B has its own row, distinct names if needed). The redesign makes this workflow obvious: a "branch" picker on the product create form, a branch badge on every product card, and a "Clone to other branch" action. **No schema change needed.**

> **Path B (true per-branch stock matrix)** is out of scope for this spec. If a future migration is needed, the rename pattern would be: add `product_stocks(product_id, branch_id, quantity, available)`, dual-write stock changes there from `PUT /products/:id/stock`, keep `products.stock` as derived for legacy callers. **Do not pre-design for this** — defer to a separate spec.

### 3.3 UI patterns that work for both paths

The proposed product card design is the same regardless of which model is in use:

```
┌─────────────────────────────────────────────────┐
│  [img]  اسپرسو دابل                  ۱۰۵,۰۰۰  │
│         ⭐ پیشنهاد ویژه                         │
│  [ شعبه ۱ ] [ شعبه ۲ ]      موجودی: ۱۲  [ ⚙ ] │
└─────────────────────────────────────────────────┘
```

The two branch pills always show. Tapping a pill toggles `available` at that branch (Path A: toggles on the product, applies to that branch only via `branchId` matching). The stock number in the middle is editable inline on tap (see §5.3).

If a product has `branchId = NULL`, both pills render with a "both" indicator (a small `↔` icon between them) to communicate that this is a shared product. If `branchId` is set to one specific branch, the other pill renders muted with a "+" affordance for "Clone to this branch."

### 3.4 Branch context selector (a persistent header element)

For the barista experience especially, the app should know "which branch am I at right now?" A sticky pill at the top of `Counter` and `Inventory` screens:

```
┌──────────────────────────┐
│  📍 شعبه ۱  ▾           │
└──────────────────────────┘
```

Tapping opens a sheet with two branch rows (`Branch` type confirmed in `types.ts`: `id`, `name`, `address`, `phone`, `location`, `openingHours`, `isActive`) + an "همه" option. The selection is local state per Decision #4 — not persisted, not stored.

For the inventory editor (owner), the branch selector doubles as a filter: "show me only products at branch 1." Combined with the category chip picker, you can drill from "all branches / all categories" to "branch 1 / pastries only" in two taps.

---

## 4. Screen-by-Screen Design

### 4.1 `super_admin` lands on `/inventory?tab=categories` (existing, refined)

The `/inventory` page already exists (per the 2026-08-14 spec) as `InventoryPage.tsx`, a 61-line sub-tab switcher over `CategoriesSubTab` and `ProductsSubTab`. The redesign refines it:

- **Add a branch selector** above the category chips (Path A model).
- **Move the "+ افزودن دسته" CTA out of the form** into a sticky pill at the top-right of the sub-tab switcher. The form stays at the top of the list, but the primary action is reachable without scrolling.
- **Sub-tab labels lose the emoji prefix** — today they're literally `🏷️ دسته‌بندی‌ها` / `📦 محصولات` (confirmed, `InventoryPage.tsx`); the new design uses Phosphor-style inline SVG icons (`tag` / `package`) inside the pill itself, not as a label prefix.
- **Empty state for "no products in this category yet"** gets a custom illustration (see §7.5) and a single CTA — no more "افزودن اولین محصول" link that scrolls to nowhere.
- **Fix the role-aware default tab** (see the verified gap in §2.3): `initialTab` must consider `isSuperAdmin`, not just the `tab` query param.

### 4.2 NEW: `/counter` for `category_admin`

The barista's home. One screen, optimized for two-handed phone use behind a counter.

```
┌─────────────────────────────────────┐
│  📍 شعبه ۱                    ▾   │  ← branch picker
├─────────────────────────────────────┤
│  🔍 جستجوی محصول...                │  ← search, opens overlay
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │  ⭐ امروز پرفروش              │  │  ← horizontal scroll pills
│  │  ┌─────┐ ┌─────┐ ┌─────┐       │  │     (top 5 by favorites)
│  │  │کروسان│ │لاته │ │موکا │ ...   │  │
│  │  └─────┘ └─────┘ └─────┘       │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  دسته‌بندی                          │  ← category accordion
│  ☕ قهوه                            │
│    ┌─────────────────────────────┐  │
│    │ اسپرسو دابل   [●○]   ۱۲  ⚙ │  │
│    │ کاپوچینو      [○●]    ۵  ⚙ │  │
│    │ ...                         │  │
│    └─────────────────────────────┘  │
│  🧁 شیرینی                         │
│    ...                              │
└─────────────────────────────────────┘
```

Key interactions:

- **Tap on `[●○]` toggle** — fires `toggleProductField.mutate({id, field:'available', value})`. This hook already exists in `ProductsSubTab.tsx` (line 162) — it dispatches to `PUT /products/:id/toggle` when `field === 'available'`, generic `PUT /products/:id` otherwise. Extract it into a shared hook (e.g. `useProductMutations.ts`) so `/counter` and `/inventory` both use it. Add optimistic UI + `hapticFeedback.impactOccurred('light')` (see §5.1 for the corrected import).
- **Tap on the stock number** — opens an inline number stepper (no modal). Long-press shows "صفر" (zero) and "نامحدود" (unlimited) quick actions.
- **Tap on `⚙`** — opens a small action sheet (not a full edit drawer) with: "ویرایش" (opens the full form), "تکرار در شعبه دیگر" (clone to other branch), "مخفی کردن" (set `available = false`).
- **Search** — opens a full-screen overlay with a single input and an instant-results list (no debouncing — D1 + KV cache is fast enough). Empty state shows "محصولی با این نام یافت نشد" with a "افزودن" link.

The whole screen is **one card** (no nested cards — too much chrome on a phone). The category accordion sections are dividers, not containers.

### 4.3 `super_admin` product editor (refined, not redesigned)

The existing edit form in `ProductsSubTab.tsx` is fine in shape; the redesign fixes the *trigger*:

- Today: every change opens the form scrolled to top via `window.scrollTo({top: 0, behavior: 'smooth'})` — a jarring jump.
- Tomorrow: changes happen inline on the product card (stock, availability, featured, seasonal). The form is only for full CRUD (name, description, image, price, category, branch, sizes, syrups, nutrition).

This means splitting the current `ProductsSubTab` into two components:

1. `<InventoryList>` — the product card grid. Handles toggles, inline stock editing, branch badge clicks.
2. `<ProductFormDrawer>` — a bottom-sheet drawer that opens on tap of "ویرایش" for full editing. Slides up from the bottom, closes via `backButton.onClick()` (corrected API — see §5.1).

The drawer is full-height on phone (with the chat FAB hidden) and uses Telegram's back button to close instead of an X icon. The form lives behind a sliding `transform: translateY(100%) → translateY(0)` transition.

### 4.4 The Configure / Info consolidation (Decision #5)

Per Decision #5, `ConfigurePage` and `InfoPage` are merged into a single `تنظیمات` tab with sub-tabs `عمومی` (Settings + MenuConfig) / `محتوا` (FAQ + AboutUs) / `مدیریت` (Admins + Messages). The super_admin nav becomes 3 tabs (`موجودی` / `آمار` / `تنظیمات`) + chat.

The sub-tab structure is preserved 1:1 from the existing pages; only the entry point changes. Admins and Messages become low-frequency pages reached via a sub-tab rather than a bottom-nav slot.

---

## 5. Component Patterns

### 5.1 Telegram-native affordances — verified API, corrected from v1

v1 flagged the `@telegram-apps/sdk` v2 surface as unverified. The v2 affordances have been inspected directly. **The affordances all exist, but v2's actual shape differs from v1's pseudocode** — it exports flat objects/signals, not classes:

| Affordance | Real v2 export | When to use | Where NOT to use |
|---|---|---|---|
| `mainButton` (not `MainButton`) | object: `.mount()`, `.setParams()`, `.onClick()`, `.isVisible`, `.state` | Primary CTA on a screen (Save, Add, Confirm). Show progress text during mutations. | Multiple equivalent primary actions. Screens with an existing sticky footer. |
| `backButton` (not `BackButton`) | object: `.mount()`, `.show()`, `.hide()`, `.onClick()`, `.offClick()` | Closes drawers, exits full-screen overlays, leaves `/counter` to `/inventory`. | Top-level route changes inside a tab (use the in-app back arrow instead). |
| `hapticFeedback.impactOccurred('light')` (not `HapticFeedback.impactOccurred`) | object: `.impactOccurred()`, `.notificationOccurred()`, `.selectionChanged()`, `.isSupported()` | Toggles, stock increments, tab switches, success confirmations. | On every render. On loading transitions. |
| `hapticFeedback.notificationOccurred('success'\|'error')` | same object | After save completes. After AI confirms an action. After a destructive action completes. | During typing / search. |
| `hapticFeedback.selectionChanged()` | same object | Switching branch in the picker. Switching category filter. | While just scrolling. |
| `themeParamsState` (signal, not event emitter) | function: call `themeParamsState()` to read; `.sub(cb)` / `.unsub(cb)` to subscribe — **not** `.on('change', cb)` | Use as the BASE for color tokens. Read `bg_color`, `text_color`, `button_color`, `hint_color`, `link_color`, `secondary_bg_color`. | Don't override Telegram's brand colors with your own accent color. |
| Safe-area insets | (CSS `env(safe-area-inset-*)`, no SDK export needed) | Bottom nav, FAB, drawer handle, chat panel bottom. | Don't apply to scrolling content (causes jank). |

Corrected hook:

```typescript
// admin-app/src/hooks/useTelegramTheme.ts
import { themeParamsState, mountThemeParams, bindThemeParamsCssVars } from '@telegram-apps/sdk';
import { useEffect, useState } from 'react';

export function useTelegramTheme() {
  const [theme, setTheme] = useState(themeParamsState());

  useEffect(() => {
    if (!mountThemeParams.isAvailable?.()) return;
    mountThemeParams();
    bindThemeParamsCssVars(); // auto-writes --tg-theme-* CSS vars on <html>, updates on change
    return themeParamsState.sub(() => setTheme(themeParamsState()));
  }, []);

  return theme; // { bg_color, text_color, button_color, ... }
}
```

`bindThemeParamsCssVars()` already does most of the CSS-variable wiring for you — no need to hand-roll it in the hook. `index.css` then just maps `var(--tg-theme-bg-color, ...)` etc. to the app's own token names (see §6.2).

```typescript
// admin-app/src/hooks/useTelegramHaptics.ts
import { hapticFeedback } from '@telegram-apps/sdk';

export function useTelegramHaptics() {
  return {
    tap: () => hapticFeedback.isSupported() && hapticFeedback.impactOccurred('light'),
    success: () => hapticFeedback.isSupported() && hapticFeedback.notificationOccurred('success'),
    error: () => hapticFeedback.isSupported() && hapticFeedback.notificationOccurred('error'),
    select: () => hapticFeedback.isSupported() && hapticFeedback.selectionChanged(),
  };
}
```

Same correction applies to `backButton`/`mainButton` usage in §4.3 and Phase 5 (§9): mount first (`backButton.mount()`), always guard with `isXSupported()`/`isXMounted()` before calling show/hide (older Telegram clients may not support every affordance), then `backButton.onClick(handler)` + `backButton.show()`, and `mainButton.setParams({ text: 'ذخیره', isVisible: true })` + `mainButton.onClick(handler)`.

### 5.2 Double-Bezel cards (the visual signature)

The current `.card` is a single rounded rectangle with backdrop blur and a subtle shadow. The redesign adopts a nested "machined hardware" feel:

```html
<div class="card-shell">
  <div class="card-core">
    <!-- actual content -->
  </div>
</div>
```

```css
.card-shell {
  padding: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
}
.card-core {
  background: var(--bg-card);
  border-radius: calc(24px - 6px);  /* concentric curve */
  padding: 20px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.12);
}
```

Effect: each card looks like it's seated in an aluminum tray. On dark themes the outer shell becomes a barely-visible hairline; on light themes it's a barely-visible shadow ring. Costs zero perf (no new layers), reads as premium.

### 5.3 Inline editing — the high-value barista interaction

Three interactions account for ~80% of barista time:

1. Toggle availability (`[●○]` switch).
2. Adjust stock (number).
3. Mark a product as "I just used the last one."

The redesign makes all three one-tap, one-element, no-modal — and can build directly on the existing `toggleProductField` mutation in `ProductsSubTab.tsx` (confirmed present, no new backend work needed for the toggle/generic-update path):

```tsx
// Stock: tap to edit, +/- buttons, swipe down to dismiss
<InlineStockEditor
  value={product.stock}
  onChange={(n) => toggleProductField.mutate({ id: product.id, field: 'stock', value: n })}
  onZero={() => {
    toggleProductField.mutate({ id: product.id, field: 'stock', value: 0 });
    toggleProductField.mutate({ id: product.id, field: 'available', value: false });  // auto-hide
    haptics.error(); // maps to hapticFeedback.notificationOccurred('error') via the wrapper
  }}
/>

// Availability: a small segmented control, not a checkbox
<SegmentedToggle
  options={[{ value: true, label: '✓', ariaLabel: 'موجود' },
            { value: false, label: '✗', ariaLabel: 'ناموجود' }]}
  value={product.available}
  onChange={(v) => toggleProductField.mutate({ id: product.id, field: 'available', value: v })}
/>

// "I used the last one" panic action
<PanicButton onTap={() => { /* zero stock + hide + haptic, same as onZero above */ }}>
  اتمام موجودی
</PanicButton>
```

The panic button is the killer feature. A barista who just made the last latte doesn't want to tap availability off, then tap stock to 0, then confirm two toasts — they want one tap.

> **Note:** extract `toggleProductField` out of `ProductsSubTab.tsx` into a shared `useProductMutations.ts` hook so `/counter` (new) and `/inventory` (existing) share one mutation surface instead of duplicating it. This is new refactor work — add to Phase 3 (§9).

### 5.4 The Bottom Nav refinement

Today: `position: fixed` nav with `NavLink`s and emoji icons (confirmed in `App.tsx`). The redesign:

- **Drop to 3-4 visible tabs** at most. `category_admin` sees 3 (پیشخوان / موجودی + chat tab). No horizontal overflow needed at that count.
- **Replace emoji icons** (`📋` `📊` `⚙️` `ℹ️` — confirmed literal strings in `App.tsx`) **with inline SVG icons.** Confirmed: `admin-app/package.json` has no icon library dependency at all (only `@tanstack/react-query`, `@telegram-apps/sdk`, `react`, `react-dom`, `react-router-dom`). Rather than adding a new package, use a single inline SVG sprite (`<use href="#icon-name">`) — zero new dependency, keeps the Phase 1 bundle-size budget entirely for the Vazirmatn font subset.
- **Active state** uses a sliding pill indicator (`::after` with `transform: translateX(var(--active-tab-offset))` animated on layout change), not a background color change.
- **The chat FAB moves into the nav** as the rightmost item instead of floating (`ChatButton.tsx` currently renders as a fixed-position FAB, confirmed). This frees screen real estate for content and aligns the FAB with the nav's safe-area.
  - **Per Decision #2, this requires removing `ChatButton.tsx`'s current `if (!isSuperAdmin) return null` gate** so the chat tab is in the nav for both roles. See Phase 4 (§9).

```
┌────────────────────────────────────────────────┐
│  ▣     ▤     ⚙          🤖                   │
│  پیشخوان  موجودی  تنظیمات    دستیار            │
└────────────────────────────────────────────────┘
```

Example above is `category_admin`'s nav (`پیشخوان` / `موجودی` + `تنظیمات` sub-tab from `/counter` linking back to `/inventory?tab=products` + chat). `super_admin`'s nav replaces `پیشخوان` with `آمار` (`موجودی` / `آمار` / `تنظیمات` + chat — per Decision #5). The chat tab is the rightmost item in both.

### 5.5 Motion language

Custom cubic-beziers everywhere. Never `linear`, rarely `ease-in-out`.

```css
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);    /* page enters */
--ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1); /* drawer slides */
--ease-spring: cubic-bezier(0.32, 0.72, 0, 1);       /* toggles, taps */
```

- **Page enter:** `opacity 0 → 1` + `translateY(12px → 0)` over 400ms, `ease-out-quint`. One-shot on mount, no scroll listener.
- **Drawer slide:** `translateY(100% → 0)` over 350ms, `ease-in-out-quart`. Reverse on close.
- **Toggle:** `scale(1 → 0.96 → 1)` over 180ms, `ease-spring`. The active thumb slides 220ms.
- **Tab switch:** sliding pill indicator over 280ms, `ease-spring`.

Honors `prefers-reduced-motion` by collapsing all of the above to `opacity` only, no transforms.

---

## 6. Aesthetic System

### 6.1 Font

**Replace `Inter` with `Vazirmatn` for Persian text + `Geist` for Latin glyphs.** Confirmed: `index.css` line 30–31 currently opens the font stack with `'Inter'`. Per Decision #6, load via CDN:

```css
@import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
@import url('https://cdn.jsdelivr.net/npm/geist-font@1.3.0/dist/geist-sans/style.css');

:root {
  --font-persian: 'Vazirmatn', 'IRANSansX', system-ui, sans-serif;
  --font-latin: 'Geist', var(--font-persian);
}
body {
  font-family: var(--font-persian);
}
.digits, [dir='ltr'] {
  font-family: var(--font-latin);
}
```

Vazirmatn is the de-facto standard for Persian digital UI in 2026 (replaced the older IRANSans family). It preserves Latin glyphs gracefully so prices stay readable when they pop out in an LTR run. Geist is the Linear/Vercel font — neutral, modern, and free.

### 6.2 Color tokens (extend, don't replace)

The current tokens (`--primary: #4f46e5`, etc.) are fine. The redesign adds Telegram theme params as overrides:

```css
:root {
  /* Default light (preserved) */
  --primary: #4f46e5;
  --bg-dark: #f8fafc;
  --bg-card: rgba(255, 255, 255, 0.7);
  --text-main: #0f172a;
  /* ... */
}

:root.telegram-themed {
  /* Set via bindThemeParamsCssVars() from the SDK — see §5.1 */
  --bg-dark: var(--tg-theme-bg-color, #f8fafc);
  --bg-card: var(--tg-theme-secondary-bg-color, rgba(255, 255, 255, 0.7));
  --text-main: var(--tg-theme-text-color, #0f172a);
  --primary: var(--tg-theme-button-color, #4f46e5);
}
```

When the user opens the Mini App from Telegram's "Night" theme, the admin app inherits the dark background automatically. No toggle, no flash, no override.

### 6.3 Iconography

Replace the emoji nav icons (`📋` `📊` `⚙️` `ℹ️`) and the `🏷️` `📦` `🏠` `✉️` etc. scattered through the UI with a single inline SVG sprite file. **Confirmed no icon package is currently installed** — commit to inline SVG (`<use href="#icon-name">`) rather than adding Phosphor or any other dependency.

### 6.4 Layout archetype

**Soft Structuralism** (clean whites/silvers, generous whitespace, ambient shadows). The vibe is "professional admin tool," not "marketing site." Telegram Mini Apps are utilitarian — the aesthetic should match.

Mobile-first is universal (Telegram Mini Apps are always phone-shaped). Desktop viewports get the same single-column layout centered at `max-width: 480px`.

---

## 7. Files to Modify / Create

### 7.1 Modify

| File | Change |
|---|---|
| `admin-app/src/App.tsx` | Add `/counter` route. Move chat FAB into bottom nav. Add theme-params bootstrap. |
| `admin-app/src/index.css` | Add Double-Bezel tokens. Replace Inter with Vazirmatn + Geist (CDN, Decision #6). Inline SVG icon system. New motion tokens. |
| `admin-app/src/components/ProductsSubTab.tsx` | Split into `<InventoryList>` + `<ProductFormDrawer>`. Add branch badge to product cards. Inline stock editor. Extract `toggleProductField` into shared `useProductMutations.ts`. |
| `admin-app/src/pages/InventoryPage.tsx` | Add branch selector above category chips. **Fix `initialTab` to default to `'products'` for `category_admin`, `'categories'` for `super_admin`** (verified gap). |
| `admin-app/src/components/ChatButton.tsx` | Re-render as nav tab instead of floating FAB. **Remove the `if (!isSuperAdmin) return null` gate (line 14)** per Decision #2. |
| `admin-app/src/components/ConfigurePage.tsx` + `InfoPage.tsx` | Merge into a single `SettingsPage.tsx` with sub-tabs `عمومی` / `محتوا` / `مدیریت` per Decision #5. |

### 7.2 Create

| File | Purpose |
|---|---|
| `admin-app/src/pages/CounterPage.tsx` | Barista home screen (Decision #3 — `category_admin` only). |
| `admin-app/src/components/InlineStockEditor.tsx` | Tap-to-edit stock with panic-zero action. |
| `admin-app/src/components/SegmentedToggle.tsx` | Two/three-state segmented control with haptic feedback. |
| `admin-app/src/components/BranchSelector.tsx` | Sticky branch picker pill. Local state per Decision #4. |
| `admin-app/src/components/ProductFormDrawer.tsx` | Bottom-sheet drawer for full product CRUD. |
| `admin-app/src/components/DoubleBezelCard.tsx` | The nested-shell card primitive. |
| `admin-app/src/hooks/useTelegramTheme.ts` | Subscribe to `themeParamsState` changes (corrected v2 API — see §5.1). |
| `admin-app/src/hooks/useTelegramHaptics.ts` | Wrapper around `hapticFeedback` for consistent semantics (corrected v2 API — see §5.1). |
| `admin-app/src/hooks/useProductMutations.ts` | Shared `toggleProductField`/stock mutation, extracted from `ProductsSubTab.tsx` so `/counter` and `/inventory` don't duplicate it. |

### 7.3 Don't touch

- `src/api/resources/products.ts` — the API is fine for Path A (confirmed: `updateStock`/`toggleAvailability` endpoints already support everything the redesign needs).
- `src/api/router.ts` — no new routes needed for the redesign.
- `admin-app/src/api/*` — types are stable, confirmed against source.
- `src/database/schema.ts` — Path A needs no schema changes.

---

## 8. Open Questions (resolved)

All six open questions from the v2 draft are resolved. See the **Decisions Locked** section at the top.

The previous v2 questions and their resolutions:

1. **Per-branch stock model — Path A or Path B?** → **Path A** (Decision #1). See `Decisions Locked`.
2. **Counter screen scope — baristas or all non-super-admins?** → **`category_admin` only** (Decision #3). See `Decisions Locked`.
3. **Chat panel accessibility.** → **Both roles** (Decision #2). Requires actual code change to `ChatButton.tsx:14` — see §7.1 and Phase 4 (§9).
4. **Branch context persistence.** → **Local state, reset to 'all' each session** (Decision #4). See `Decisions Locked`.
5. **Configure + Info consolidation.** → **Yes, merge into one `تنظیمات` tab** (Decision #5). See §4.4.
6. **Font loading.** → **CDN (Vazirmatn + Geist via jsDelivr)** (Decision #6). See §6.1.

---

## 9. Implementation Phasing

### Phase 1 — Foundations (1-2 days)

- Add Vazirmatn + Geist via CDN (Decision #6). Pure CSS change, zero behavior change. Validate the rendering on Telegram light + dark themes.
- Add `useTelegramTheme` hook using the corrected v2 API (`themeParamsState()` / `.sub()`, `bindThemeParamsCssVars()`) — see §5.1. Remove the `prefers-color-scheme` hack.
- Replace emoji icons with inline SVG sprite (no new dependency — see §6.3).
- **Fix `InventoryPage.tsx`'s role-unaware default tab** (`'categories'` for everyone today → role-aware default). Zero risk, one-line change, pairs naturally with this phase's other foundation work.

**Done when:** the app looks identical on a stock browser, reads the user's Telegram theme correctly when launched from the bot, and `category_admin` opening `/inventory` lands on the products sub-tab by default.

### Phase 2 — Visual system (2-3 days)

- Adopt Double-Bezel card primitive.
- Add motion tokens + `prefers-reduced-motion` fallbacks.
- Apply consistent cubic-beziers to all transitions.
- Refine active states on bottom nav (sliding pill indicator).
- Replace the floating chat FAB with a nav tab (visual move only in this phase; the `isSuperAdmin` gate itself is addressed in Phase 4 per Decision #2).

**Done when:** any new screen automatically gets the new visual system from `<DoubleBezelCard>` and the motion tokens.

### Phase 3 — Inline editing on Inventory (3-4 days)

- Extract `toggleProductField` out of `ProductsSubTab.tsx` into shared `useProductMutations.ts` — needed so `/counter` in Phase 4 doesn't duplicate the mutation logic.
- Extract `<InventoryList>` from `ProductsSubTab`.
- Add `<InlineStockEditor>` and `<SegmentedToggle>`, wired to the shared mutation hook.
- Add branch badge + branch picker to the inventory page.
- Add inline panic-zero behavior (zero stock + auto-hide).
- Add haptic feedback (via `useTelegramHaptics`, corrected v2 API) on every mutation.

**Done when:** the owner can change a product's stock in one tap from the inventory list without opening the form.

### Phase 4 — The Counter screen (2-3 days)

- Build `/counter` page for `category_admin` (Decision #3), reusing `useProductMutations.ts` from Phase 3.
- Add branch selector (`<BranchSelector>`) + search overlay + accordion list.
- Wire it as the default route for `category_admin`.
- Trim the bottom nav to 3 tabs for `category_admin` (`پیشخوان` / `موجودی` + chat tab).
- **Per Decision #2:** remove the `isSuperAdmin` gate in `ChatButton.tsx:14` and add the chat tab to `category_admin`'s now-3-tab nav. This is the natural point to do it, since it's when `category_admin` first gets meaningful nav real estate.

**Done when:** a barista can mark 5 products out of stock in under 30 seconds without scrolling.

### Phase 5 — Product editor as drawer (2-3 days)

- Extract `<ProductFormDrawer>` from `ProductsSubTab.tsx`.
- Wire `backButton.mount()` + `.onClick()` + `.show()` (corrected v2 API — see §5.1) to close the drawer.
- Use `mainButton.setParams({ text: 'ذخیره', isVisible: true })` + `.onClick()` as the save CTA at the bottom of the drawer.

**Done when:** full product CRUD happens in a drawer, not inline at the top of the list.

### Phase 6 — Polish + per-branch (1-2 days)

Per Decision #1, Phase 6 is now small — Path A scope only. No schema migration.

- "Clone to other branch" action on the product card `⚙` sheet (Phase 4 already created the action sheet — Phase 6 wires the action).
- Empty state illustrations for "no products in this category yet."
- Configure + Info consolidation per Decision #5 — merge into `SettingsPage.tsx` with sub-tabs `عمومی` / `محتوا` / `مدیریت`. Update `App.tsx` bottom nav to 3 tabs + chat for `super_admin`.
- Final motion polish (verify all transitions use the three cubic-beziers from §5.5).

**Done when:** the app has 3+1 tabs for `super_admin`, 3+1 for `category_admin`, zero nested-modal nav, and the per-branch clone action works in one tap.

---

## 10. Assumptions Made (not independently verified)

1. **Two branches, never more.** The redesign assumes branch count stays at 2 (Iranshahr, future expansion?). The UI is built for N branches but hasn't been stress-tested with the picker at 5+ branches. If expansion to 5+ is planned, the picker becomes a sheet with a search field.
2. **The barista always has a phone, not a tablet.** Telegram Mini Apps run on tablets too but the design assumes a phone-sized WebView (~360-420px). Tablet layouts get the same single column centered, which works but isn't optimized.
3. **@telegram-apps/sdk v2 supports all the affordances listed in §5.1** — **Resolved.** Inspected directly; the affordances exist under different names/shapes than v1's pseudocode assumed. See §5.1 for the corrected API.
4. **The owner's primary editing language is Persian.** The redesign assumes Persian RTL throughout. Adding English support later is a `dir="auto"` swap, not a redesign.
5. **No offline mode is needed.** Telegram Mini Apps are online-by-definition (they run in a WebView over Telegram's connection). The redesign doesn't account for offline data.
6. **The product's `stock` of 0 is equivalent to "out of stock" but `available = false` is the *customer-visible* signal.** The redesign's panic-zero action sets both. If the business treats stock > 0 with `available = false` as a meaningful state (e.g., "temporarily hidden, will return"), the panic action needs user confirmation.
7. **`category_admin` accounts for the operational baristas, not the owner.** If the owner also wants to occasionally use the barista UX (e.g., for quick stock adjustments from their own phone), they need a role override — currently not implemented. Recommend: skip this for v1; the owner can use `/inventory` which has all the same inline editing.
8. **The chat panel becomes a tab in the bottom nav (per §5.4), not a separate full-screen route.** This is a behavior change from the current FAB, and now also requires a code change to `ChatButton.tsx`'s role gate (per Decision #2, see §7.1). If the chat history is too long for a tab-style FAB to feel right, the implementation will need to revisit (likely: chat opens as a full-screen route, not a tab).

---

## 11. Success Criteria

The redesign is done when:

1. A barista (`category_admin`) lands on `/counter` (Decision #3), can mark any product out of stock in 1 tap, and never sees `/configure` or `/info` in their nav.
2. The owner (`super_admin`) can edit any product's stock, availability, and featured flag inline without opening the form drawer.
3. `category_admin` opening `/inventory` directly lands on the `products` sub-tab, filtered to their `allowedCatId`, not the `categories` sub-tab (fixes the verified gap in §2.3/§7.1).
4. The app honors Telegram's theme (light / dark) without a separate toggle.
5. Every save / toggle fires haptic feedback and optimistic UI with rollback on error.
6. Bottom nav is 3 tabs + chat for both roles. **Per Decision #5, super_admin nav consolidates `Configure` + `Info` into `تنظیمات`** — so super_admin sees `موجودی` / `آمار` / `تنظیمات` + chat. Category_admin sees `پیشخوان` / `موجودی` + chat.
7. All transitions use the three custom cubic-beziers from §5.5 (no `linear`, no `ease-in-out`).
8. The app passes `npm run check` (typecheck + lint + format) and ships without bundle size regression (target: ≤ current `admin-app/dist` size + 100KB for Vazirmatn subset — no icon-library dependency added, per §6.3 and Decision #6).
9. **Per Decision #2, the chat panel is reachable from both roles** — verifying that `ChatButton.tsx:14` no longer returns null for `category_admin`.
