# Menu Visibility Toggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins show/hide any of the 11 top-level bot menu sections from the Mini App without code changes.

**Architecture:** Store `menu_visible_*` keys in the existing `settings` table (value `"true"` or `"false"`, missing = visible). Bot reads per-request via `SettingsRepository.getValue()`. Mini App renders toggle switches in a new "Menu Visibility" card on the SettingsPage.

**Tech Stack:** grammY Menu API, Drizzle ORM (settings table), React + @tanstack/react-query, existing REST API (GET/PUT settings).

## Global Constraints

- All bot text is Persian (Farsi) with HTML parse mode
- Use `toPersianDigits()` for any user-facing numbers
- Settings table is a key-value text store — no migration needed
- Missing key = visible (safe default for new deployments)
- Mini App UX: use `showToast()` (never `alert()`), fields wrapped in `<Field label>`
- ESLint/Prettier is non-blocking in CI
- `admin-app/` has its own `node_modules` — run `npm install` inside it independently

## File Structure

| File                                   | Change                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/menus/mainMenu.ts`                | Add visibility check at top of each button callback; convert `.submenu()` calls to `.text()` with visibility + dynamic submenu |
| `admin-app/src/pages/SettingsPage.tsx` | Add "Menu Visibility" card with 11 toggle switches                                                                             |
| `admin-app/src/api/keys.ts`            | Add `menuVisibility` query key                                                                                                 |

---

### Task 1: Add menu visibility helper and bot-side checks

**Files:**

- Modify: `src/menus/mainMenu.ts`
- Test: `npm test` (existing tests should still pass)

**Interfaces:**

- Consumes: `SettingsRepository.getValue(key)` — returns `Promise<string | null>`
- Produces: Each button callback checks `menu_visible_*` before rendering content

**Key design decision:** The current `mainMenu.ts` uses a static `.text().row()` chain. We cannot add async visibility checks to static chain entries. Two approaches:

- **Option A (chosen):** Keep the static menu structure, add visibility check at the top of each `.text()` callback. For `.submenu()` entries (drinks, beans, cakes, branches), convert to `.text()` with a visibility check that delegates to the submenu's content.
- **Option B:** Convert to `.dynamic()` like `drinksNavMenu`. More invasive, restructures the entire file.

Option A is preferred because it preserves the existing file structure and only adds early-return checks. The `.submenu()` → `.text()` conversion is necessary because grammY's `.submenu()` has no callback to intercept.

- [ ] **Step 1: Add visibility helper function at the top of mainMenu.ts**

After the `loadPriceUnit` function (line ~13), add:

```ts
const MENU_VISIBILITY_KEYS: Record<string, string> = {
  featured: 'menu_visible_featured',
  seasonal: 'menu_visible_seasonal',
  passport: 'menu_visible_passport',
  search: 'menu_visible_search',
  favorites: 'menu_visible_favorites',
  about: 'menu_visible_about',
  drinks: 'menu_visible_drinks',
  beans: 'menu_visible_beans',
  cakes: 'menu_visible_cakes',
  branches: 'menu_visible_branches',
  faq: 'menu_visible_faq',
};

async function isMenuVisible(env: any, section: string): Promise<boolean> {
  const key = MENU_VISIBILITY_KEYS[section];
  if (!key) return true;
  const value = await new SettingsRepository(env.DB).getValue(key);
  return value !== 'false';
}

