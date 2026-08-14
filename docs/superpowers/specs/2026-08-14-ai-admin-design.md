# AI-Powered Admin Panel & Merged Products/Categories

**Date:** 2026-08-14
**Status:** Draft
**Author:** Zahed + Claude

## Overview

Redesign the admin panel to reduce moderation time by:
1. Merging Products and Categories into a single tab with sub-tabs
2. Adding an AI assistant (floating chat) that can execute admin operations via natural language
3. Creating AI-specific backend endpoints with full D1/KV access

## Goals

- **Reduce clicks:** Category-first product editing instead of flat list with filter
- **Natural language control:** "Add 3 seasonal drinks to the Beverages category" → executed
- **Full access:** AI controls D1, KV, website pages, settings — everything
- **Auto-apply:** No approval step — AI makes changes directly
- **No validation:** Skip post-change verification for speed

## Non-Goals

- Cross-unit validation (explicitly skipped per user)
- Approval workflow (auto-apply only)
- AI personality/branding (admin AI is functional, not conversational)

---

## Part 1: Merged Products/Categories Tab

### Current State

Bottom nav has 5 tabs (super_admin):
1. 📦 محصولات (Products) — `/products`
2. 🏷️ دسته‌بندی‌ها (Categories) — `/categories`
3. 📊 آمار و گزارش (Insights) — `/insights`
4. ⚙️ تنظیمات (Configure) — `/configure`
5. ℹ️ اطلاعات (Info) — `/info`

category_admin sees only Products and Categories.

### Proposed Change

**Bottom nav (4 tabs for super_admin, 2 for category_admin):**

| Tab | Route | Icon | Persian |
|-----|-------|------|---------|
| Products & Categories | `/inventory` | 📦 | موجودی |
| Insights | `/insights` | 📊 | آمار و گزارش |
| Configure | `/configure` | ⚙️ | تنظیمات |
| Info | `/info` | ℹ️ | اطلاعات |

**category_admin:** only sees "موجودی" tab.

### Sub-Tab Structure

The `/inventory` route renders a tabbed interface:

```
┌─────────────────────────────────┐
│  [ دسته‌بندی‌ها ]  [ محصولات ]   │  ← sub-tab switcher
├─────────────────────────────────┤
│                                 │
│  (active sub-tab content)       │
│                                 │
└─────────────────────────────────┘
```

**Sub-Tab A: دسته‌بندی‌ها (Categories)**
- Category list with drag-to-reorder
- Create/edit/delete category
- Toggle visibility per category
- Emoji picker for category icon

**Sub-Tab B: محصولات (Products)**
- Category picker at top (dropdown or horizontal scroll chips)
- "همه" (All) option for batch operations across categories
- Filtered product list below the picker
- Same CRUD as current ProductsPage, but scoped to selected category
- Batch operations (move, toggle availability, delete) work with "All" selected

### Route Redirects

Old routes redirect to new structure:
- `/products` → `/inventory?tab=products`
- `/categories` → `/inventory?tab=categories`
- `/inventory` → defaults to `?tab=categories`

### Files to Modify

- `admin-app/src/App.tsx` — merge routes, update nav
- New: `admin-app/src/pages/InventoryPage.tsx` — container with sub-tabs
- Rename/refactor: `admin-app/src/pages/ProductsPage.tsx` → product list component
- Rename/refactor: `admin-app/src/pages/CategoriesPage.tsx` → category list component
- Update: `admin-app/src/index.css` — sub-tab styles, product grid layout

---

## Part 2: AI Admin Assistant

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Admin App (React)                                   │
│  ┌─────────────────┐  ┌───────────────────────────┐  │
│  │  Existing pages  │  │  Floating Chat Button     │  │
│  │  (Products, etc) │  │  ┌─────────────────────┐  │  │
│  │                  │  │  │  Chat Panel          │  │  │
│  │                  │  │  │  - Input field       │  │  │
│  │                  │  │  │  - Message history   │  │  │
│  │                  │  │  │  - Action confirmations│ │  │
│  │                  │  │  └─────────────────────┘  │  │
│  └─────────────────┘  └───────────────────────────┘  │
└──────────────────────────────────────────────────────┘
              │
              │ POST /api/ai/chat
              │ Authorization: Telegram <initData>
              ▼
┌──────────────────────────────────────────────────────┐
│  Worker (Cloudflare)                                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │  /api/ai/chat handler                          │ │
│  │  1. Validate admin auth (super_admin only)      │ │
│  │  2. Call OpenCode API with tool definitions     │ │
│  │  3. Receive tool_call response                  │ │
│  │  4. Execute tool against D1/KV                  │ │
│  │  5. Return result to admin app                  │ │
│  └─────────────────────────────────────────────────┘ │
│              │                                       │
│              ▼                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  D1 Database                                    │ │
│  │  - products, categories, settings, etc.         │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │  KV Cache                                       │ │
│  │  - CacheService (invalidate after changes)      │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Backend Endpoints

