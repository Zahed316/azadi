# Admin App UI/UX Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken components (MessagesPage, clone modal, special-msg-form), establish z-index tiers, fix chat/nav overlap, replace hardcoded colors, and add responsive breakpoints in the admin mini app.

**Architecture:** All changes are CSS-only or minimal JSX inline-style → className swaps. No new components, no new dependencies, no API changes. Each task produces a working, visually verifiable state.

**Tech Stack:** CSS custom properties, vanilla CSS, React 18 inline styles → className migration

**Spec:** This plan implements fixes from the UI/UX audit conducted 2026-08-16. The audit identified missing CSS classes (3 components unstyled), z-index collisions (3 overlays at 2000), chat/nav overlap, hardcoded dark-mode-breaking colors, and missing responsive breakpoints.

## Global Constraints

- `admin-app/` is a separate package with its own `node_modules` — run `npm install` inside it independently
- All bot/UI text is Persian (Farsi) with HTML parse mode
- Run `npm run check` (typecheck + lint + format:check) from `admin-app/` before committing
- The `.prettierrc.json` at repo root governs formatting
- No new dependencies — CSS-only fixes
- `@tma.js/sdk` stateful singletons require `mount()`/`unmount()` — don't touch SDK usage in this plan

---

### Task 1: Add Missing CSS Classes for MessagesPage

**Files:**

- Modify: `admin-app/src/index.css` (append after line 1990)

**Interfaces:**

- Consumes: None (standalone CSS addition)
- Produces: Styles for `.page`, `.page-header`, `.back-btn`, `.messages-list`, `.message-item`, `.message-header`, `.message-footer`, `.sender`, `.date`, `.rating`, `.content`, `.preview`, `.reply-section`, `.reply-date`, `.reply-form`, `.filter-tabs`, `.badge`, `.status`, `.btn-primary`

- [ ] **Step 1: Append MessagesPage CSS to index.css**

Add the following block at the end of `admin-app/src/index.css` (after line 1990):

```css
/* ------------------------------------------------------------------ */
/* MessagesPage                                                        */
/* ------------------------------------------------------------------ */

.messages-page .page,
.page {
  /* no extra layout needed — cards handle spacing */
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0;
}

.back-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 6px 14px;
  font-size: 13px;
  width: auto;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.05);
  transform: none;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: var(--danger);
  color: #fff;
}

.filter-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border);
  margin-bottom: 16px;
}

.filter-tabs button {
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  width: auto;
}

.filter-tabs button.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  cursor: pointer;
  text-align: right;
  transition: border-color 0.15s ease;
}

.message-item:hover {
  border-color: var(--primary);
}

.message-item.unread {
  border-color: var(--primary);
  background: rgba(79, 70, 229, 0.05);
}

.message-item.replied {
  opacity: 0.7;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sender {
  font-weight: 600;
  font-size: 14px;
}

.date {
  font-size: 12px;
  color: var(--text-muted);
}

.preview {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-footer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rating {
  font-size: 12px;
}

.status {
  font-size: 12px;
  font-weight: 500;
}

.status.replied {
  color: var(--success);
}

.status.unread {
  color: var(--primary);
}

.message-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.content {
  font-size: 15px;
  line-height: 1.6;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.reply-section {
  padding: 12px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 10px;
}

.reply-section h4 {
  margin: 0 0 8px;
}

.reply-date {
  font-size: 12px;
  color: var(--text-muted);
}

.reply-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reply-form textarea {
  resize: vertical;
  min-height: 80px;
}

.btn-primary {
  /* already handled by global button styles — just ensure width: auto */
  width: auto;
}
```

- [ ] **Step 2: Verify CSS compiles without errors**

Run: `cd admin-app && npm run format:check`
Expected: PASS (or prettier auto-fixable issues only)

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/index.css
git commit -m "fix(admin-app): add missing MessagesPage CSS classes

