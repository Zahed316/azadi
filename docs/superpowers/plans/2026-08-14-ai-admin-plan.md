# AI-Powered Admin Panel & Merged Products/Categories

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Products and Categories into one tab, add AI assistant with full D1/KV access for natural language admin operations.

**Architecture:** Two-phase build: (1) frontend merge of Products+Categories into a single Inventory tab with sub-tabs, (2) backend AI endpoints with tool-use loop calling OpenCode API, (3) frontend chat panel with floating action button.

**Tech Stack:** React 18 + Vite + @telegram-apps/sdk v2 + TanStack Query v5 (admin-app), Cloudflare Workers + D1 + KV + Drizzle ORM (backend), OpenCode API (`mimo-v2.5`)

## Global Constraints

- Persian (Farsi) for all user-facing text, HTML parse mode in bot, `dir="auto"` on Persian data fields
- Price unit from `settings.price_unit` with fallback `تومان`
- All bot text uses `toPersianDigits()` and `formatPersianPrice()` from `src/utils/numbers.ts`
- Admin auth: `Authorization: Telegram <initData>` header, validated via `validateInitData`
- Only `super_admin` role gets AI assistant access
- Toast notifications via `showToast()` (never `alert()`)
- Form fields wrapped in `<Field label>` component
- Empty states use `EmptyState` component
- RTL layout (`dir="rtl"`) throughout admin app
- ESLint + Prettier blocking in CI — run `npm run check` before commits

---

## Phase 1: Merged Products/Categories Tab

### Task 1: Create InventoryPage Container

**Files:**
- Create: `admin-app/src/pages/InventoryPage.tsx`
- Modify: `admin-app/src/App.tsx:70-71` (routes)
- Modify: `admin-app/src/App.tsx:101-141` (bottom nav)

**Interfaces:**
- Consumes: `useAppContext()` from `admin-app/src/AppContext.tsx`
- Produces: Renders `<CategoriesSubTab />` or `<ProductsSubTab />` based on active sub-tab

- [ ] **Step 1: Create InventoryPage with sub-tab state**

