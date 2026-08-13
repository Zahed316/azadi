# Menu Visibility Toggles — Design Spec

## Goal

Let admins show/hide any top-level bot menu section from the Mini App, without code changes or redeployment.

## Context

The bot's main menu (`src/menus/mainMenu.ts`) has 11 buttons — all hardcoded visible. Admins currently have no way to hide a section (e.g. temporarily disable the Coffee Passport during a menu rewrite, or hide Branches if only one location is active). The `settings` table already stores feature flags (`streak_messages`, `streak_cron_enabled`) as key-value pairs, and the SettingsPage renders them as toggles. This design extends that pattern to menu visibility.

## Design

### Storage

Use the existing `settings` table (key-value text store). Each menu section gets a key:

| Key                      | Controls         |
| ------------------------ | ---------------- |
| `menu_visible_featured`  | ⭐ پیشنهاد ویژه  |
| `menu_visible_seasonal`  | 🌿 مخصوص فصل     |
| `menu_visible_passport`  | 📖 پاسپورت قهوه  |
| `menu_visible_search`    | 🔍 جستجو         |
| `menu_visible_favorites` | ⭐ منوهای من     |
| `menu_visible_about`     | 🏠 درباره ما     |
| `menu_visible_drinks`    | ☕ نوشیدنی‌ها    |
| `menu_visible_beans`     | 🌱 دانه‌های قهوه |
| `menu_visible_cakes`     | 🍰 کیک و کوکی    |
| `menu_visible_branches`  | 📍 شعب           |
| `menu_visible_faq`       | ❓ سوالات متداول |

Value: `"true"` or `"false"` (text). Missing key = visible (safe default).

No database migration — `settings` is a dynamic key-value store.

### Bot Side (`src/menus/mainMenu.ts`)

1. Each menu button's callback loads the corresponding `menu_visible_*` setting via `SettingsRepository.getValue()`.
2. If the value is `"false"`, reply with a "this section is currently unavailable" message instead of rendering the section content.
3. For submenus (`drinks`, `beans`, `cakes`, `branches`), the visibility check happens at the submenu entry point — if hidden, show a short message; if visible, delegate to the submenu handler.
4. Settings are loaded per-request (no caching) — changes take effect immediately.

**Why per-request, not cached:** The menu is invoked infrequently (user taps). A single `getValue()` call per tap is negligible cost. Caching would add complexity for zero benefit and risk stale visibility after admin toggles.

### Mini App Side (`admin-app/src/pages/SettingsPage.tsx`)

1. Add a new "Menu Visibility" card above the existing "Feature Flags" card.
2. Render 11 toggle switches (one per menu section), each mapped to its `menu_visible_*` key.
3. Toggle state read from / written to the `settings` table via existing `GET /api/settings` and `PUT /api/settings/:key` endpoints.
4. Missing keys default to visible (toggle ON).
5. Label each toggle with the button's Persian text and emoji for clarity.

### API

No new endpoints. The existing `GET /api/settings` and `PUT /api/settings/:key` already handle arbitrary key-value pairs.

## Files Modified

| File                                   | Change                                   |
| -------------------------------------- | ---------------------------------------- |
| `src/menus/mainMenu.ts`                | Add visibility check per button          |
| `admin-app/src/pages/SettingsPage.tsx` | Add Menu Visibility card with 11 toggles |
| `admin-app/src/api/keys.ts`            | Add `menuVisibility` query key           |

## Out of Scope

- Per-category visibility within submenus (already handled by `menuConfig.isVisible`)
- Reordering menu buttons (already handled by `menuConfig.displayOrder` for submenus)
- Hiding the "back" button or navigation elements

## Verification

1. `npm run typecheck` — no errors
2. `npm test` — all pass
3. `npm run build` — admin-app builds
4. Manual test: toggle a section off in Mini App → bot menu no longer shows it → toggle on → it reappears