const HIDDEN_MESSAGE = '❌ این بخش در حال حاضر غیرفعال است.';
```

- [ ] **Step 2: Add visibility check to each .text() callback**

For each of the 7 inline `.text()` buttons (featured, seasonal, passport, search, favorites, about, faq), add at the top of the callback (after `try {`):

```ts
if (!(await isMenuVisible(ctx.env, 'SECTION_KEY'))) {
  await ctx.reply(HIDDEN_MESSAGE, {
    reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
  });
  return;
}
```

The section keys are: `featured`, `seasonal`, `passport`, `search`, `favorites`, `about`, `faq`.

- [ ] **Step 3: Convert .submenu() calls to .text() with visibility checks**

Replace the 4 `.submenu()` entries with `.text()` callbacks that check visibility and render the submenu content inline. For each submenu, the pattern is:

```ts
// BEFORE:
.submenu('☕ نوشیدنی‌ها', 'drinks-nav-menu')

// AFTER:
.text('☕ نوشیدنی‌ها', async (ctx: any) => {
  if (!(await isMenuVisible(ctx.env, 'drinks'))) {
    await ctx.reply(HIDDEN_MESSAGE, {
      reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
    });
    return;
  }
  // Delegate to the submenu's content by rendering its first page
  // The drinks menu is dynamic (loads from DB), so we replicate its entry logic
  try {
    const menuRepo = new MenuConfigRepository(ctx.env.DB);
    const configs = await menuRepo.getBySection('drinks');
    if (configs.length === 0) {
      await ctx.reply('📭 در حال حاضر نوشیدنی موجود نیست.');
      return;
    }
    // Render the drinks nav menu's content by sending the menu as a reply
    const { drinksNavMenu } = await import('./drinksNavMenu');
    await ctx.reply('یک دسته انتخاب کنید:', {
      reply_markup: drinksNavMenu,
    });
  } catch (e) {
    console.error(e);
    await ctx.reply('❌ خطا در بارگذاری نوشیدنی‌ها.');
  }
})
```

**IMPORTANT:** For drinks, beans, cakes, and branches, the `.submenu()` approach rendered the submenu inline with the main menu. Converting to `.text()` means the submenu renders as a separate message. This changes the UX slightly — the user taps the button, sees a new message with the submenu content, and taps "back" to return.

**Alternative (simpler):** Instead of replicating submenu content, keep `.submenu()` and add the visibility check INSIDE each submenu's own callback. This means modifying `drinksNavMenu.ts`, `productsMenu.ts`, and `branchesMenu.ts` to check visibility at their entry point. The button still appears in the main menu, but the submenu shows the "hidden" message.

**Recommended approach:** Use the alternative. It's less invasive and keeps the main menu structure unchanged. The tradeoff is that hidden sections still show their button in the main menu — but the submenu immediately says "this section is unavailable." This is acceptable for v1; a future enhancement could hide buttons entirely via `.dynamic()`.

So: **keep `.submenu()` calls unchanged**, and add visibility checks inside each submenu's entry callback instead.

- [ ] **Step 3 (revised): Add visibility check to each submenu entry**

In `src/menus/drinksNavMenu.ts`, add at the top of the `.dynamic()` callback:

```ts
async (ctx, range) => {
  // Check if drinks section is visible
  const visible = await isMenuVisible(ctx, 'drinks');
  if (!visible) {
    range
      .text('☕ نوشیدنی‌ها (غیرفعال)', async (ctx) => {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
      })
      .row();
    return;
  }
  // ... existing dynamic button generation
};
```

Wait — `isMenuVisible` needs `env`, not `ctx`. The dynamic callback receives `ctx` which has `ctx.env`. So:

```ts
const visible = await isMenuVisible(ctx.env, 'drinks');
```

But `isMenuVisible` is defined in `mainMenu.ts`. We need to either:

1. Export it from `mainMenu.ts` and import in submenu files
2. Move it to a shared utility (e.g. `src/utils/menuVisibility.ts`)
3. Inline the check in each submenu file

**Option 2 is cleanest.** Create `src/utils/menuVisibility.ts` with the helper, and import it in each menu file.

- [ ] **Step 3 (final): Create menuVisibility utility**

Create `src/utils/menuVisibility.ts`:

```ts
import { SettingsRepository } from '../repositories';

const MENU_VISIBILITY_KEYS: Record<string, string> = {
  featured: 'menu_visible_featured',
  seasonal: 'menu_visible_seasonal',
  passport: 'menu_visible_passport',
  search: 'menu_visible_search',
  favorites: 'menu_visible_favorites',
  about: 'menu_visible_about',
  drinks: 'menu_visible_drinks',
  beans: 'menu_visible_beans',
  cakes: 'menu_visible_cakes',
  branches: 'menu_visible_branches',
  faq: 'menu_visible_faq',
};

export const HIDDEN_MESSAGE = '❌ این بخش در حال حاضر غیرفعال است.';

export async function isMenuVisible(env: { DB: any }, section: string): Promise<boolean> {
  const key = MENU_VISIBILITY_KEYS[section];
  if (!key) return true;
  const value = await new SettingsRepository(env.DB).getValue(key);
  return value !== 'false';
}
```

- [ ] **Step 4: Add visibility checks to mainMenu.ts inline callbacks**

Import `isMenuVisible` and `HIDDEN_MESSAGE` from `../utils/menuVisibility`.

Add at the top of each of the 7 `.text()` callbacks (after `try {`):

```ts
if (!(await isMenuVisible(ctx.env, 'SECTION_KEY'))) {
  await ctx.reply(HIDDEN_MESSAGE, {
    reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
  });
  return;
}
```

Section keys for each button:

- `⭐ پیشنهاد ویژه` → `featured`
- `🌿 مخصوص فصل` → `seasonal`
- `📖 پاسپورت قهوه` → `passport`
- `🔍 جستجو` → `search`
- `⭐ منوهای من` → `favorites`
- `🏠 درباره ما` → `about`
- `❓ سوالات متداول` → `faq`

- [ ] **Step 5: Add visibility checks to submenu entry callbacks**

In `src/menus/drinksNavMenu.ts`:

- Import `isMenuVisible` and `HIDDEN_MESSAGE` from `../utils/menuVisibility`
- At the top of the `.dynamic()` callback, before the `try` block:

```ts
const visible = await isMenuVisible(ctx.env, 'drinks');
if (!visible) {
  range
    .text(HIDDEN_MESSAGE, async (ctx) => {
      await ctx.reply(HIDDEN_MESSAGE, {
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
    })
    .row();
  return;
}
```

In `src/menus/productsMenu.ts`:

- Import `isMenuVisible` and `HIDDEN_MESSAGE` from `../utils/menuVisibility`
- For `beansMenu`: add visibility check at top of the `.text()` callback
- For `cakesMenu`: add visibility check at top of the `.text()` callback

In `src/menus/branchesMenu.ts`:

- Import `isMenuVisible` and `HIDDEN_MESSAGE` from `../utils/menuVisibility`
- Add visibility check at top of the `.text()` callback

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: All existing tests pass (no behavior change when no `menu_visible_*` keys exist in settings)

- [ ] **Step 7: Commit**

```bash
git add src/utils/menuVisibility.ts src/menus/mainMenu.ts src/menus/drinksNavMenu.ts src/menus/productsMenu.ts src/menus/branchesMenu.ts
git commit -m "feat(bot): add per-section menu visibility checks via settings table"
```

---

### Task 2: Add Menu Visibility card to SettingsPage

**Files:**

- Modify: `admin-app/src/pages/SettingsPage.tsx`
- Modify: `admin-app/src/api/keys.ts`

**Interfaces:**

- Consumes: `queryKeys.settings` (existing) — returns `{ key: string; value: string }[]`
- Produces: Toggle switches that call `PUT /api/settings/:key` with `{ value: "true" | "false" }`

- [ ] **Step 1: Add menuVisibility query key to keys.ts**

In `admin-app/src/api/keys.ts`, add after the `favorites` entry:

```ts
menuVisibility: ['menu-visibility'] as const,
```

- [ ] **Step 2: Add Menu Visibility state and mutation to SettingsPage**

In `admin-app/src/pages/SettingsPage.tsx`, add after the existing `deleteSettingMutation`:

```ts
const [menuVisInitialized, setMenuVisInitialized] = useState(false);
const [menuVis, setMenuVis] = useState<Record<string, boolean>>({});

// Initialize menu visibility state from settings data
if (!menuVisInitialized && settings.length > 0) {
  const initial: Record<string, boolean> = {};
  for (const key of MENU_VISIBILITY_KEYS) {
    const setting = settings.find((s: any) => s.key === key);
    // Missing key = visible (default)
    initial[key] = setting?.value !== 'false';
  }
  setMenuVis(initial);
  setMenuVisInitialized(true);
}

const saveMenuVisMutation = useMutation({
  mutationFn: async (data: { key: string; visible: boolean }) => {
    return apiFetch(`/settings/${encodeURIComponent(data.key)}`, {
      method: 'PUT',
      body: { value: data.visible ? 'true' : 'false' },
    });
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    showToast('Saved ✓');
  },
  onError: (err: Error) => {
    setError(err.message);
  },
});

const handleToggleMenuVis = (key: string, visible: boolean) => {
  setMenuVis((prev) => ({ ...prev, [key]: visible }));
  saveMenuVisMutation.mutate({ key, visible });
};
```

Define the key-to-label mapping (above the component or as a const):

```ts
const MENU_VISIBILITY_KEYS = [
  'menu_visible_featured',
  'menu_visible_seasonal',
  'menu_visible_passport',
  'menu_visible_search',
  'menu_visible_favorites',
  'menu_visible_about',
  'menu_visible_drinks',
  'menu_visible_beans',
  'menu_visible_cakes',
  'menu_visible_branches',
  'menu_visible_faq',
] as const;

const MENU_VISIBILITY_LABELS: Record<string, string> = {
  menu_visible_featured: '⭐ Featured (پیشنهاد ویژه)',
  menu_visible_seasonal: '🌿 Seasonal (مخصوص فصل)',
  menu_visible_passport: '📖 Coffee Passport (پاسپورت قهوه)',
  menu_visible_search: '🔍 Search (جستجو)',
  menu_visible_favorites: '⭐ My Menus (منوهای من)',
  menu_visible_about: '🏠 About Us (درباره ما)',
  menu_visible_drinks: '☕ Drinks (نوشیدنی‌ها)',
  menu_visible_beans: '🌱 Beans (دانه‌های قهوه)',
  menu_visible_cakes: '🍰 Cakes (کیک و کوکی)',
  menu_visible_branches: '📍 Branches (شعب)',
  menu_visible_faq: '❓ FAQ (سوالات متداول)',
};
```

- [ ] **Step 3: Add Menu Visibility card JSX**

Add the new card BEFORE the existing "Bot Settings" card (so it appears at the top of the page). The toggle uses a styled `<button>` that acts as a switch — matching the project's existing pattern of simple HTML controls (no external toggle component library).

```tsx
<div className="card">
  <h2>🔘 Menu Visibility</h2>
  <p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
    Show or hide top-level bot menu sections. Hidden sections show an "unavailable" message to
    users.
  </p>
  <ul className="list">
    {MENU_VISIBILITY_KEYS.map((key) => (
      <li key={key} className="list-item">
        <div className="list-item-info">
          <span>{MENU_VISIBILITY_LABELS[key]}</span>
          <span className="list-item-meta">{menuVis[key] ? '✅ Visible' : '❌ Hidden'}</span>
        </div>
        <div className="list-item-actions">
          <button
            className={menuVis[key] ? 'danger' : 'primary'}
            onClick={() => handleToggleMenuVis(key, !menuVis[key])}
          >
            {menuVis[key] ? 'Hide' : 'Show'}
          </button>
        </div>
      </li>
    ))}
  </ul>
</div>
```

- [ ] **Step 4: Verify admin-app builds**

Run: `cd admin-app && npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/pages/SettingsPage.tsx admin-app/src/api/keys.ts
git commit -m "feat(admin-app): add Menu Visibility card with per-section toggles"
```

---

### Task 3: Verify end-to-end and update docs

**Files:**

- Verify: `npm run typecheck` (root)
- Verify: `npm test` (root)
- Verify: `cd admin-app && npm run build` (admin-app)
- Update: `CLAUDE.md` (optional — document the new feature)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run admin-app build**

Run: `cd admin-app && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Update CLAUDE.md**

In `CLAUDE.md`, under the "Admin REST API" section, add a note about menu visibility:

```markdown
- **Menu visibility**: `menu_visible_*` keys in `settings` table control which top-level bot menu sections are shown. Missing key = visible. Bot reads per-request via `isMenuVisible()` from `src/utils/menuVisibility.ts`. Admin toggles in SettingsPage.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document menu visibility feature in CLAUDE.md"
```

---

## Verification Checklist

1. `npm run typecheck` — no errors
2. `npm test` — all pass
3. `cd admin-app && npm run build` — succeeds
4. Manual test: toggle a section off in Mini App → bot menu shows "unavailable" message for that section → toggle on → it reappears
5. Default behavior: with no `menu_visible_*` keys in settings, all sections visible (safe default)
