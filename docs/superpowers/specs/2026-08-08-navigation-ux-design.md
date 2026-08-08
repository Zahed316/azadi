# Navigation & UX Modernization Design Spec

**Date**: 2026-08-08
**Scope**: Admin Mini App navigation reorganization + bot menu visual grouping + micro-interaction fixes
**Out of scope**: Theme system (separate spec)

---

## 1. Problem Statement

The admin Mini App has **11 bottom nav tabs** for super_admin users (Products, Categories, Settings, About Us, Content, Admins, Menu, Streaks, Favorites, AI Logs, AI Test, Messages). Standard mobile UX recommends **5-6 max**. The bot main menu has **12 buttons** — functional but visually cluttered for a coffee shop customer.

Micro-interactions (loading states, success feedback, empty states) are inconsistent: some mutations show toasts, others silently succeed/fail; empty states say "No items" with no guidance.

## 2. Admin App Navigation Reorg

### Current State
```
Bottom nav (super_admin): 📦Products | 🏷️Categories | ⚙️Settings | 🏠About Us | 📝Content | 👥Admins | 📋Menu | 🔥Streaks | ⭐Favorites | 🤖AI Logs | 🧪AI Test | ✉️Messages
Bottom nav (category_admin): 📦Products | 🏷️Categories
```

### Proposed State

**Primary tabs** (always visible, ≤6):
```
📦 Products | 🏷️ Categories | 📊 Insights | ⚙️ Configure | ℹ️ Info | ☰ More
```

**Tab details:**

| Tab | Icon | Pages Included | Notes |
|-----|------|----------------|-------|
| Products | 📦 | ProductsPage | Core — keep as-is |
| Categories | 🏷️ | CategoriesPage | Core — keep as-is |
| Insights | 📊 | StreaksPage, FavoritesPage, AILogsPage, AITestPage | Grouped analytics |
| Configure | ⚙️ | SettingsPage, MenuConfigPage, AdminsPage | Super admin config |
| Info | ℹ️ | AboutUsPage, ContentPage, MessagesPage | Content + feedback |
| More | ☰ | Overflow menu (no dedicated page) | Shows remaining items as a dropdown/modal |

**For category_admin**: Only Products and Categories appear in the bottom nav (same as today). The `/insights`, `/configure`, `/info` routes redirect to `/products` via the existing `<Navigate>` guards.

**"More" overflow**: When tapped, opens a modal/drawer listing any pages that don't fit in the visible tabs. With the current grouping, "More" will be **empty** (all pages are covered by the 6 tabs). It exists purely as a safety valve — if a future page doesn't fit into any group, add it here instead of expanding the bottom nav beyond 6. If More is empty, the tab itself can be hidden until needed.

### Implementation

1. **Replace individual NavLink items** in `admin-app/src/App.tsx:113-201` with grouped NavLink items
2. **Create wrapper pages** for grouped tabs:
   - `InsightsPage` — renders Streaks, Favorites, AI Logs, AI Test as sub-sections (vertical cards)
   - `ConfigurePage` — renders Settings, Menu Config, Admins as sub-sections
   - `InfoPage` — renders About Us, Content, Messages as sub-sections
3. **Update routing** — add `/insights`, `/configure`, `/info` routes; keep old routes for backward compat (redirect to new)
4. **Remove 5 NavLink items** from bottom nav (reduce from 11 → 6)

### Why not a hamburger/drawer?

Bottom nav is better for frequent switching (products ↔ categories). The grouping approach preserves discoverability while hitting the 6-tab target.

## 3. Bot Menu Visual Grouping

### Current State
```
⭐ پیشنهاد ویژه          (callback → paginated list)
🌿 مخصوص فصل            (callback → paginated list)
📖 پاسپورت قهوه         (callback → paginated list)
🔍 جستجو                (nudges text input)
⭐ منوهای من            (callback → favorites list)
☕ نوشیدنی‌ها            (submenu → drinks nav menu)
🌱 دانه‌های قهوه         (submenu → products menu)
🍰 کیک و کوکی           (submenu → products menu)
🏠 درباره ما             (submenu → branches menu)
❓ سوالات متداول         (callback → FAQ list)
✉️ پیام به ما           (callback → message flow)
```

### Proposed Grouping

**"Discover" submenu** (replaces 3 separate buttons):
```
🔍 کاوش (Discover)
  ├─ ⭐ پیشنهاد ویژه
  ├─ 🌿 مخصوص فصل
  ├─ 📖 پاسپورت قهوه
  └─ 🔍 جستجو
```

**Main menu after grouping** (9 buttons → 8 after merge, but visually 6 groups):
```
🔍 کاوش                    (submenu)
⭐ منوهای من               (callback)
☕ نوشیدنی‌ها              (submenu)
🌱 دانه‌های قهوه           (submenu)
🍰 کیک و کوکی             (submenu)
🏠 درباره ما + ❓ سوالات   (merged submenu → branches + FAQ)
✉️ پیام به ما             (callback)
```