MessagesPage used 21 CSS classes with no definitions — the entire
page rendered unstyled. Adds layout, typography, filter tabs,
message list, detail view, reply form, and status badge styles."
```

---

### Task 2: Add Missing CSS for Clone Modal and Special Message Form

**Files:**

- Modify: `admin-app/src/index.css` (append after Task 1's additions)

**Interfaces:**

- Consumes: None (standalone CSS addition)
- Produces: Styles for `.overlay`, `.branch-picker-modal`, `.branch-list`, `.branch-option`, `.special-msg-form`, `.section-tabs`, `.tab`

- [ ] **Step 1: Append clone modal and special-msg-form CSS**

Add the following block at the end of `admin-app/src/index.css`:

```css
/* ------------------------------------------------------------------ */
/* Clone branch modal (InventoryList)                                  */
/* ------------------------------------------------------------------ */

.overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.branch-picker-modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  width: calc(100% - 32px);
  max-width: 360px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.branch-picker-modal h3 {
  margin: 0 0 16px;
  font-size: 16px;
}

.branch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.branch-option {
  padding: 10px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: none;
  color: var(--text-main);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
  text-align: right;
}

.branch-option:hover {
  background: rgba(79, 70, 229, 0.08);
  border-color: var(--primary);
}

/* ------------------------------------------------------------------ */
/* Special message / button label form (MenuConfigPage)                */
/* ------------------------------------------------------------------ */

.special-msg-form {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.03);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ------------------------------------------------------------------ */
/* Section tabs (MenuConfigPage)                                       */
/* ------------------------------------------------------------------ */

.section-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border);
  margin-bottom: 16px;
  overflow-x: auto;
  scrollbar-width: none;
}

.section-tabs::-webkit-scrollbar {
  display: none;
}

.section-tabs .tab {
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
  width: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

.section-tabs .tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}

.section-tabs .tab:hover:not(.active) {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.05);
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `cd admin-app && npm run format:check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/index.css
git commit -m "fix(admin-app): add missing clone modal and special-msg-form CSS

InventoryList clone modal used .overlay, .branch-picker-modal,
.branch-list, .branch-option — none defined. MenuConfigPage used
.special-msg-form and .section-tabs — also undefined. All three
features rendered unstyled."
```

---

### Task 3: Establish Z-Index Tiers

**Files:**

- Modify: `admin-app/src/index.css` (multiple existing selectors)

**Interfaces:**

- Consumes: None
- Produces: Consistent z-index layering across all overlays

Current z-index map (broken — 3 things at 2000):

| Element                     | Current | New              |
| --------------------------- | ------- | ---------------- |
| `.branch-selector`          | 50      | 50 (unchanged)   |
| `.branch-selector-dropdown` | 60      | 60 (unchanged)   |
| `.inline-stock-menu`        | 100     | 100 (unchanged)  |
| `.batch-bar`                | 999     | 900              |
| `.bottom-nav`               | 1000    | 1000 (unchanged) |
| `.toast`                    | 1100    | 1100 (unchanged) |
| `.chat-overlay`             | 1500    | 1500 (unchanged) |
| `.chat-fab-panel`           | 1501    | 1501 (unchanged) |
| `.chat-fab`                 | 1502    | 1502 (unchanged) |
| `.drawer-overlay`           | 2000    | 2000             |
| `.counter-search-overlay`   | 2000    | 2200             |
| `.confirm-backdrop`         | 2000    | 3000             |
| `.overlay` (clone modal)    | (new)   | 2500             |

- [ ] **Step 1: Change `.counter-search-overlay` z-index from 2000 to 2200**

In `admin-app/src/index.css`, find the `.counter-search-overlay` rule (around line 1754) and change `z-index: 2000` to `z-index: 2200`.

- [ ] **Step 2: Change `.confirm-backdrop` z-index from 2000 to 3000**

In `admin-app/src/index.css`, find the `.confirm-backdrop` rule (around line 465) and change `z-index: 2000` to `z-index: 3000`.

- [ ] **Step 3: Change `.batch-bar` z-index from 999 to 900**

In `admin-app/src/index.css`, find the `.batch-bar` rule (around line 263) and change `z-index: 999` to `z-index: 900`.

- [ ] **Step 4: Verify no z-index collisions remain**