```tsx
// admin-app/src/pages/InventoryPage.tsx
import { useState } from 'react';
import CategoriesSubTab from '../components/CategoriesSubTab';
import ProductsSubTab from '../components/ProductsSubTab';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'categories' | 'products'>('categories');

  return (
    <>
      <div className="sub-tab-switcher" role="tablist" aria-label="موجودی">
        <button
          role="tab"
          aria-selected={activeTab === 'categories'}
          className={`sub-tab ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          🏷️ دسته‌بندی‌ها
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'products'}
          className={`sub-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          📦 محصولات
        </button>
      </div>
      {activeTab === 'categories' ? <CategoriesSubTab /> : <ProductsSubTab />}
    </>
  );
}
```

- [ ] **Step 2: Add sub-tab CSS styles**

```css
/* admin-app/src/index.css - add to existing styles */
.sub-tab-switcher {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--border);
  margin-bottom: 16px;
}

.sub-tab {
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}

.sub-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
  font-weight: 600;
}

.sub-tab:hover:not(.active) {
  color: var(--text-primary);
  background: var(--hover-bg);
}
```

- [ ] **Step 3: Update routes in App.tsx**

```tsx
// admin-app/src/App.tsx - replace lines 70-71
const InventoryPage = lazy(() => import('./pages/InventoryPage'));

// In Routes:
<Route path="/inventory" element={<InventoryPage />} />
<Route path="/products" element={<Navigate to="/inventory?tab=products" replace />} />
<Route path="/categories" element={<Navigate to="/inventory?tab=categories" replace />} />
```

- [ ] **Step 4: Update bottom nav**

```tsx
// admin-app/src/App.tsx - replace lines 108-115
<NavLink
  to="/inventory"
  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
  onClick={scrollToTop}
>
  <span className="nav-icon">📦</span>موجودی
</NavLink>
```

- [ ] **Step 5: Run typecheck and lint**

```bash
cd admin-app && npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add admin-app/src/pages/InventoryPage.tsx admin-app/src/App.tsx admin-app/src/index.css
git commit -m "feat: create InventoryPage container with sub-tab switcher"
```

---

### Task 2: Extract CategoriesSubTab Component

**Files:**
- Create: `admin-app/src/components/CategoriesSubTab.tsx`
- Extract from: `admin-app/src/pages/CategoriesPage.tsx`

**Interfaces:**
- Consumes: `useAppContext()`, `queryKeys`, `apiFetch`, `CategoriesResponse`
- Produces: Renders category list with CRUD operations

- [ ] **Step 1: Create CategoriesSubTab by extracting from CategoriesPage**

```tsx
// admin-app/src/components/CategoriesSubTab.tsx
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { CategoriesResponse, Category } from '../api/types';
import { useAppContext } from '../AppContext';
import Field from './Field';
import EmptyState from './EmptyState';

export default function CategoriesSubTab() {
  const { setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoriesResponse>('/categories').then((r) => r.categories),
  });

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('');

  const saveCategoryMutation = useMutation({
    mutationFn: (data: { method: string; id?: number; body: Record<string, unknown> }) =>
      apiFetch(data.id ? `/categories/${data.id}` : '/categories', {
        method: data.method,
        body: data.body,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      resetCategoryForm();
      showToast(variables.id ? 'دسته‌بندی به‌روزرسانی شد ✓' : 'دسته‌بندی اضافه شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      showToast('دسته‌بندی حذف شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    saveCategoryMutation.mutate({
      method: editingCategory ? 'PUT' : 'POST',
      id: editingCategory?.id,
      body: {
        name: catName,
        emoji: catEmoji || null,
        description: catDesc || null,
        sortOrder: catSortOrder ? parseInt(catSortOrder) : null,
      },
    });
  };

  const startEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCatName(c.name);
    setCatEmoji(c.emoji || '');
    setCatDesc(c.description || '');
    setCatSortOrder(c.sortOrder?.toString() || '');
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCatName('');
    setCatEmoji('');
    setCatDesc('');
    setCatSortOrder('');
  };

  const deleteCategory = async (id: number) => {
    if (!(await confirm('مطمئن هستید این دسته‌بندی حذف شود؟'))) return;
    deleteCategoryMutation.mutate(id);
  };

  if (isLoading) return <div className="spinner" />;

  return (
    <>
      <div className="card">
        <h2>{editingCategory ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی'}</h2>
        <form onSubmit={handleSaveCategory}>
          <Field label="نام">
            <input value={catName} onChange={(e) => setCatName(e.target.value)} required />
          </Field>
          <Field label="ایموجی">
            <input
              value={catEmoji}
              onChange={(e) => setCatEmoji(e.target.value)}
              placeholder="☕"
              dir="auto"
            />
          </Field>
          <Field label="توضیحات">
            <textarea value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
          </Field>
          <Field label="ترتیب نمایش">
            <input
              type="number"
              value={catSortOrder}
              onChange={(e) => setCatSortOrder(e.target.value)}
            />
          </Field>
          <div className="flex gap-sm">
            <button type="submit" className="btn-primary">
              {editingCategory ? 'ذخیره' : 'افزودن'}
            </button>
            {editingCategory && (
              <button type="button" className="btn-ghost" onClick={resetCategoryForm}>
                لغو
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>لیست دسته‌بندی‌ها</h2>
        {categories.length === 0 ? (
          <EmptyState message="دسته‌بندی‌ای وجود ندارد" />
        ) : (
          <div className="category-list">
            {categories.map((c) => (
              <div key={c.id} className="category-item">
                <span className="category-emoji">{c.emoji || '📁'}</span>
                <div className="category-info">
                  <strong>{c.name}</strong>
                  {c.description && <p className="text-secondary">{c.description}</p>}
                </div>
                <div className="category-actions">
                  <button className="btn-ghost" onClick={() => startEditCategory(c)}>
                    ✏️
                  </button>
                  <button className="btn-ghost danger" onClick={() => void deleteCategory(c.id)}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add category list styles**

```css
/* admin-app/src/index.css - add to existing styles */
.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.category-emoji {
  font-size: 24px;
}

.category-info {
  flex: 1;
}

.category-info strong {
  display: block;
  margin-bottom: 4px;
}

.category-actions {
  display: flex;
  gap: 4px;
}
```

- [ ] **Step 3: Run typecheck and lint**

```bash
cd admin-app && npm run typecheck && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/components/CategoriesSubTab.tsx admin-app/src/index.css
git commit -m "feat: extract CategoriesSubTab component"
```

---

### Task 3: Extract ProductsSubTab Component with Category Picker

**Files:**
- Create: `admin-app/src/components/ProductsSubTab.tsx`
- Extract from: `admin-app/src/pages/ProductsPage.tsx`

**Interfaces:**
- Consumes: `useAppContext()`, `queryKeys`, `apiFetch`, `ProductsResponse`, `CategoriesResponse`
- Produces: Category picker + filtered product list with CRUD

- [ ] **Step 1: Create ProductsSubTab with category picker**

```tsx
// admin-app/src/components/ProductsSubTab.tsx
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { queryKeys } from '../api/keys';
import type { ProductsResponse, CategoriesResponse, ProductRow } from '../api/types';
import { useAppContext } from '../AppContext';
import Field from './Field';
import EmptyState from './EmptyState';

export default function ProductsSubTab() {
  const { isSuperAdmin, allowedCatId, setError, showToast, confirm } = useAppContext();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => apiFetch<ProductsResponse>('/products').then((r) => r.products),
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => apiFetch<CategoriesResponse>('/categories').then((r) => r.categories),
  });

  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  // Form state (simplified - full form in original ProductsPage)
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodCatId, setProdCatId] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodUnit, setProdUnit] = useState('item');

  // Batch selection
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  // Filter products by selected category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = !selectedCatId || p.categoryId?.toString() === selectedCatId;
      const matchesSearch = !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCatId, searchQuery]);

  const saveProductMutation = useMutation({
    mutationFn: (data: { method: string; id?: number; body: Record<string, unknown> }) =>
      apiFetch(data.id ? `/products/${data.id}` : '/products', {
        method: data.method,
        body: data.body,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      resetProductForm();
      showToast(variables.id ? 'محصول به‌روزرسانی شد ✓' : 'محصول اضافه شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      showToast('محصول حذف شد ✓');
    },
    onError: (err: Error) => {
      setError(err.message);
      showToast(err.message, 'error');
    },
  });

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    saveProductMutation.mutate({
      method: editingProduct ? 'PUT' : 'POST',
      id: editingProduct?.id,
      body: {
        name: prodName,
        price: parseFloat(prodPrice),
        stock: parseInt(prodStock),
        categoryId: parseInt(prodCatId || selectedCatId || '0'),
        description: prodDesc,
        available: prodAvailable,
        unit: prodUnit,
      },
    });
  };

  const startEditProduct = (p: ProductRow) => {
    setEditingProduct(p);
    setProdName(p.name);
    setProdPrice(p.price?.toString() || '');
    setProdStock(p.stock?.toString() || '0');
    setProdCatId(p.categoryId?.toString() || '');
    setProdDesc(p.description || '');
    setProdAvailable(p.available ?? false);
    setProdUnit(p.unit || 'item');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdName('');
    setProdPrice('');
    setProdStock('');
    setProdCatId('');
    setProdDesc('');
    setProdAvailable(true);
    setProdUnit('item');
  };

  const deleteProduct = async (id: number) => {
    if (!(await confirm('مطمئن هستید این محصول حذف شود؟'))) return;
    deleteProductMutation.mutate(id);
  };

  const toggleProductSelect = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const getCategoryName = (catId: number) => {
    return categories.find((c) => c.id === catId)?.name || 'نامشخص';
  };

  if (productsLoading) return <div className="spinner" />;

  return (
    <>
      {/* Category Picker */}
      <div className="card">
        <div className="category-picker">
          <button
            className={`category-chip ${selectedCatId === '' ? 'active' : ''}`}
            onClick={() => setSelectedCatId('')}
          >
            همه
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`category-chip ${selectedCatId === c.id.toString() ? 'active' : ''}`}
              onClick={() => setSelectedCatId(c.id.toString())}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
        <Field label="جستجو">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="نام محصول..."
            dir="auto"
          />
        </Field>
      </div>

      {/* Product Form */}
      {(isSuperAdmin || allowedCatId) && (
        <div className="card">
          <h2>{editingProduct ? 'ویرایش محصول' : 'افزودن محصول'}</h2>
          <form onSubmit={handleSaveProduct}>
            <Field label="نام">
              <input value={prodName} onChange={(e) => setProdName(e.target.value)} required />
            </Field>
            <Field label="قیمت">
              <input
                type="number"
                value={prodPrice}
                onChange={(e) => setProdPrice(e.target.value)}
                required
              />
            </Field>
            <Field label="موجودی">
              <input
                type="number"
                value={prodStock}
                onChange={(e) => setProdStock(e.target.value)}
                required
              />
            </Field>
            <Field label="دسته‌بندی">
              <select value={prodCatId} onChange={(e) => setProdCatId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="توضیحات">
              <textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} />
            </Field>
            <Field label="موجود است">
              <input
                type="checkbox"
                checked={prodAvailable}
                onChange={(e) => setProdAvailable(e.target.checked)}
              />
            </Field>
            <Field label="واحد">
              <select value={prodUnit} onChange={(e) => setProdUnit(e.target.value)}>
                <option value="item">عدد</option>
                <option value="cup">فنجان</option>
                <option value="kg">کیلوگرم</option>
                <option value="g">گرم</option>
                <option value="slice">برش</option>
              </select>
            </Field>
            <div className="flex gap-sm">
              <button type="submit" className="btn-primary">
                {editingProduct ? 'ذخیره' : 'افزودن'}
              </button>
              {editingProduct && (
                <button type="button" className="btn-ghost" onClick={resetProductForm}>
                  لغو
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Product List */}
      <div className="card">
        <h2>لیست محصولات ({filteredProducts.length})</h2>
        {filteredProducts.length === 0 ? (
          <EmptyState message="محصولی یافت نشد" />
        ) : (
          <div className="product-list">
            {filteredProducts.map((p) => (
              <div key={p.id} className="product-item">
                <input
                  type="checkbox"
                  checked={selectedProductIds.includes(p.id)}
                  onChange={() => toggleProductSelect(p.id)}
                  className="product-checkbox"
                />
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.name} className="product-thumb" />
                )}
                <div className="product-info">
                  <strong>{p.name}</strong>
                  <span className="text-secondary">{getCategoryName(p.categoryId)}</span>
                  <span>{p.price?.toLocaleString('fa-IR')} تومان</span>
                </div>
                <div className="product-actions">
                  <button className="btn-ghost" onClick={() => startEditProduct(p)}>
                    ✏️
                  </button>
                  <button className="btn-ghost danger" onClick={() => void deleteProduct(p.id)}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add product list and category picker styles**

```css
/* admin-app/src/index.css - add to existing styles */
.category-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.category-chip {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: none;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.category-chip.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.category-chip:hover:not(.active) {
  background: var(--hover-bg);
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.product-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.product-checkbox {
  width: 18px;
  height: 18px;
}

.product-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 8px;
}

.product-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.product-info strong {
  margin-bottom: 2px;
}

.product-actions {
  display: flex;
  gap: 4px;
}
```

- [ ] **Step 3: Run typecheck and lint**

```bash
cd admin-app && npm run typecheck && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add admin-app/src/components/ProductsSubTab.tsx admin-app/src/index.css
git commit -m "feat: extract ProductsSubTab with category picker"
```

---

### Task 4: Delete Old Pages and Update Redirects

**Files:**
- Delete: `admin-app/src/pages/ProductsPage.tsx`
- Delete: `admin-app/src/pages/CategoriesPage.tsx`
- Modify: `admin-app/src/App.tsx` (remove lazy imports for old pages)

**Interfaces:**
- Consumes: None (cleanup)
- Produces: Clean codebase with no dead pages

- [ ] **Step 1: Remove old lazy imports from App.tsx**

```tsx
// admin-app/src/App.tsx - remove these lines:
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
```

- [ ] **Step 2: Delete old page files**

```bash
rm admin-app/src/pages/ProductsPage.tsx admin-app/src/pages/CategoriesPage.tsx
```

- [ ] **Step 3: Run typecheck and lint**

```bash
cd admin-app && npm run typecheck && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add -A admin-app/src/
git commit -m "refactor: remove old ProductsPage and CategoriesPage, use InventoryPage"
```

---

## Phase 2: AI Backend

### Task 5: Create AI Types and Tool Definitions

**Files:**
- Create: `src/api/ai/types.ts`
- Create: `src/api/ai/tools.ts`

**Interfaces:**
- Consumes: None (foundational types)
- Produces: Tool definitions for OpenCode API

- [ ] **Step 1: Create AI types**

```typescript
// src/api/ai/types.ts
export interface AiChatRequest {
  message: string;
  conversationId?: string;
}

export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  conversationId: string;
}

export interface AiAction {
  type: string;
  result: 'success' | 'error';
  details?: Record<string, unknown>;
  error?: string;
}

export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, AiToolParameter>;
}

export interface AiToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

export interface AiConversation {
  id: string;
  adminId: number;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AiAction[];
  timestamp: string;
}
```

- [ ] **Step 2: Create AI tool definitions**

```typescript
// src/api/ai/tools.ts
import type { AiTool } from './types';

export const AI_TOOLS: AiTool[] = [
  {
    name: 'createProduct',
    description: 'Create a new product in the database',
    parameters: {
      name: { type: 'string', required: true },
      categoryId: { type: 'number', required: true },
      price: { type: 'number' },
      stock: { type: 'number', default: 0 },
      unit: { type: 'string', enum: ['item', 'cup', 'kg', 'g', 'slice', 'piece'] },
      description: { type: 'string' },
      available: { type: 'boolean', default: true },
      featured: { type: 'boolean', default: false },
      isSeasonal: { type: 'boolean', default: false },
      priceOnRequest: { type: 'boolean', default: false },
      imageUrl: { type: 'string' },
    },
  },
  {
    name: 'updateProduct',
    description: 'Update an existing product',
    parameters: {
      id: { type: 'number', required: true },
      name: { type: 'string' },
      categoryId: { type: 'number' },
      price: { type: 'number' },
      stock: { type: 'number' },
      unit: { type: 'string', enum: ['item', 'cup', 'kg', 'g', 'slice', 'piece'] },
      description: { type: 'string' },
      available: { type: 'boolean' },
      featured: { type: 'boolean' },
      isSeasonal: { type: 'boolean' },
      priceOnRequest: { type: 'boolean' },
      imageUrl: { type: 'string' },
    },
  },
  {
    name: 'deleteProduct',
    description: 'Delete a product by ID',
    parameters: {
      id: { type: 'number', required: true },
    },
  },
  {
    name: 'batchUpdateProducts',
    description: 'Update multiple products at once',
    parameters: {
      ids: { type: 'number[]', required: true },
      action: { type: 'string', enum: ['update', 'delete'], required: true },
      updateData: { type: 'object' },
    },
  },
  {
    name: 'createCategory',
    description: 'Create a new category',
    parameters: {
      name: { type: 'string', required: true },
      emoji: { type: 'string' },
      description: { type: 'string' },
      sortOrder: { type: 'number' },
    },
  },
  {
    name: 'updateCategory',
    description: 'Update an existing category',
    parameters: {
      id: { type: 'number', required: true },
      name: { type: 'string' },
      emoji: { type: 'string' },
      description: { type: 'string' },
      sortOrder: { type: 'number' },
    },
  },
  {
    name: 'deleteCategory',
    description: 'Delete a category by ID',
    parameters: {
      id: { type: 'number', required: true },
    },
  },
  {
    name: 'reorderCategories',
    description: 'Reorder categories',
    parameters: {
      orderedIds: { type: 'number[]', required: true },
    },
  },
  {
    name: 'updateSetting',
    description: 'Update a setting value',
    parameters: {
      key: { type: 'string', required: true },
      value: { type: 'string', required: true },
    },
  },
  {
    name: 'getSettings',
    description: 'Get current settings',
    parameters: {
      keys: { type: 'string[]' },
    },
  },
  {
    name: 'updateMenuConfig',
    description: 'Update menu configuration for a category',
    parameters: {
      categoryId: { type: 'number', required: true },
      menuSection: { type: 'string' },
      displayOrder: { type: 'number' },
      isVisible: { type: 'boolean' },
      buttonLabel: { type: 'string' },
      specialMessage: { type: 'string' },
    },
  },
  {
    name: 'invalidateCache',
    description: 'Invalidate KV cache for specific resources',
    parameters: {
      prefix: { type: 'string', enum: ['products', 'categories', 'settings', 'menu-config', 'all'], required: true },
    },
  },
];
```

- [ ] **Step 3: Commit**

```bash
mkdir -p src/api/ai
git add src/api/ai/types.ts src/api/ai/tools.ts
git commit -m "feat: add AI types and tool definitions"
```

---

### Task 6: Implement AI Tool Executor

**Files:**
- Create: `src/api/ai/executor.ts`

**Interfaces:**
- Consumes: `AI_TOOLS` from `tools.ts`, D1 database, CacheService
- Produces: `executeTool()` function that runs tool calls against D1/KV

- [ ] **Step 1: Create tool executor**

```typescript
// src/api/ai/executor.ts
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../../database/client';
import { products, categories, settings, menuConfig } from '../../database/schema';
import { CacheService } from '../../services/cache';
import type { AiAction } from './types';

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export async function executeTool(
  toolCall: ToolCall,
  db: D1Database,
  cache?: CacheService,
): Promise<AiAction> {
  const dbClient = getDb(db);

  try {
    switch (toolCall.name) {
      case 'createProduct': {
        const args = toolCall.arguments;
        await dbClient.insert(products).values({
          name: args.name as string,
          categoryId: args.categoryId as number,
          price: args.price as number ?? null,
          stock: (args.stock as number) ?? 0,
          unit: (args.unit as string) ?? 'item',
          description: (args.description as string) ?? null,
          available: (args.available as boolean) ?? true,
          featured: (args.featured as boolean) ?? false,
          isSeasonal: (args.isSeasonal as boolean) ?? false,
          priceOnRequest: (args.priceOnRequest as boolean) ?? false,
          imageUrl: (args.imageUrl as string) ?? null,
        });
        if (cache) await cache.deleteByPrefix('products');
        return { type: 'createProduct', result: 'success', details: args };
      }

      case 'updateProduct': {
        const { id, ...updateData } = toolCall.arguments;
        await dbClient.update(products).set(updateData).where(eq(products.id, id as number));
        if (cache) await cache.deleteByPrefix('products');
        return { type: 'updateProduct', result: 'success', details: toolCall.arguments };
      }

      case 'deleteProduct': {
        await dbClient.delete(products).where(eq(products.id, toolCall.arguments.id as number));
        if (cache) await cache.deleteByPrefix('products');
        return { type: 'deleteProduct', result: 'success', details: toolCall.arguments };
      }

      case 'batchUpdateProducts': {
        const { ids, action, updateData } = toolCall.arguments;
        if (action === 'delete') {
          await dbClient.delete(products).where(inArray(products.id, ids as number[]));
        } else {
          await dbClient.update(products).set(updateData).where(inArray(products.id, ids as number[]));
        }
        if (cache) await cache.deleteByPrefix('products');
        return { type: 'batchUpdateProducts', result: 'success', details: toolCall.arguments };
      }

      case 'createCategory': {
        const args = toolCall.arguments;
        await dbClient.insert(categories).values({
          name: args.name as string,
          emoji: (args.emoji as string) ?? null,
          description: (args.description as string) ?? null,
          sortOrder: (args.sortOrder as number) ?? null,
        });
        if (cache) await cache.deleteByPrefix('categories');
        return { type: 'createCategory', result: 'success', details: args };
      }

      case 'updateCategory': {
        const { id, ...updateData } = toolCall.arguments;
        await dbClient.update(categories).set(updateData).where(eq(categories.id, id as number));
        if (cache) await cache.deleteByPrefix('categories');
        return { type: 'updateCategory', result: 'success', details: toolCall.arguments };
      }

      case 'deleteCategory': {
        await dbClient.delete(categories).where(eq(categories.id, toolCall.arguments.id as number));
        if (cache) await cache.deleteByPrefix('categories');
        return { type: 'deleteCategory', result: 'success', details: toolCall.arguments };
      }

      case 'reorderCategories': {
        const { orderedIds } = toolCall.arguments;
        for (let i = 0; i < (orderedIds as number[]).length; i++) {
          await dbClient
            .update(categories)
            .set({ sortOrder: i })
            .where(eq(categories.id, (orderedIds as number[])[i]));
        }
        if (cache) await cache.deleteByPrefix('categories');
        return { type: 'reorderCategories', result: 'success', details: toolCall.arguments };
      }

      case 'updateSetting': {
        const { key, value } = toolCall.arguments;
        const existing = await dbClient.select().from(settings).where(eq(settings.key, key as string)).get();
        if (existing) {
          await dbClient.update(settings).set({ value: value as string }).where(eq(settings.key, key as string));
        } else {
          await dbClient.insert(settings).values({ key: key as string, value: value as string });
        }
        if (cache) await cache.deleteByPrefix('settings');
        return { type: 'updateSetting', result: 'success', details: toolCall.arguments };
      }

      case 'updateMenuConfig': {
        const { categoryId, ...updateData } = toolCall.arguments;
        const existing = await dbClient
          .select()
          .from(menuConfig)
          .where(eq(menuConfig.categoryId, categoryId as number))
          .get();
        if (existing) {
          await dbClient
            .update(menuConfig)
            .set(updateData)
            .where(eq(menuConfig.categoryId, categoryId as number));
        } else {
          await dbClient.insert(menuConfig).values({
            categoryId: categoryId as number,
            menuSection: (updateData.menuSection as string) ?? 'main',
            displayOrder: (updateData.displayOrder as number) ?? 0,
            isVisible: (updateData.isVisible as boolean) ?? true,
            buttonLabel: (updateData.buttonLabel as string) ?? null,
            specialMessage: (updateData.specialMessage as string) ?? null,
          });
        }
        if (cache) await cache.deleteByPrefix('menu-config');
        return { type: 'updateMenuConfig', result: 'success', details: toolCall.arguments };
      }

      case 'invalidateCache': {
        const { prefix } = toolCall.arguments;
        if (cache) {
          await cache.deleteByPrefix(prefix === 'all' ? '' : prefix as string);
        }
        return { type: 'invalidateCache', result: 'success', details: toolCall.arguments };
      }

      default:
        return { type: toolCall.name, result: 'error', error: `Unknown tool: ${toolCall.name}` };
    }
  } catch (error) {
    return {
      type: toolCall.name,
      result: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/ai/executor.ts
git commit -m "feat: add AI tool executor for D1/KV operations"
```

---

### Task 7: Create AI Chat Handler

**Files:**
- Create: `src/api/ai/chat.ts`

**Interfaces:**
- Consumes: `executeTool()` from `executor.ts`, `AI_TOOLS` from `tools.ts`, OpenCode API
- Produces: `handleAiChat()` function for Worker routes

- [ ] **Step 1: Create AI chat handler**

```typescript
// src/api/ai/chat.ts
import { AI_TOOLS } from './tools';
import { executeTool } from './executor';
import { CacheService } from '../../services/cache';
import type { AiChatRequest, AiChatResponse, AiAction } from './types';

const OPENCODE_API_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENCODE_MODEL = 'mimo-v2.5';

const AI_SYSTEM_PROMPT = `You are an AI admin assistant for Azadi Coffee Roastery (روستری قهوه آزادی).

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
- updateMenuConfig
- invalidateCache

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
- "نمایش محصولات تمام‌شده" → queryD1 SELECT where stock = 0`;

interface OpenCodeResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

export async function handleAiChat(
  request: AiChatRequest,
  apiKey: string,
  db: D1Database,
  cache?: CacheService,
): Promise<AiChatResponse> {
  const conversationId = request.conversationId || `conv_${Date.now()}`;
  const actions: AiAction[] = [];

  // Convert tools to OpenCode format
  const tools = AI_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum && { enum: param.enum }),
              ...(param.default !== undefined && { default: param.default }),
            },
          ]),
        ),
        required: Object.entries(tool.parameters)
          .filter(([, param]) => param.required)
          .map(([key]) => key),
      },
    },
  }));

  // Call OpenCode API
  const response = await fetch(OPENCODE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENCODE_MODEL,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: request.message },
      ],
      tools,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenCode API error: ${response.status}`);
  }

  const data: OpenCodeResponse = await response.json();
  const assistantMessage = data.choices?.[0]?.message;

  // Execute tool calls if present
  if (assistantMessage?.tool_calls) {
    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      const action = await executeTool(
        { name: toolCall.function.name, arguments: args },
        db,
        cache,
      );
      actions.push(action);
    }
  }

  return {
    reply: assistantMessage?.content || 'عملیات انجام شد',
    actions,
    conversationId,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/ai/chat.ts
git commit -m "feat: add AI chat handler with OpenCode API integration"
```

---

### Task 8: Add AI Routes to Router

**Files:**
- Modify: `src/api/router.ts`

**Interfaces:**
- Consumes: `handleAiChat()` from `chat.ts`
- Produces: `/api/ai/*` routes in Worker

- [ ] **Step 1: Add AI routes to router**

```typescript
// src/api/router.ts - add to imports
import { handleAiChat } from './ai/chat';
import type { AiChatRequest } from './ai/types';

// Add to handleApiRequest function, after existing routes:
// AI routes (super_admin only)
if (path.startsWith('ai/')) {
  if (!isSuperAdmin) {
    return jsonError('Forbidden: super admin only', corsHeaders, 403);
  }

  // POST /ai/chat
  if (path === 'ai/chat' && method === 'POST') {
    const body = (await request.json()) as AiChatRequest;
    const result = await handleAiChat(body, env.OPENCODE_API_KEY, env.DB, env.CACHE ? new CacheService(env.CACHE) : undefined);
    return jsonSuccess(result, corsHeaders);
  }

  return jsonError('Not found', corsHeaders, 404);
}
```

- [ ] **Step 2: Add OPENCODE_API_KEY to env type**

```typescript
// src/env.ts - add to Env interface
OPENCODE_API_KEY: string;
```

- [ ] **Step 3: Commit**

```bash
git add src/api/router.ts src/env.ts
git commit -m "feat: add /api/ai/* routes to Worker router"
```

---

## Phase 3: AI Frontend

### Task 9: Create AI Chat Types and API Client

**Files:**
- Create: `admin-app/src/api/ai.ts`

**Interfaces:**
- Consumes: `apiFetch` from `admin-app/src/api/client.ts`
- Produces: `sendAiMessage()`, `getAiHistory()` functions

- [ ] **Step 1: Create AI API client**

```typescript
// admin-app/src/api/ai.ts
import { apiFetch } from './client';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AiAction[];
  timestamp: string;
}

export interface AiAction {
  type: string;
  result: 'success' | 'error';
  details?: Record<string, unknown>;
  error?: string;
}

export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  conversationId: string;
}

export interface AiHistoryResponse {
  messages: AiMessage[];
}

export async function sendAiMessage(
  message: string,
  conversationId?: string,
): Promise<AiChatResponse> {
  return apiFetch<AiChatResponse>('/ai/chat', {
    method: 'POST',
    body: { message, conversationId },
  });
}

export async function getAiHistory(): Promise<AiMessage[]> {
  const data = await apiFetch<AiHistoryResponse>('/ai/history');
  return data.messages;
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-app/src/api/ai.ts
git commit -m "feat: add AI API client for admin app"
```

---

### Task 10: Create useAIChat Hook

**Files:**
- Create: `admin-app/src/hooks/useAIChat.ts`

**Interfaces:**
- Consumes: `sendAiMessage()`, `getAiHistory()` from `api/ai.ts`
- Produces: `useAIChat()` hook with messages, send, loading state

- [ ] **Step 1: Create useAIChat hook**

```typescript
// admin-app/src/hooks/useAIChat.ts
import { useState, useCallback, useEffect } from 'react';
import { sendAiMessage, getAiHistory, type AiMessage } from '../api/ai';
import { useAppContext } from '../AppContext';

export function useAIChat() {
  const { setError } = useAppContext();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Load history on mount
  useEffect(() => {
    if (isOpen) {
      getAiHistory()
        .then(setMessages)
        .catch((err) => setError(err.message));
    }
  }, [isOpen, setError]);

  const send = useCallback(
    async (message: string) => {
      // Add user message immediately
      const userMessage: AiMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await sendAiMessage(message, conversationId);
        setConversationId(response.conversationId);

        // Add assistant response
        const assistantMessage: AiMessage = {
          role: 'assistant',
          content: response.reply,
          actions: response.actions,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, setError],
  );

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { messages, send, isLoading, isOpen, toggle };
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-app/src/hooks/useAIChat.ts
git commit -m "feat: add useAIChat hook for chat state management"
```

---

### Task 11: Create ChatPanel Component

**Files:**
- Create: `admin-app/src/components/ChatPanel.tsx`

**Interfaces:**
- Consumes: `useAIChat()` from `hooks/useAIChat.ts`
- Produces: Chat panel UI with message list and input

- [ ] **Step 1: Create ChatPanel component**

```tsx
// admin-app/src/components/ChatPanel.tsx
import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../hooks/useAIChat';

export default function ChatPanel() {
  const { messages, send, isLoading, isOpen, toggle } = useAIChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    await send(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-panel" role="dialog" aria-label="دستیار هوش مصنوعی">
      <div className="chat-header">
        <h3>🤖 دستیار هوش مصنوعی</h3>
        <button className="btn-ghost" onClick={toggle} aria-label="بستن">
          ✕
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            پیام خود را بنویسید...<br />
            مثلاً: "افزودن ۳ محصول قهوه به دسته نوشیدنی‌ها"
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className="chat-bubble">
              {msg.content}
              {msg.actions && msg.actions.length > 0 && (
                <div className="chat-actions">
                  {msg.actions.map((action, j) => (
                    <span
                      key={j}
                      className={`chat-action ${action.result}`}
                    >
                      {action.result === 'success' ? '✅' : '❌'} {action.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message assistant">
            <div className="chat-bubble typing">...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="پیام خود را بنویسید..."
          disabled={isLoading}
          dir="auto"
        />
        <button onClick={() => void handleSend()} disabled={isLoading || !input.trim()}>
          📤
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add chat panel styles**

```css
/* admin-app/src/index.css - add to existing styles */
.chat-panel {
  position: fixed;
  bottom: 80px;
  left: 16px;
  width: 360px;
  max-height: 500px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
}

.chat-header h3 {
  margin: 0;
  font-size: 14px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 360px;
}

.chat-empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 32px 16px;
}

.chat-message {
  display: flex;
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.assistant {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
}

.chat-message.user .chat-bubble {
  background: var(--primary);
  color: white;
  border-bottom-right-radius: 4px;
}

.chat-message.assistant .chat-bubble {
  background: var(--bg-secondary);
  border-bottom-left-radius: 4px;
}

.chat-bubble.typing {
  color: var(--text-secondary);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.chat-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.chat-action {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
}

.chat-action.error {
  background: rgba(255, 0, 0, 0.2);
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border);
}

.chat-input input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}

.chat-input button {
  padding: 10px 16px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.chat-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/components/ChatPanel.tsx admin-app/src/index.css
git commit -m "feat: add ChatPanel component with message UI"
```

---

### Task 12: Create ChatButton (Floating Action Button)

**Files:**
- Create: `admin-app/src/components/ChatButton.tsx`

**Interfaces:**
- Consumes: `useAIChat()` from `hooks/useAIChat.ts`
- Produces: Floating action button that toggles chat panel

- [ ] **Step 1: Create ChatButton component**

```tsx
// admin-app/src/components/ChatButton.tsx
import { useAIChat } from '../hooks/useAIChat';

export default function ChatButton() {
  const { isOpen, toggle } = useAIChat();

  return (
    <button
      className={`chat-fab ${isOpen ? 'open' : ''}`}
      onClick={toggle}
      aria-label={isOpen ? 'بستن دستیار' : 'باز کردن دستیار'}
      aria-expanded={isOpen}
    >
      {isOpen ? '✕' : '🤖'}
    </button>
  );
}
```

- [ ] **Step 2: Add floating action button styles**

```css
/* admin-app/src/index.css - add to existing styles */
.chat-fab {
  position: fixed;
  bottom: 90px;
  left: 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 999;
  transition: transform 0.2s, background 0.2s;
}

.chat-fab:hover {
  transform: scale(1.1);
}

.chat-fab.open {
  background: var(--text-secondary);
}
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/components/ChatButton.tsx admin-app/src/index.css
git commit -m "feat: add ChatButton floating action button"
```

---

### Task 13: Integrate Chat Components into App

**Files:**
- Modify: `admin-app/src/App.tsx`

**Interfaces:**
- Consumes: `ChatPanel`, `ChatButton` components
- Produces: Chat UI rendered in app

- [ ] **Step 1: Add chat components to App.tsx**

```tsx
// admin-app/src/App.tsx - add imports
import ChatPanel from './components/ChatPanel';
import ChatButton from './components/ChatButton';

// Add inside AppInner, after ConfirmModal:
{currentUser && (
  <>
    <ChatPanel />
    <ChatButton />
  </>
)}
```

- [ ] **Step 2: Run typecheck and lint**

```bash
cd admin-app && npm run typecheck && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/App.tsx
git commit -m "feat: integrate chat panel and button into admin app"
```

---

## Phase 4: Polish and Testing

### Task 14: Add Error Handling and Loading States

**Files:**
- Modify: `admin-app/src/components/ChatPanel.tsx`
- Modify: `admin-app/src/hooks/useAIChat.ts`

**Interfaces:**
- Consumes: None
- Produces: Better error messages, loading indicators

- [ ] **Step 1: Add error retry and loading skeleton**

```tsx
// In ChatPanel.tsx, add retry button for failed messages
{msg.actions?.some(a => a.result === 'error') && (
  <button className="btn-ghost btn-sm" onClick={() => void send(msg.content)}>
    🔄 تلاش مجدد
  </button>
)}
```

- [ ] **Step 2: Add skeleton loading for initial history load**

```tsx
// In ChatPanel.tsx, add loading state for initial load
{isLoading && messages.length === 0 && (
  <div className="chat-skeleton">
    <div className="skeleton-line" />
    <div className="skeleton-line short" />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/components/ChatPanel.tsx admin-app/src/hooks/useAIChat.ts
git commit -m "feat: add error handling and loading states to chat"
```

---

### Task 15: Add Mobile Responsiveness

**Files:**
- Modify: `admin-app/src/index.css`

**Interfaces:**
- Consumes: None
- Produces: Responsive chat panel for mobile

- [ ] **Step 1: Add mobile styles**

```css
/* admin-app/src/index.css - add media query */
@media (max-width: 480px) {
  .chat-panel {
    left: 0;
    right: 0;
    bottom: 70px;
    width: 100%;
    max-height: 60vh;
    border-radius: 12px 12px 0 0;
  }

  .chat-fab {
    bottom: 80px;
    left: 16px;
  }
}
```

- [ ] **Step 2: Test on mobile viewport**

Open browser dev tools, toggle device toolbar, verify chat panel fills width on small screens.

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/index.css
git commit -m "feat: add mobile responsiveness to chat panel"
```

---

### Task 16: Run Full Test Suite

**Files:**
- None (testing only)

**Interfaces:**
- Consumes: None
- Produces: Passing tests

- [ ] **Step 1: Run Worker tests**

```bash
npm test
```

- [ ] **Step 2: Run admin-app checks**

```bash
cd admin-app && npm run check
```

- [ ] **Step 3: Run format check**

```bash
npm run format:check
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve test and lint issues"
```

---

### Task 17: Final Integration Test

**Files:**
- None (manual testing)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working feature

- [ ] **Step 1: Start dev servers**

```bash
# Terminal 1: Worker
npm run dev

# Terminal 2: Admin app
cd admin-app && npm run dev
```

- [ ] **Step 2: Test Inventory tab**

1. Open admin app in Telegram
2. Navigate to "موجودی" tab
3. Switch between "دسته‌بندی‌ها" and "محصولات" sub-tabs
4. Verify category picker shows all categories with "همه" option
5. Select a category, verify products filter correctly
6. Create/edit/delete a category
7. Create/edit/delete a product

- [ ] **Step 3: Test AI Chat**

1. Click floating 🤖 button
2. Chat panel opens
3. Send: "نمایش تمام دسته‌بندی‌ها"
4. Verify AI responds with category list
5. Send: "افزودن دسته‌بندی تستی با ایموجی 🧪"
6. Verify category created
7. Send: "حذف دسته‌بندی تستی"
8. Verify category deleted

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: AI-powered admin panel with merged products/categories"
```

---

## Summary

**Total Tasks:** 17
**Estimated Time:** 4-6 hours

**Files Created:**
- `admin-app/src/pages/InventoryPage.tsx`
- `admin-app/src/components/CategoriesSubTab.tsx`
- `admin-app/src/components/ProductsSubTab.tsx`
- `admin-app/src/components/ChatPanel.tsx`
- `admin-app/src/components/ChatButton.tsx`
- `admin-app/src/hooks/useAIChat.ts`
- `admin-app/src/api/ai.ts`
- `src/api/ai/types.ts`
- `src/api/ai/tools.ts`
- `src/api/ai/executor.ts`
- `src/api/ai/chat.ts`

**Files Modified:**
- `admin-app/src/App.tsx`
- `admin-app/src/index.css`
- `src/api/router.ts`
- `src/env.ts`

**Files Deleted:**
- `admin-app/src/pages/ProductsPage.tsx`
- `admin-app/src/pages/CategoriesPage.tsx`