### Implementation

1. **Create `src/menus/discoverMenu.ts`** — new grammY Menu with 4 buttons (featured, seasonal, passport, search)
2. **Create `src/menus/infoMenu.ts`** — merge branches menu + FAQ into one submenu
3. **Update `src/menus/mainMenu.ts`** — replace the 3+1+1 separate buttons with 2 submenus
4. **Update callback handlers** if needed (the existing regex handlers for `featured:page:*`, `seasonal:page:*`, `passport:page:*` remain unchanged)

## 4. Micro-Interaction Fixes

### 4.1 Loading States on Mutations

Every `useMutation` in admin-app pages should show a loading indicator on the submit button.

**Pattern** (already used in some places):
```tsx
<button type="submit" className="primary" disabled={mutation.isPending}>
  {mutation.isPending ? '...' : 'Save'}
</button>
```

**Files to update** (all pages with mutations):
- `ProductsPage.tsx` — add/delete/toggle mutations
- `CategoriesPage.tsx` — add/delete mutations
- `AdminsPage.tsx` — add/delete mutations (line 76: `disabled={addAdminMutation.isPending}`)
- `SettingsPage.tsx` — save mutation
- `MenuConfigPage.tsx` — add/delete/reorder mutations
- `AboutUsPage.tsx` — save mutation
- `ContentPage.tsx` — add/delete mutations
- `MessagesPage.tsx` — reply/delete mutations

### 4.2 Success Toasts After Mutations

Currently, some mutations call `queryClient.invalidateQueries` but don't show a success toast. Add `showToast` calls to:

- **Admin add/delete** → "✅ Admin added" / "✅ Admin removed"
- **Settings save** → "✅ Settings saved"
- **FAQ add/delete** → "✅ FAQ added" / "✅ FAQ removed"
- **Branch add/delete** → "✅ Branch added" / "✅ Branch removed"
- **Menu config changes** → "✅ Menu updated"
- **Message reply** → "✅ Reply sent"

### 4.3 Optimistic Updates

For simple toggle operations (product available/featured/seasonal flags), use optimistic updates:

```tsx
useMutation({
  mutationFn: () => apiFetch(`/products/${id}/toggle`, { method: 'POST', body: { field } }),
  onMutate: async () => {
    await queryClient.cancelQueries({ queryKey: queryKeys.products });
    const prev = queryClient.getQueryData(queryKeys.products);
    queryClient.setQueryData(queryKeys.products, (old) =>
      old?.map((p) => (p.id === id ? { ...p, [field]: !p[field] } : p))
    );
    return { prev };
  },
  onError: (_err, _vars, context) => {
    if (context?.prev) queryClient.setQueryData(queryKeys.products, context.prev);
    setError('Failed to toggle');
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
})
```

**Where to apply** (high-frequency toggles only):
- Product available toggle
- Product featured toggle
- Menu config visibility toggle

### 4.4 Empty States

Replace generic "No items" with helpful guidance:

| Page | Current | Proposed |
|------|---------|----------|
| ProductsPage | "No products yet" | "No products yet. Add your first product to get started." |
| CategoriesPage | "No categories" | "Categories help organize your menu. Add one to start." |
| AdminsPage | "No admins yet" | "No admins yet. Add a Telegram ID to grant admin access." |
| FavoritesPage | "No favorites" | "Users' favorited products will appear here." |
| AILogsPage | "No logs" | "AI conversation logs will appear as users interact with the bot." |
| MessagesPage | "No messages" | "User messages and feedback will appear here." |
| StreaksPage | "No streak data" | "User visit streaks will appear here once tracking is enabled." |

## 5. Implementation Order

1. **Admin app grouped tabs** (Steps 2.1-2.4) — highest impact, most visible change
2. **Bot menu grouping** (Steps 3.1-3.4) — second highest, simpler scope
3. **Micro-interactions: loading + toasts** (Steps 4.1-4.2) — quick wins
4. **Optimistic updates** (Step 4.3) — moderate complexity
5. **Empty states** (Step 4.4) — lowest risk, pure content changes

## 6. Testing

- `npm test` (149 tests should remain passing)
- `npm run typecheck` (clean)
- `npm run lint` (non-blocking, count should not increase)
- `admin-app npm run build` (clean)
- Manual: verify bottom nav renders 6 tabs, grouped pages show correct content, bot menu groups display correctly

## 7. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Grouped pages lose individual URL bookmarks | Keep old routes as redirects |
| Bot menu grouping changes callback data | No — callback regexes unchanged; only menu structure changes |
| Loading states break form submission | Disable button + show spinner, not block submission |
| Optimistic update shows stale data | `onSettled` always invalidates query |