#### `POST /api/ai/chat`

**Request:**
```json
{
  "message": "افزودن ۳ نوشیدنی فصلی به دسته نوشیدنی‌ها",
  "conversationId": "optional-conversation-id"
}
```

**Response:**
```json
{
  "reply": "✅ ۳ محصول با موفقیت اضافه شد:\n- آیس کاپوچینو فصلی\n- اسموتی تمشک\n- شیرنعناع گرم",
  "actions": [
    {"type": "createProduct", "result": "success", "details": {...}},
    {"type": "createProduct", "result": "success", "details": {...}},
    {"type": "createProduct", "result": "success", "details": {...}}
  ],
  "conversationId": "conv_abc123"
}
```

#### `GET /api/ai/history`

**Response:**
```json
{
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "actions": [...], "timestamp": "..."}
  ]
}
```

### AI Tool Definitions

The Worker sends these tool definitions to OpenCode API:

```typescript
const AI_TOOLS = [
  {
    name: "createProduct",
    description: "Create a new product in the database",
    parameters: {
      name: "string (required)",
      categoryId: "number (required)",
      price: "number (optional)",
      stock: "number (optional, default 0)",
      unit: "string (item|cup|kg|g|slice|piece)",
      description: "string (optional)",
      available: "boolean (optional, default true)",
      featured: "boolean (optional, default false)",
      isSeasonal: "boolean (optional, default false)",
      priceOnRequest: "boolean (optional, default false)",
      imageUrl: "string (optional, URL format)",
      sizeOptions: "string[] (optional)",
      syrupOptions: "string[] (optional)",
      coffeeDetails: "object (optional, for coffee beans)",
      calories: "number (optional)",
      allergens: "string (optional)",
      caffeineMg: "number (optional)"
    }
  },
  {
    name: "updateProduct",
    description: "Update an existing product",
    parameters: {
      id: "number (required)",
      ...same fields as createProduct, all optional
    }
  },
  {
    name: "deleteProduct",
    description: "Delete a product by ID",
    parameters: { id: "number (required)" }
  },
  {
    name: "batchUpdateProducts",
    description: "Update multiple products at once",
    parameters: {
      ids: "number[] (required)",
      action: "update|delete",
      updateData: "object (optional, fields to update)"
    }
  },
  {
    name: "createCategory",
    description: "Create a new category",
    parameters: {
      name: "string (required)",
      emoji: "string (optional)",
      description: "string (optional)",
      sortOrder: "number (optional)"
    }
  },
  {
    name: "updateCategory",
    description: "Update an existing category",
    parameters: {
      id: "number (required)",
      ...same fields as createCategory, all optional
    }
  },
  {
    name: "deleteCategory",
    description: "Delete a category by ID",
    parameters: { id: "number (required)" }
  },
  {
    name: "reorderCategories",
    description: "Reorder categories",
    parameters: {
      orderedIds: "number[] (required, new order)"
    }
  },
  {
    name: "updateSetting",
    description: "Update a setting value",
    parameters: {
      key: "string (required)",
      value: "string (required)"
    }
  },
  {
    name: "getSettings",
    description: "Get current settings",
    parameters: {
      keys: "string[] (optional, specific keys to fetch)"
    }
  },
  {
    name: "updateMenuConfig",
    description: "Update menu configuration for a category",
    parameters: {
      categoryId: "number (required)",
      menuSection: "string (optional)",
      displayOrder: "number (optional)",
      isVisible: "boolean (optional)",
      buttonLabel: "string (optional)",
      specialMessage: "string (optional)"
    }
  },
  {
    name: "reorderMenuConfig",
    description: "Reorder menu configuration items",
    parameters: {
      orderedIds: "number[] (required)"
    }
  },
  {
    name: "invalidateCache",
    description: "Invalidate KV cache for specific resources",
    parameters: {
      prefix: "string (products|categories|settings|menu-config|all)"
    }
  },
  {
    name: "queryD1",
    description: "Execute a read-only SQL query against D1",
    parameters: {
      sql: "string (required, SELECT only)",
      params: "string[] (optional)"
    }
  }
];
```

### AI System Prompt (Admin)