Run: `grep -n 'z-index' admin-app/src/index.css`
Expected: No duplicate values among overlay elements. The only potential collision is `.drawer-overlay` at 2000 — this is intentional (only one drawer open at a time).

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/index.css
git commit -m "fix(admin-app): establish z-index tiers to prevent overlay collisions

Three overlays (confirm, drawer, search) shared z-index: 2000 —
whichever rendered last won. Establishes distinct tiers:
confirm=3000, clone=2500, search=2200, drawer=2000, chat=1500,
nav=1000, batch=900."
```

---

### Task 4: Fix ChatPanel / Bottom-Nav Overlap

**Files:**

- Modify: `admin-app/src/App.tsx:181-185`
- Modify: `admin-app/src/index.css` (add `.chat-panel-wrapper` style)

**Interfaces:**

- Consumes: `ChatPanel` component (existing)
- Produces: Chat renders in a fixed overlay instead of inline document flow

The current code renders `ChatPanel` inside `.container` (normal flow), but `.bottom-nav` is `position: fixed` at z-index 1000. The nav floats over the chat input area. Fix: wrap ChatPanel in a fixed-position container that sits above the nav.

- [ ] **Step 1: Add `.chat-panel-wrapper` CSS**

Append to `admin-app/src/index.css`:

```css
/* ------------------------------------------------------------------ */
/* ChatPanel wrapper — fixed overlay above bottom nav                  */
/* ------------------------------------------------------------------ */

.chat-panel-wrapper {
  position: fixed;
  inset: 0;
  bottom: 60px; /* leave room for bottom nav */
  z-index: 1050; /* above nav (1000), below chat FAB panel (1501) */
  display: flex;
  flex-direction: column;
  background: var(--bg-dark);
}