```
You are an AI admin assistant for Azadi Coffee Roastery (روستری قهوه آزادی).

## Your Role
You execute admin operations via natural language commands. You are direct, efficient, and action-oriented.

## Language
- Reply in the SAME language the admin uses (Persian/Farsi or English)
- Use Persian digits (۰۱۲۳۴۵۶۷۸۹) for prices and numbers in Persian replies
- Keep responses concise — confirm what you did, not what you think

## Tool Usage Rules
1. ALWAYS use tools to make changes — never just describe what to do
2. If a command is ambiguous, ask for clarification before acting
3. For destructive operations (delete), confirm with the admin first
4. Batch operations are preferred over individual operations when multiple items are involved
5. After executing, return a clear summary of what was done

## Available Tools
- createProduct, updateProduct, deleteProduct, batchUpdateProducts
- createCategory, updateCategory, deleteCategory, reorderCategories
- updateSetting, getSettings
- updateMenuConfig, reorderMenuConfig
- invalidateCache
- queryD1 (read-only)

## Constraints
- Only super_admin has access to this assistant
- All changes are applied directly — no approval step
- No post-change validation is performed
- Prices are in Tomans (تومان)
- Product units: item, cup, kg, g, slice, piece
- Categories can have emoji icons
- Menu visibility is controlled by menu_config settings

## Examples
- "افزودن ۳ نوشیدنی فصلی" → create 3 products with isSeasonal: true
- "افزایش قیمت تمام قهوه‌ها ۱۵٪" → batch update price field for coffee products
- "مخفی کردن دسته شیرینی از منو" → updateMenuConfig for bakery category, isVisible: false
- "نمایش محصولات تمام‌شده" → queryD1 SELECT where stock = 0
```

### Auth Flow

1. Admin opens chat panel → app sends `GET /api/ai/history` to load previous messages
2. Admin types command → app sends `POST /api/ai/chat` with `{message, conversationId}`
3. Worker validates `Authorization: Telegram <initData>` against `admins` table
4. Worker checks `role === 'super_admin'` — reject if not
5. Worker calls OpenCode API with tool definitions + admin's message
6. If AI responds with tool_call → execute against D1/KV
7. Return result to admin app with action confirmations

### Chat Panel UI

```
┌─────────────────────────────────┐
│  دستیار هوش مصنوعی          ✕  │  ← header with close button
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │  👤 افزودن ۲ محصول قهوه  │  │  ← user message
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  🤖 ✅ ۲ محصول اضافه شد:  │  │  ← AI response
│  │  - اسپرسو دابل            │  │
│  │  - کاپوچینو ویژه          │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  👤 قیمت‌ها رو ۱۰٪ ببر بالا│ │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  🤖 ✅ ۱۵ محصول به‌روز     │  │
│  │  شد. میانگین قیمت جدید:   │  │
│  │  ۸۵,۰۰۰ تومان           │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  پیام خود را بنویسید...    📤  │  ← input field
└─────────────────────────────────┘
```

**Position:** Fixed bottom-left, `z-index: 1000`, above bottom nav.
**Trigger:** Floating action button (🤖 icon), expand on click.
**Style:** Match existing admin app card styles, RTL layout.

### Files to Create/Modify

**New files:**
- `src/api/ai/chat.ts` — AI chat handler
- `src/api/ai/tools.ts` — tool definitions and execution
- `src/api/ai/types.ts` — AI-specific types
- `admin-app/src/components/ChatPanel.tsx` — chat UI component
- `admin-app/src/components/ChatButton.tsx` — floating action button
- `admin-app/src/hooks/useAIChat.ts` — chat state management

**Modified files:**
- `src/api/router.ts` — add `/api/ai/*` routes
- `admin-app/src/App.tsx` — add ChatButton component

---

## Part 3: KV Cache Invalidation

After AI executes operations, it should invalidate relevant caches:

```typescript
// After product changes
await cacheService.deleteByPrefix('products');

// After category changes
await cacheService.deleteByPrefix('categories');
await cacheService.deleteByPrefix('menu-config');

// After setting changes
await cacheService.deleteByPrefix('settings');

// After menu config changes
await cacheService.deleteByPrefix('menu-config');
```

This ensures the bot and menu website see fresh data.

---

## Implementation Order

1. **Phase 1: Merged Products/Categories tab** (no AI)
   - Create InventoryPage with sub-tabs
   - Refactor ProductsPage and CategoriesPage into components
   - Update routing and navigation
   - Add category picker to products sub-tab

2. **Phase 2: AI Backend**
   - Add `/api/ai/*` endpoints
   - Implement tool definitions
   - Add tool execution logic
   - Test with curl/Postman

3. **Phase 3: AI Frontend**
   - Create ChatPanel component
   - Create ChatButton component
   - Add useAIChat hook
   - Integrate with backend

4. **Phase 4: Polish**
   - Error handling
   - Loading states
   - Chat history persistence
   - Mobile responsiveness

---

## Testing

- **Unit tests:** AI tool execution functions
- **Integration tests:** `/api/ai/chat` endpoint with mock OpenCode API
- **E2E tests:** Manual testing of chat panel interactions
- **Regression:** Verify existing admin functionality unchanged

---

## Open Questions

1. **Conversation persistence:** Should chat history persist across sessions, or reset on page reload? (Recommend: persist for context)
2. **Rate limiting:** Should there be rate limits on AI chat requests? (Recommend: yes, to prevent abuse)
3. **Token limits:** OpenCode API has token limits — should we truncate long conversations? (Recommend: keep last 20 messages)
4. **Error handling:** What happens if AI responds with invalid tool calls? (Recommend: retry once, then return error to admin)