@media (max-height: 500px) {
  .chat-panel-wrapper {
    bottom: 0;
  }
}
```

- [ ] **Step 2: Update App.tsx to wrap ChatPanel**

In `admin-app/src/App.tsx`, replace lines 181-185:

```tsx
{
  isChatOpen && (
    <Suspense fallback={null}>
      <ChatPanel onClose={closeChat} />
    </Suspense>
  );
}
```

With:

```tsx
{
  isChatOpen && (
    <div className="chat-panel-wrapper">
      <Suspense fallback={null}>
        <ChatPanel onClose={closeChat} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Update `.chat-panel` height in CSS**

In `admin-app/src/index.css`, find the `.chat-panel` rule (around line 842) and change:

```css
.chat-panel {
  height: calc(100vh - 160px);
  min-height: 300px;
}
```

To:

```css
.chat-panel {
  height: 100%;
  min-height: 0;
}
```

The wrapper now controls sizing. The chat panel fills its parent.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/App.tsx admin-app/src/index.css
git commit -m "fix(admin-app): fix chat panel overlapping bottom navigation

ChatPanel rendered inside .container (document flow) while
.bottom-nav was position:fixed — the nav floated over the chat
input. Wraps ChatPanel in a fixed overlay (.chat-panel-wrapper)
that sits above the nav bar."
```

---

### Task 5: Replace Hardcoded Colors with CSS Variables

**Files:**

- Modify: `admin-app/src/pages/AILogsPage.tsx` (inline styles → className or var())
- Modify: `admin-app/src/pages/AITestPage.tsx` (inline styles → className or var())
- Modify: `admin-app/src/pages/MenuConfigPage.tsx` (inline style color)
- Modify: `admin-app/src/pages/SettingsForm.tsx` (inline style color)
- Modify: `admin-app/src/index.css` (add utility classes)

**Interfaces:**

- Consumes: CSS custom properties `--text-muted`, `--text-main`
- Produces: All text colors use CSS variables, dark mode works

- [ ] **Step 1: Add utility classes for muted text**

Append to `admin-app/src/index.css`:

```css
/* ------------------------------------------------------------------ */
/* Utility classes for text styling (replaces inline color styles)     */
/* ------------------------------------------------------------------ */

.text-muted {
  color: var(--text-muted);
}

.text-sm {
  font-size: 0.85em;
}

.text-xs {
  font-size: 0.75em;
}

.mt-2 {
  margin-top: 2px;
}

.mt-4 {
  margin-top: 4px;
}

.mb-8 {
  margin-bottom: 8px;
}
```

- [ ] **Step 2: Fix AILogsPage.tsx inline styles**

In `admin-app/src/pages/AILogsPage.tsx`, replace line 72:

```tsx
<div style={{ fontSize: '0.85em', color: '#888' }}>
```

With:

```tsx
<div className="text-sm text-muted">
```

Replace line 75:

```tsx
<div style={{ fontSize: '0.85em', marginTop: 4 }}>
```

With:

```tsx
<div className="text-sm mt-4">
```

- [ ] **Step 3: Fix AITestPage.tsx inline styles**

In `admin-app/src/pages/AITestPage.tsx`, replace line 35:

```tsx
<p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
```

With:

```tsx
<p className="text-sm text-muted mb-8">
```

Replace line 71:

```tsx
<div style={{ fontSize: '0.75em', color: '#aaa', marginTop: 2 }}>
```

With:

```tsx
<div className="text-xs text-muted mt-2">
```

- [ ] **Step 4: Fix MenuConfigPage.tsx inline style**

In `admin-app/src/pages/MenuConfigPage.tsx`, replace line 169:

```tsx
<p style={{ fontSize: '0.85em', color: '#888', marginBottom: 12 }}>
```

With:

```tsx
<p className="text-sm text-muted" style={{ marginBottom: 12 }}>
```

- [ ] **Step 5: Fix SettingsForm.tsx inline style**

In `admin-app/src/pages/SettingsForm.tsx`, replace line 164:

```tsx
<p style={{ fontSize: '0.85em', color: '#888', marginBottom: 8 }}>
```

With:

```tsx
<p className="text-sm text-muted mb-8">
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add admin-app/src/pages/AILogsPage.tsx admin-app/src/pages/AITestPage.tsx \
        admin-app/src/pages/MenuConfigPage.tsx admin-app/src/pages/SettingsForm.tsx \
        admin-app/src/index.css
git commit -m "fix(admin-app): replace hardcoded colors with CSS variables

AILogsPage, AITestPage, MenuConfigPage, SettingsForm used hardcoded
#888/#aaa colors in inline styles — invisible in dark mode. Replaces
with .text-muted utility class that uses var(--text-muted)."
```

---

### Task 6: Add Responsive Breakpoints

**Files:**

- Modify: `admin-app/src/index.css`

**Interfaces:**

- Consumes: Existing CSS custom properties
- Produces: Layout adapts to tablet (768px) and small phone (360px) screens

- [ ] **Step 1: Add tablet breakpoint**

Append to `admin-app/src/index.css`:

```css
/* ------------------------------------------------------------------ */
/* Responsive — tablet and wider                                       */
/* ------------------------------------------------------------------ */

@media (min-width: 768px) {
  .container {
    max-width: 720px;
    padding: 24px;
    padding-bottom: 80px;
  }

  .chat-fab-panel {
    max-width: 480px;
    left: 50%;
    transform: translateX(-50%) translateY(100%);
  }

  .chat-fab-panel--open {
    transform: translateX(-50%) translateY(0);
  }

  .drawer-panel {
    max-width: 520px;
  }

  .counter-search-dialog {
    max-width: 480px;
  }
}
```

- [ ] **Step 2: Add small-phone breakpoint (320px-360px)**

Append to `admin-app/src/index.css`:

```css
/* ------------------------------------------------------------------ */
/* Responsive — very small phones (320px–360px)                        */
/* ------------------------------------------------------------------ */

@media (max-width: 360px) {
  .container {
    padding: 12px;
    padding-bottom: 80px;
  }

  .card {
    padding: 14px;
    border-radius: 12px;
    margin-bottom: 12px;
  }

  .card h2 {
    font-size: 16px;
  }

  .nav-item {
    font-size: 11px;
    padding: 6px 2px;
  }

  .nav-icon {
    font-size: 16px;
  }

  .category-picker {
    gap: 6px;
  }

  .category-chip {
    padding: 6px 12px;
    font-size: 12px;
  }

  .sub-tab {
    padding: 10px 8px;
    font-size: 13px;
  }

  .empty-state {
    padding: 32px 16px;
  }

  .empty-state-emoji {
    font-size: 48px;
  }

  .empty-state-title {
    font-size: 14px;
  }

  .empty-state-subtitle {
    font-size: 13px;
  }

  .product-item {
    flex-wrap: wrap;
  }

  .product-item .list-item-actions {
    width: 100%;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .chat-fab {
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    font-size: 20px;
    bottom: 70px;
  }
}
```

- [ ] **Step 3: Verify CSS compiles**

Run: `cd admin-app && npm run format:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/index.css
git commit -m "feat(admin-app): add responsive breakpoints for tablet and small phone

Only had max-width: 360px. Adds min-width: 768px tablet breakpoint
(wider container, centered chat panel, larger drawer) and refines
360px breakpoint with tighter padding, smaller nav items, and
wrapped product items."
```

---

### Task 7: Fix Chat Panel Height for Dynamic Viewport

**Files:**

- Modify: `admin-app/src/index.css` (`.chat-panel-wrapper` from Task 4)

**Interfaces:**

- Consumes: `.chat-panel-wrapper` from Task 4
- Produces: Chat panel adapts to mobile browser chrome changes

- [ ] **Step 1: Update `.chat-panel-wrapper` to use `dvh`**

In `admin-app/src/index.css`, find the `.chat-panel-wrapper` rule added in Task 4 and update it:

```css
.chat-panel-wrapper {
  position: fixed;
  inset: 0;
  bottom: 60px;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  background: var(--bg-dark);
  /* Use dynamic viewport height when available, fall back to fixed */
  height: calc(100dvh - 60px);
  height: calc(100svh - 60px); /* Safari fallback */
}

@media (max-height: 500px) {
  .chat-panel-wrapper {
    bottom: 0;
    height: 100dvh;
    height: 100svh;
  }
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `cd admin-app && npm run format:check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/index.css
git commit -m "fix(admin-app): use dvh for chat panel height on mobile

calc(100vh - 160px) used fixed vh which doesn't account for
mobile browser chrome (Safari address bar). Uses dvh (dynamic
viewport height) with svh fallback for Safari."
```

---

### Task 8: Add viewport-fit=cover and Remove Redundant Inline Style

**Files:**

- Modify: `admin-app/index.html`
- Modify: `admin-app/src/App.tsx`

**Interfaces:**

- Consumes: None
- Produces: Proper iOS notch handling, cleaned up App.tsx

- [ ] **Step 1: Add viewport-fit=cover to index.html**

In `admin-app/index.html`, replace line 5:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

With:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 2: Remove redundant inline paddingBottom from App.tsx**

In `admin-app/src/App.tsx`, replace line 78:

```tsx
        <div className="container" style={{ paddingBottom: '80px' }}>
```

With:

```tsx
        <div className="container">
```

The `.container` class in `index.css` already sets `padding-bottom: 80px`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add admin-app/index.html admin-app/src/App.tsx
git commit -m "fix(admin-app): add viewport-fit=cover and remove redundant inline style

Missing viewport-fit=cover caused blank strips on notched iPhones.
App.tsx had redundant paddingBottom: '80px' inline style already
set by .container CSS class."
```

---

### Task 9: Run Full Check and Final Verification

**Files:**

- None (verification only)

**Interfaces:**

- Consumes: All previous tasks
- Produces: Green CI pipeline

- [ ] **Step 1: Run full check**

Run: `cd admin-app && npm run check`
Expected: PASS (typecheck + lint + format:check + test)

- [ ] **Step 2: Fix any prettier/format issues**

Run: `cd admin-app && npm run format`
Then: `cd admin-app && npm run check`

- [ ] **Step 3: Final commit if format fixes needed**

```bash
git add -A admin-app/
git commit -m "chore(admin-app): format after UI/UX audit fixes"
```
