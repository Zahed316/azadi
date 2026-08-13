# Phase 6a — Rich Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add product images (R2 upload + URL fallback), nutritional info (calories, allergens, caffeine), and enhanced coffee details (brew guide) to the product catalog, displayed in both the Telegram bot and admin Mini App.

**Architecture:** R2 bucket stores uploaded images; a new `ImageService` handles R2 CRUD. The REST API gains image upload/delete endpoints and nutritional fields. The bot switches from text-only `reply` to `sendPhoto` when an image exists. The admin app gains an image upload widget and nutritional form fields.

**Tech Stack:** Cloudflare R2 (object storage), Drizzle ORM (migration), grammY (bot framework), React + Vite (admin app), vitest (tests)

## Global Constraints

- All bot text is Persian (Farsi) with HTML parse mode
- Use `toPersianDigits()` and `formatPersianPrice()` from `src/utils/numbers.ts`
- LRI/PDI isolates (U+2066/U+2069) wrap price runs in RTL text
- Admin app uses `HashRouter` — no leading hash on routes
- Lint baselines: root ≤ 137 warnings, admin-app ≤ 294 warnings (COUNT, not category)
- No commits to main without PR
- Test harness (`src/tests/_helpers/routerHarness.ts`) only handles single-eq predicates; other predicates silently no-op

---

## File Structure

| Action | File                                              | Responsibility                                                                         |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Create | `drizzle/0006_add_nutritional_and_brew_guide.sql` | Migration: 3 columns on products, 1 on coffee_details                                  |
| Modify | `src/database/schema.ts`                          | Add `calories`, `allergens`, `caffeineMg` to products; `brewGuide` to coffeeDetails    |
| Modify | `src/bot.ts` (Env interface)                      | Add `PRODUCT_IMAGES: R2Bucket` binding                                                 |
| Modify | `wrangler.toml`                                   | Add `[[r2_buckets]]` section                                                           |
| Create | `src/services/imageService.ts`                    | R2 upload/delete/getUrl operations                                                     |
| Modify | `src/api/router.ts`                               | Add image upload/delete endpoints; pass nutritional fields in GET/POST/PUT             |
| Modify | `src/utils/formatters.ts`                         | Add nutritional display to `formatProduct`; add `formatNutrition()` helper             |
| Modify | `src/handlers/callbackQuery.ts`                   | Switch `product:` callback to `sendPhoto` when image exists; add brewGuide to passport |
| Modify | `admin-app/src/api/client.ts`                     | Add `apiUpload()` function for multipart FormData                                      |
| Modify | `admin-app/src/pages/ProductsPage.tsx`            | Image upload widget + nutritional fields + brewGuide textarea                          |
| Modify | `src/tests/_helpers/routerHarness.ts`             | Add `callRouterFormData()` helper for multipart tests                                  |
| Modify | `src/tests/router-products.test.ts`               | Tests for image upload/delete and nutritional fields                                   |
| Modify | `src/tests/formatters.test.ts`                    | Tests for nutritional display in formatProduct                                         |

---

### Task 1: Migration + Schema Update

**Files:**

- Create: `drizzle/0006_add_nutritional_and_brew_guide.sql`
- Modify: `src/database/schema.ts:21-57`

**Interfaces:**

- Consumes: none (foundation task)
- Produces: `products.calories`, `products.allergens`, `products.caffeineMg`, `coffeeDetails.brewGuide` columns available to all downstream tasks

- [ ] **Step 1: Write the SQL migration**

Create `drizzle/0006_add_nutritional_and_brew_guide.sql`:

```sql
-- Phase 6a: Product nutritional info + coffee brew guide
ALTER TABLE products ADD calories integer;
ALTER TABLE products ADD allergens text;
ALTER TABLE products ADD caffeine_mg integer;
ALTER TABLE coffee_details ADD brew_guide text;
```

- [ ] **Step 2: Update Drizzle schema**

In `src/database/schema.ts`, add three columns to the `products` table (after `syrupOptions`, before `createdAt`):

```typescript
  sizeOptions: text('size_options'),
  syrupOptions: text('syrup_options'),
  calories: integer('calories'),
  allergens: text('allergens'),
  caffeineMg: integer('caffeine_mg'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
```

Add one column to the `coffeeDetails` table (after `body`):

```typescript
  acidity: text('acidity'),
  body: text('body'),
  brewGuide: text('brew_guide'),
```

- [ ] **Step 3: Verify schema compiles**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 4: Commit**

```bash
git add drizzle/0006_add_nutritional_and_brew_guide.sql src/database/schema.ts
git commit -m "feat(db): add nutritional columns + brewGuide migration"
```

---

### Task 2: R2 Binding + Environment Type

**Files:**

- Modify: `wrangler.toml` (add R2 section)
- Modify: `src/bot.ts:18-29` (add PRODUCT_IMAGES to Env)

**Interfaces:**

- Consumes: none
- Produces: `env.PRODUCT_IMAGES` (R2Bucket) available to ImageService and router

- [ ] **Step 1: Add R2 binding to wrangler.toml**

Append after the `[ai]` section:

```toml
[[r2_buckets]]
binding = "PRODUCT_IMAGES"
bucket_name = "azadi-products"
```

- [ ] **Step 2: Update Env interface**

In `src/bot.ts`, add to the `Env` interface (after `AI: any;`):

```typescript
export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  SECRET_TOKEN: string;
  DB: D1Database;
  AI: any;
  PRODUCT_IMAGES: R2Bucket;
  // Optional runtime flags
  USE_CONVERSATIONS?: string;
  PERF_LOG?: string;
  STREAK_MESSAGES?: string;
  STREAK_CRON_ENABLED?: string;
}
```

Note: `R2Bucket` comes from `@cloudflare/workers-types`. Check if it's already imported; if not, add the import.

- [ ] **Step 3: Verify types compile**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add wrangler.toml src/bot.ts
git commit -m "feat(r2): add R2 bucket binding for product images"
```

---

### Task 3: Image Service

**Files:**

- Create: `src/services/imageService.ts`

**Interfaces:**

- Consumes: `env.PRODUCT_IMAGES` (R2Bucket from Task 2)
- Produces: `ImageService.uploadImage(bucket, productId, file, contentType)`, `ImageService.deleteImage(bucket, productId)`, `ImageService.getImageUrl(bucket, productId)` — used by router (Task 4) and callback handler (Task 7)

- [ ] **Step 1: Write the ImageService**

Create `src/services/imageService.ts`:

```typescript
import { R2Bucket } from '@cloudflare/workers-types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export class ImageService {
  /**
   * Upload an image to R2 for a given product.
   * Returns the public URL of the uploaded image.
   */
  static async uploadImage(
    bucket: R2Bucket,
    productId: number,
    file: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    if (!ALLOWED_TYPES.includes(contentType)) {
      throw new ImageError('INVALID_TYPE', 'فقط فایل‌های JPG، PNG و WebP پشتیبانی می‌شوند');
    }
    if (file.byteLength > MAX_FILE_SIZE) {
      throw new ImageError('TOO_LARGE', 'حجم فایل نباید بیشتر از ۵ مگابایت باشد');
    }

    // Content-addressed key: hash the file to prevent duplicates
    const hashBuffer = await crypto.subtle.digest('SHA-256', file);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const ext = contentTypeToExt(contentType);
    const key = `products/${productId}/${hashHex}.${ext}`;

    await bucket.put(key, file, {
      httpMetadata: { contentType },
    });

    // Return the R2.dev public URL
    // In production, this bucket needs to have public access enabled
    return getPublicUrl(bucket, key);
  }

  /**
   * Delete all images for a product from R2.
   */
  static async deleteImage(bucket: R2Bucket, productId: number): Promise<void> {
    const prefix = `products/${productId}/`;
    const listed = await bucket.list({ prefix });
    for (const obj of listed.objects) {
      await bucket.delete(obj.key);
    }
  }

  /**
   * Check if a product has an image in R2.
   */
  static async hasImage(bucket: R2Bucket, productId: number): Promise<boolean> {
    const prefix = `products/${productId}/`;
    const listed = await bucket.list({ prefix });
    return listed.objects.length > 0;
  }
}

function contentTypeToExt(ct: string): string {
  switch (ct) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

function getPublicUrl(_bucket: R2Bucket, key: string): string {
  // R2.dev public URL pattern: pub-{hash}.r2.dev/{key}
  // In production, configure the bucket's public access domain in the Cloudflare dashboard.
  // For now, return the key as a relative URL — the router will prefix it.
  return key;
}

export class ImageError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImageError';
  }
}
```

Note: The `getPublicUrl` function is a placeholder. In production, you'll configure the R2 bucket's public access domain in the Cloudflare dashboard and return the full URL here. For now, it returns the R2 key which the client can use.

- [ ] **Step 2: Verify compilation**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/imageService.ts
git commit -m "feat(api): ImageService for R2 product image CRUD"
```

---

### Task4: API — Image Upload/Delete Endpoints

**Files:**

- Modify: `src/api/router.ts:327-376` (add routes after existing products/:id PUT/DELETE)
- Modify: `src/tests/_helpers/routerHarness.ts` (add FormData support)
- Modify: `src/tests/router-products.test.ts` (add image endpoint tests)

**Interfaces:**

- Consumes: `ImageService` from Task3, `env.PRODUCT_IMAGES` from Task2
- Produces: `PUT /api/products/{id}/image` and `DELETE /api/products/{id}/image` endpoints used by admin app (Task9)

- [ ] **Step 1: Add FormData test helper to harness**

In `src/tests/_helpers/routerHarness.ts`, add a `callRouterFormData` function after the existing `callRouter`:

```typescript
export interface CallRouterFormDataOpts {
  method: string;
  path: string;
  formData: FormData;
  auth?: string | null;
  env?: Record<string, unknown>;
}

export async function callRouterFormData({
  method,
  path,
  formData,
  auth,
  env: envOverrides,
}: CallRouterFormDataOpts): Promise<{ status: number; body: any; headers: Headers }> {
  const { handleApiRequest } = await import('../../api/router');

  const url = `https://bot.test/api/${path}`;
  const headers: Record<string, string> = {};

  if (auth !== null) {
    headers['Authorization'] = auth ?? 'Telegram fake-init-data';
  }

  // Don't set Content-Type — browser/fetch sets it automatically with boundary
  const init: RequestInit = { method, headers, body: formData };

  const fakeEnv: Env = {
    TELEGRAM_BOT_TOKEN: 'test-token',
    SECRET_TOKEN: 'test-secret',
    DB: fakeDb as unknown as import('@cloudflare/workers-types').D1Database,
    AI: null,
    PRODUCT_IMAGES: {
      put: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      list: vi.fn().mockResolvedValue({ objects: [] }),
      get: vi.fn().mockResolvedValue(null),
      head: vi.fn().mockResolvedValue(null),
    } as any,
    ...envOverrides,
  };

  const ctx = {} as ExecutionContext;
  const response = await handleApiRequest(request, fakeEnv, ctx);
  const responseBody = await response.json().catch(() => null);

  return { status: response.status, body: responseBody, headers: response.headers };
}
```

Also update the existing `callRouter` to include the mock `PRODUCT_IMAGES` in `fakeEnv`:

```typescript
const fakeEnv: Env = {
  TELEGRAM_BOT_TOKEN: 'test-token',
  SECRET_TOKEN: 'test-secret',
  DB: fakeDb as unknown as import('@cloudflare/workers-types').D1Database,
  AI: null,
  PRODUCT_IMAGES: {
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    list: vi.fn().mockResolvedValue({ objects: [] }),
    get: vi.fn().mockResolvedValue(null),
    head: vi.fn().mockResolvedValue(null),
  } as any,
  ...envOverrides,
};
```

- [ ] **Step 2: Write failing tests for image upload**

In `src/tests/router-products.test.ts`, add at the bottom:

```typescript
// ---------------------------------------------------------------------------
// PUT /products/:id/image
// ---------------------------------------------------------------------------

test('image upload returns 404 for nonexistent product', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  const formData = new FormData();
  formData.append('file', new Blob(['fake'], { type: 'image/jpeg' }), 'test.jpg');
  const res = await callRouterFormData({
    method: 'PUT',
    path: 'products/999/image',
    formData,
  });
  expect(res.status).toBe(404);
});

test('image upload rejects non-image content type', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [{ id: 1, name: 'Espresso', categoryId: 1 }]);
  const formData = new FormData();
  formData.append('file', new Blob(['not an image'], { type: 'text/plain' }), 'test.txt');
  const res = await callRouterFormData({
    method: 'PUT',
    path: 'products/1/image',
    formData,
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('JPG');
});

test('image upload succeeds for valid image', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [{ id: 1, name: 'Espresso', categoryId: 1 }]);
  const formData = new FormData();
  const fakeImage = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
  formData.append('file', new Blob([fakeImage], { type: 'image/jpeg' }), 'test.jpg');
  const res = await callRouterFormData({
    method: 'PUT',
    path: 'products/1/image',
    formData,
  });
  expect(res.status).toBe(200);
  expect(res.body.imageUrl).toBeDefined();
});

// ---------------------------------------------------------------------------
// DELETE /products/:id/image
// ---------------------------------------------------------------------------

test('image delete returns 404 for nonexistent product', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  const res = await callRouter({
    method: 'DELETE',
    path: 'products/999/image',
  });
  expect(res.status).toBe(404);
});

test('image delete succeeds for existing product', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [{ id: 1, name: 'Espresso', categoryId: 1, imageUrl: 'products/1/abc.jpg' }]);
  const res = await callRouter({
    method: 'DELETE',
    path: 'products/1/image',
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const rows = readTable(products);
  expect(rows[0].imageUrl).toBeNull();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/tests/router-products.test.ts -t "image"`
Expected: FAIL (endpoints don't exist yet)

- [ ] **Step 4: Implement image upload/delete endpoints**

In `src/api/router.ts`, add after the existing `products/:id` PUT/DELETE block (around line 376), before the `products/:id/stock` block:

```typescript
// Image upload: PUT /products/:id/image (multipart/form-data)
if (path.startsWith('products/') && path.endsWith('/image') && method === 'PUT') {
  const id = parseInt(path.split('/')[1]);
  const repo = new ProductRepository(db);
  const product = await repo.getProductById(id);

  if (!product)
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
    return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify this product' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ error: 'فقط فایل‌های JPG، PNG و WebP پشتیبانی می‌شوند' }),
        { status: 400, headers: corsHeaders },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const fileContentType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const { ImageService } = await import('../services/imageService');
    const imageUrl = await ImageService.uploadImage(
      env.PRODUCT_IMAGES,
      id,
      arrayBuffer,
      fileContentType,
    );

    await repo.updateProduct(id, { imageUrl });
    return new Response(JSON.stringify({ success: true, imageUrl }), { headers: corsHeaders });
  } catch (e: any) {
    if (e.name === 'ImageError') {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    console.error(e);
    return new Response(JSON.stringify({ error: 'خطا در آپلود تصویر' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Image delete: DELETE /products/:id/image
if (path.startsWith('products/') && path.endsWith('/image') && method === 'DELETE') {
  const id = parseInt(path.split('/')[1]);
  const repo = new ProductRepository(db);
  const product = await repo.getProductById(id);

  if (!product)
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
    return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify this product' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    const { ImageService } = await import('../services/imageService');
    await ImageService.deleteImage(env.PRODUCT_IMAGES, id);
    await repo.updateProduct(id, { imageUrl: null });
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'خطا در حذف تصویر' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
```

**Important:** These routes must be placed BEFORE the `products/:id/stock` and `products/:id/toggle` routes, because `path.endsWith('/image')` would otherwise match the more general `products/:id` pattern. The existing code checks `path.split('/').length === 2` for the PUT/DELETE block, so the `/image` suffix routes won't conflict — but order matters for readability.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/router-products.test.ts -t "image"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/api/router.ts src/tests/_helpers/routerHarness.ts src/tests/router-products.test.ts
git commit -m "feat(api): image upload/delete endpoints with R2 integration"
```

---

### Task 5: API — Nutritional Fields in Product Endpoints

**Files:**

- Modify: `src/api/router.ts:260-376` (update GET/POST/PUT products)

**Interfaces:**

- Consumes: schema columns from Task1 (`calories`, `allergens`, `caffeineMg`, `brewGuide`)
- Produces: nutritional fields returned in GET responses and accepted in POST/PUT bodies

- [ ] **Step 1: Write failing tests for nutritional fields**

In `src/tests/router-products.test.ts`, add:

```typescript
// ---------------------------------------------------------------------------
// Nutritional fields in POST/PUT/GET
// ---------------------------------------------------------------------------

test('POST /products accepts nutritional fields', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  const res = await callRouter({
    method: 'POST',
    path: 'products',
    body: {
      name: 'Espresso',
      categoryId: '5',
      price: 45000,
      calories: 5,
      allergens: null,
      caffeineMg: 63,
    },
  });
  expect(res.status).toBe(200);
  const rows = readTable(products);
  expect(rows[0].calories).toBe(5);
  expect(rows[0].caffeineMg).toBe(63);
  expect(rows[0].allergens).toBeNull();
});

test('GET /products returns nutritional fields', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [
    { id: 1, name: 'Latte', categoryId: 1, calories: 120, caffeineMg: 63, allergens: 'milk' },
  ]);
  const res = await callRouter({ method: 'GET', path: 'products' });
  expect(res.status).toBe(200);
  expect(res.body.products[0].calories).toBe(120);
  expect(res.body.products[0].caffeineMg).toBe(63);
  expect(res.body.products[0].allergens).toBe('milk');
});

test('PUT /products updates nutritional fields', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [{ id: 1, name: 'Latte', categoryId: 1 }]);
  const res = await callRouter({
    method: 'PUT',
    path: 'products/1',
    body: { calories: 120, caffeineMg: 63, allergens: 'milk' },
  });
  expect(res.status).toBe(200);
  const rows = readTable(products);
  expect(rows[0].calories).toBe(120);
  expect(rows[0].allergens).toBe('milk');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/router-products.test.ts -t "nutritional"`
Expected: FAIL (fields not passed through)

- [ ] **Step 3: Update POST /products to pass nutritional fields**

In `src/api/router.ts`, in the `POST /products` handler (around line 281), add the nutritional fields to the `addProduct` call:

```typescript
const result = await repo.addProduct({
  ...body,
  unit: body.unit || 'item',
  available: body.available ?? true,
  featured: body.featured ?? false,
  priceOnRequest: body.priceOnRequest ?? false,
  isSeasonal: body.isSeasonal ?? false,
  calories: body.calories ?? null,
  allergens: body.allergens ?? null,
  caffeineMg: body.caffeineMg ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
```

- [ ] **Step 4: Update PUT /products to pass nutritional fields**

In `src/api/router.ts`, in the `PUT /products/:id` handler (around line 358), add nutritional fields to the `updateProduct` call:

```typescript
await repo.updateProduct(id, {
  name: body.name,
  price: body.price,
  stock: body.stock,
  categoryId: body.categoryId !== undefined ? parseInt(body.categoryId) : undefined,
  description: body.description !== undefined ? body.description : null,
  unit: body.unit || 'item',
  available: body.available !== undefined ? body.available : true,
  calories: body.calories !== undefined ? body.calories : undefined,
  allergens: body.allergens !== undefined ? body.allergens : undefined,
  caffeineMg: body.caffeineMg !== undefined ? body.caffeineMg : undefined,
});
```

- [ ] **Step 5: Update setCoffeeDetails to accept brewGuide**

In `src/repositories/index.ts`, in the `setCoffeeDetails` method (around line 113), add `brewGuide` to the details type:

```typescript
  async setCoffeeDetails(
    productId: number,
    details: {
      origin?: string | null;
      farm?: string | null;
      altitude?: string | null;
      processing?: string | null;
      variety?: string | null;
      roastLevel?: string | null;
      flavorNotes?: string | null;
      recommendedBrew?: string | null;
      acidity?: string | null;
      body?: string | null;
      brewGuide?: string | null;
    } | null,
  ) {
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/tests/router-products.test.ts -t "nutritional"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/api/router.ts src/repositories/index.ts src/tests/router-products.test.ts
git commit -m "feat(api): nutritional fields in product CRUD endpoints"
```

---

### Task 6: Bot — formatProduct with Nutritional Display

**Files:**

- Modify: `src/utils/formatters.ts:15-33`
- Modify: `src/tests/formatters.test.ts`

**Interfaces:**

- Consumes: `products.calories`, `products.allergens`, `products.caffeineMg` from Task1
- Produces: enhanced `formatProduct()` output used by callback handler (Task7)

- [ ] **Step 1: Write failing tests for nutritional display**

In `src/tests/formatters.test.ts`, add:

```typescript
test('formatProduct shows calories when present', () => {
  const product = { name: 'Espresso', price: 35000, stock: 10, unit: 'cup', calories: 5 };
  const result = formatProduct(product);
  expect(result).toContain('۵ کالری');
});

test('formatProduct shows caffeine when present', () => {
  const product = { name: 'Espresso', price: 35000, stock: 10, unit: 'cup', caffeineMg: 63 };
  const result = formatProduct(product);
  expect(result).toContain('۶۳ میلی‌گرم');
});

test('formatProduct shows allergens when present', () => {
  const product = { name: 'Latte', price: 45000, stock: 10, unit: 'cup', allergens: 'milk' };
  const result = formatProduct(product);
  expect(result).toContain('milk');
});

test('formatProduct hides nutritional fields when null', () => {
  const product = { name: 'Espresso', price: 35000, stock: 10, unit: 'cup' };
  const result = formatProduct(product);
  expect(result).not.toContain('کالری');
  expect(result).not.toContain('کافئین');
  expect(result).not.toContain('آلرژن');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/formatters.test.ts -t "calories|caffeine|allergens"`
Expected: FAIL

- [ ] **Step 3: Update formatProduct to show nutritional info**

In `src/utils/formatters.ts`, update `formatProduct` to add nutritional lines after the stock check and before the VAT note:

```typescript
export function formatProduct(p: any, priceUnit: string = DEFAULT_PRICE_UNIT): string {
  let text = `📦 <b>${p.name}</b>\n`;
  if (p.description) text += `\n${p.description}\n`;
  if (p.priceOnRequest || p.price == null) {
    text += `\n💰 قیمت: سوال در کافه`;
  } else {
    text += `\n💰 قیمت: ${formatPersianPrice(p.price, priceUnit)}`;
  }
  if (p.isSeasonal) text += `\n🌿 <i>مخصوص این فصل</i>`;
  if (p.sizeOptions) text += `\n📐 اندازه‌ها: ${JSON.parse(p.sizeOptions).join(', ')}`;
  if (p.syrupOptions) text += `\n🍯 سیروپ‌ها: ${JSON.parse(p.syrupOptions).join(', ')}`;
  // Only show stock for physical goods (beans, equipment)
  if (p.unit !== 'cup') {
    const unitLabel = unitMap[p.unit] || p.unit;
    text += `\n📦 موجودی: ${p.stock > 0 ? `${toPersianDigits(p.stock)} ${unitLabel}` : 'ناموجود'}`;
  }
  // Nutritional info (only when present)
  if (p.calories != null) text += `\n🔥 ${toPersianDigits(p.calories)} کالری`;
  if (p.caffeineMg != null) text += `\n⚡ کافئین: ${toPersianDigits(p.caffeineMg)} میلی‌گرم`;
  if (p.allergens) text += `\n⚠️ آلرژن‌ها: ${p.allergens}`;
  text += VAT_NOTE;
  return text;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/formatters.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatters.ts src/tests/formatters.test.ts
git commit -m "feat(bot): nutritional info display in formatProduct"
```

---

### Task 7: Bot — Product Detail with sendPhoto

**Files:**

- Modify: `src/handlers/callbackQuery.ts:183-217` (product callback handler)

**Interfaces:**

- Consumes: `formatProduct()` from Task6, `product.imageUrl` (set by Task4 upload or existing external URL)
- Produces: product detail view now shows image when available

- [ ] **Step 1: Update product callback to use sendPhoto**

In `src/handlers/callbackQuery.ts`, replace the `product:` callback handler (lines 183-217) with:

```typescript
bot.callbackQuery(/^product:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery({ text: '⏳ در حال بارگذاری...' });
    const id = parseInt(ctx.match[1]);
    const repo = new ProductRepository(ctx.env.DB);
    const product = await repo.getProductById(id);
    if (product) {
      const priceUnit =
        (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
      const kb = backKeyboard();
      // Phase 5.2: favorite toggle
      if (ctx.from?.id) {
        const isFav = await new FavoritesRepository(ctx.env.DB).isFavorited(
          String(ctx.from.id),
          id,
        );
        if (isFav) {
          kb.row().text('💔 حذف از علاقمندی‌ها', `fav:remove:${id}`);
        } else {
          kb.row().text('⭐ ذخیره', `fav:add:${id}`);
        }
      }
      const caption = formatProduct(product, priceUnit);
      if (product.imageUrl) {
        await ctx.replyWithPhoto(product.imageUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      } else {
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }
    } else {
      await ctx.reply('محصول مورد نظر یافت نشد.');
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    await ctx.reply('❌ خطایی در دریافت اطلاعات محصول رخ داد.');
  }
});
```

- [ ] **Step 2: Verify compilation**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/handlers/callbackQuery.ts
git commit -m "feat(bot): product detail shows image via sendPhoto when available"
```

---

### Task 8: Bot — Coffee Passport brewGuide Display

**Files:**

- Modify: `src/handlers/callbackQuery.ts` (passport callback handler)

**Interfaces:**

- Consumes: `coffeeDetails.brewGuide` from Task1
- Produces: brewGuide section in passport detail view

- [ ] **Step 1: Find the passport detail handler**

The passport detail is shown via the `product:` callback (same as Task7). The `brewGuide` is part of `coffeeDetails` which is joined via `getBeansWithCoffeeDetails()`. However, the `product:` callback uses `getProductById()` which does NOT join coffee_details.

We need to check if the product has coffee_details and display brewGuide. The simplest approach: in the `product:` callback, after fetching the product, also check for coffee_details.

Actually, looking at the code more carefully: the `product:` callback handler already shows `formatProduct()` which doesn't include brewGuide. The passport list (`passport:page:N`) links to `product:{id}` — so the same handler shows both regular products and passport products.

The brewGuide should only show for products that have coffee_details. We need to:

1. In the `product:` callback, fetch coffee_details if they exist
2. Append brewGuide to the caption if present

- [ ] **Step 2: Update product callback to fetch and display brewGuide**

In the `product:` callback handler, after fetching the product, also fetch coffee_details:

```typescript
  bot.callbackQuery(/^product:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: '⏳ در حال بارگذاری...' });
      const id = parseInt(ctx.match[1]);
      const repo = new ProductRepository(ctx.env.DB);
      const product = await repo.getProductById(id);
      if (product) {
        const priceUnit =
          (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
        const kb = backKeyboard();
        // Phase 5.2: favorite toggle
        if (ctx.from?.id) {
          const isFav = await new FavoritesRepository(ctx.env.DB).isFavorited(
            String(ctx.from.id),
            id,
          );
          if (isFav) {
            kb.row().text('💔 حذف از علاقمندی‌ها', `fav:remove:${id}`);
          } else {
            kb.row().text('⭐ ذخیره', `fav:add:${id}`);
          }
        }
        let caption = formatProduct(product, priceUnit);
        // Show brew guide if this is a coffee bean with details
        if (product.coffeeDetails) {
          // coffee_details is joined via getAllProductsWithDetails but not getProductById
          // We need a separate query for coffee_details
        }
        // ... rest of handler
```

Wait — `getProductById` doesn't join coffee_details. We need to fetch it separately. Let me check the schema: `coffeeDetails` has `productId` as PK. We can query it directly.

Actually, looking at the schema again: `coffeeDetails` is a separate table with `productId` as primary key. The `getProductById` query doesn't join it. We need to add a method to fetch coffee_details, or use the existing `getAllProductsWithDetails` and filter.

The simplest approach: add a `getCoffeeDetails(productId)` method to `ProductRepository`, or just query the schema directly in the callback handler.

Let me add a simple helper method to `ProductRepository`:

- [ ] **Step 3: Add getCoffeeDetails method to ProductRepository**

In `src/repositories/index.ts`, add after `setCoffeeDetails`:

```typescript
  async getCoffeeDetails(productId: number) {
    const result = await this.db
      .select()
      .from(coffeeDetails)
      .where(eq(coffeeDetails.productId, productId));
    return result[0] || null;
  }
```

- [ ] **Step 4: Update product callback to show brewGuide**

Now update the `product:` callback handler:

```typescript
bot.callbackQuery(/^product:(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery({ text: '⏳ در حال بارگذاری...' });
    const id = parseInt(ctx.match[1]);
    const repo = new ProductRepository(ctx.env.DB);
    const product = await repo.getProductById(id);
    if (product) {
      const priceUnit =
        (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
      const kb = backKeyboard();
      // Phase 5.2: favorite toggle
      if (ctx.from?.id) {
        const isFav = await new FavoritesRepository(ctx.env.DB).isFavorited(
          String(ctx.from.id),
          id,
        );
        if (isFav) {
          kb.row().text('💔 حذف از علاقمندی‌ها', `fav:remove:${id}`);
        } else {
          kb.row().text('⭐ ذخیره', `fav:add:${id}`);
        }
      }
      let caption = formatProduct(product, priceUnit);
      // Show brew guide for coffee beans with details
      const details = await repo.getCoffeeDetails(id);
      if (details?.brewGuide) {
        caption += `\n\n📋 <b>راهنمای دم‌آوری:</b>\n${details.brewGuide}`;
      }
      if (product.imageUrl) {
        await ctx.replyWithPhoto(product.imageUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      } else {
        await ctx.reply(caption, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }
    } else {
      await ctx.reply('محصول مورد نظر یافت نشد.');
    }
  } catch (e) {
    console.error(e);
    await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    await ctx.reply('❌ خطایی در دریافت اطلاعات محصول رخ داد.');
  }
});
```

- [ ] **Step5: Verify compilation**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step6: Commit**

```bash
git add src/handlers/callbackQuery.ts src/repositories/index.ts
git commit -m "feat(bot): brewGuide display in product detail + passport view"
```

---

### Task 9: Admin App — Image Upload Widget

**Files:**

- Modify: `admin-app/src/api/client.ts` (add apiUpload function)
- Modify: `admin-app/src/pages/ProductsPage.tsx` (add image upload UI)

**Interfaces:**

- Consumes: `PUT /api/products/{id}/image` from Task4
- Produces: image upload/remove UI in admin app

- [ ] **Step 1: Add apiUpload function to client**

In `admin-app/src/api/client.ts`, add after `apiFetch`:

```typescript
export async function apiUpload<T = unknown>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: formData,
    // Don't set Content-Type — fetch sets it with boundary automatically
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Add image upload state and handlers to ProductsPage**

In `admin-app/src/pages/ProductsPage.tsx`, add imports and state:

At the top, add import:

```typescript
import { apiFetch, apiUpload } from '../api/client';
```

In the component, add state (after the existing coffee details state):

```typescript
// Image
const [productImage, setProductImage] = useState<File | null>(null);
const [imagePreview, setImagePreview] = useState<string>('');
```

Add image upload handler:

```typescript
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !editingProduct) return;
  setProductImage(file);
  setImagePreview(URL.createObjectURL(file));
};

const uploadImage = async (productId: number) => {
  if (!productImage) return;
  try {
    await apiUpload(`/products/${productId}/image`, productImage);
    showToast('Image uploaded ✓');
    void queryClient.invalidateQueries({ queryKey: queryKeys.products });
  } catch (err: any) {
    setError(err.message);
    showToast(err.message, 'error');
  }
};

const removeImage = async (productId: number) => {
  try {
    await apiFetch(`/products/${productId}/image`, { method: 'DELETE' });
    setProductImage(null);
    setImagePreview('');
    showToast('Image removed ✓');
    void queryClient.invalidateQueries({ queryKey: queryKeys.products });
  } catch (err: any) {
    setError(err.message);
    showToast(err.message, 'error');
  }
};
```

Update `handleSaveProduct` to upload image after save:

```typescript
const handleSaveProduct = async (e: React.FormEvent) => {
  e.preventDefault();
  saveProductMutation.mutate({
    method: editingProduct ? 'PUT' : 'POST',
    id: editingProduct?.id,
    body: {
      name: prodName,
      price: parseFloat(prodPrice),
      stock: parseInt(prodStock),
      categoryId: parseInt(prodCatId),
      description: prodDesc,
      available: prodAvailable,
      calories: prodCalories ? parseInt(prodCalories) : null,
      allergens: prodAllergens || null,
      caffeineMg: prodCaffeine ? parseInt(prodCaffeine) : null,
      coffeeDetails: buildCoffeeDetails(),
    },
  });
  // Image upload happens after save completes (via onSuccess)
};
```

Actually, we need to trigger the image upload after the product is created/updated. The simplest approach: use the `onSuccess` callback of `saveProductMutation` to upload the image if one is selected.

- [ ] **Step 3: Update saveProductMutation onSuccess to handle image upload**

In `admin-app/src/pages/ProductsPage.tsx`, update the `saveProductMutation`:

```typescript
const saveProductMutation = useMutation({
  mutationFn: (data: { method: string; id?: number; body: any }) =>
    apiFetch(data.id ? `/products/${data.id}` : '/products', {
      method: data.method,
      body: data.body,
    }),
  onSuccess: async (_, variables) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    // Upload image if one was selected
    if (productImage && variables.id) {
      await uploadImage(variables.id);
    } else if (productImage && !variables.id) {
      // For new products, we need the product ID — but the API doesn't return it
      // We'll need to handle this differently
      // For now, skip image upload on create (user can add image after creating)
      showToast('Product added. Add image via Edit.', 'info');
    }
    resetProductForm();
    showToast(variables.id ? 'Product updated ✓' : 'Product added ✓');
  },
  onError: (err: Error) => {
    setError(err.message);
    showToast(err.message, 'error');
  },
});
```

- [ ] **Step 4: Add image upload UI to the form**

In the form JSX, add after the "Available" checkbox and before the "Coffee Details" divider:

```tsx
            <div className="section-divider">Product Image</div>
            {editingProduct?.imageUrl && !productImage && (
              <div style={{ marginBottom: '8px' }}>
                <img
                  src={editingProduct.imageUrl}
                  alt="Product"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <button
                  type="button"
                  className="danger"
                  style={{ marginLeft: '8px' }}
                  onClick={() => removeImage(editingProduct.id)}
                >
                  Remove
                </button>
              </div>
            )}
            {imagePreview && (
              <div style={{ marginBottom: '8px' }}>
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }}
                />
              </div>
            )}
            <Field label="Upload Image">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
              />
            </Field>

            <div className="section-divider">Nutritional Information</div>
```

- [ ] **Step 5: Verify compilation**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add admin-app/src/api/client.ts admin-app/src/pages/ProductsPage.tsx
git commit -m "feat(admin): image upload widget on products page"
```

---

### Task 10: Admin App — Nutritional Fields

**Files:**

- Modify: `admin-app/src/pages/ProductsPage.tsx` (add form fields)

**Interfaces:**

- Consumes: nutritional fields in POST/PUT body from Task5
- Produces: calories, allergens, caffeineMg form inputs

- [ ] **Step 1: Add nutritional form state**

In `admin-app/src/pages/ProductsPage.tsx`, add state variables (after existing coffee details state):

```typescript
// Nutritional info
const [prodCalories, setProdCalories] = useState('');
const [prodAllergens, setProdAllergens] = useState('');
const [prodCaffeine, setProdCaffeine] = useState('');
```

- [ ] **Step 2: Update startEditProduct to populate nutritional fields**

In the `startEditProduct` function, add:

```typescript
setProdCalories(p.calories?.toString() || '');
setProdAllergens(p.allergens || '');
setProdCaffeine(p.caffeineMg?.toString() || '');
```

- [ ] **Step3: Update resetProductForm to clear nutritional fields**

In the `resetProductForm` function, add:

```typescript
setProdCalories('');
setProdAllergens('');
setProdCaffeine('');
```

- [ ] **Step4: Update handleSaveProduct to include nutritional fields**

In `handleSaveProduct`, update the body to include:

```typescript
      body: {
        name: prodName,
        price: parseFloat(prodPrice),
        stock: parseInt(prodStock),
        categoryId: parseInt(prodCatId),
        description: prodDesc,
        available: prodAvailable,
        calories: prodCalories ? parseInt(prodCalories) : null,
        allergens: prodAllergens || null,
        caffeineMg: prodCaffeine ? parseInt(prodCaffeine) : null,
        coffeeDetails: buildCoffeeDetails(),
      },
```

- [ ] **Step5: Add nutritional form fields to JSX**

In the form, add after the "Nutritional Information" divider (from Task9):

```tsx
            <Field label="Calories (kcal)">
              <input
                type="number"
                value={prodCalories}
                onChange={(e) => setProdCalories(e.target.value)}
                placeholder="e.g. 120"
              />
            </Field>
            <Field label="Caffeine (mg)">
              <input
                type="number"
                value={prodCaffeine}
                onChange={(e) => setProdCaffeine(e.target.value)}
                placeholder="e.g. 63"
              />
            </Field>
            <Field label="Allergens">
              <input
                value={prodAllergens}
                onChange={(e) => setProdAllergens(e.target.value)}
                placeholder="e.g. milk, gluten"
                dir="auto"
              />
            </Field>
```

- [ ] **Step6: Add nutritional info to product list rows**

In the product list JSX, add nutritional info display after the price:

```tsx
<div className="list-item-info">
  {(isSuperAdmin || allowedCatId) && (
    <input
      type="checkbox"
      checked={selectedProductIds.includes(p.id)}
      onChange={() => toggleProductSelect(p.id)}
    />
  )}
  {p.imageUrl && (
    <img
      src={p.imageUrl}
      alt=""
      style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }}
    />
  )}
  <span dir="auto">{p.name}</span>
  <span className="list-item-meta">{p.price}</span>
  {(p.calories || p.caffeineMg) && (
    <span className="list-item-meta" style={{ fontSize: '0.8em' }}>
      {p.calories ? `${p.calories} kcal` : ''}
      {p.calories && p.caffeineMg ? ' · ' : ''}
      {p.caffeineMg ? `${p.caffeineMg}mg caf` : ''}
    </span>
  )}
</div>
```

- [ ] **Step7: Verify compilation**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step8: Commit**

```bash
git add admin-app/src/pages/ProductsPage.tsx
git commit -m "feat(admin): nutritional info fields on products page"
```

---

### Task 11: Admin App — brewGuide in Coffee Details

**Files:**

- Modify: `admin-app/src/pages/ProductsPage.tsx` (add brewGuide textarea)

**Interfaces:**

- Consumes: `coffeeDetails.brewGuide` field from Task1
- Produces: brewGuide textarea in coffee details form

- [ ] **Step1: Add brewGuide state**

In `admin-app/src/pages/ProductsPage.tsx`, add state:

```typescript
const [coffeeBrewGuide, setCoffeeBrewGuide] = useState('');
```

- [ ] **Step2: Update startEditProduct to populate brewGuide**

In `startEditProduct`, add:

```typescript
setCoffeeBrewGuide(cd?.brewGuide || '');
```

- [ ] **Step3: Update resetProductForm to clear brewGuide**

In `resetProductForm`, add:

```typescript
setCoffeeBrewGuide('');
```

- [ ] **Step4: Update buildCoffeeDetails to include brewGuide**

In `buildCoffeeDetails`, add `brewGuide` to the fields array:

```typescript
const fields = [
  ['origin', coffeeOrigin],
  ['farm', coffeeFarm],
  ['altitude', coffeeAltitude],
  ['processing', coffeeProcessing],
  ['variety', coffeeVariety],
  ['roastLevel', coffeeRoastLevel],
  ['flavorNotes', coffeeFlavorNotes],
  ['recommendedBrew', coffeeRecommendedBrew],
  ['acidity', coffeeAcidity],
  ['body', coffeeBody],
  ['brewGuide', coffeeBrewGuide],
] as const;
```

- [ ] **Step5: Add brewGuide textarea to coffee details form**

In the coffee details form JSX, add after the "Body" field:

```tsx
<Field label="Brew Guide">
  <textarea
    value={coffeeBrewGuide}
    onChange={(e) => setCoffeeBrewGuide(e.target.value)}
    placeholder=" Brewing instructions in Persian"
    dir="auto"
  />
</Field>
```

- [ ] **Step6: Verify compilation**

Run: `cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step7: Commit**

```bash
git add admin-app/src/pages/ProductsPage.tsx
git commit -m "feat(admin): brewGuide textarea in coffee details form"
```

---

### Task 12: Integration Tests + Final Verification

**Files:**

- Modify: `src/tests/formatters.test.ts` (verify all nutritional tests pass)
- Modify: `src/tests/router-products.test.ts` (verify all image + nutritional tests pass)

**Interfaces:**

- Consumes: all previous tasks
- Produces: full test suite green

- [ ] **Step1: Run full test suite**

Run: `npm test`
Expected: ALL tests pass (130 existing + new)

- [ ] **Step2: Run typecheck on both packages**

Run: `npm run typecheck && cd admin-app && npm run typecheck`
Expected: PASS

- [ ] **Step3: Run lint**

Run: `npm run lint && cd admin-app && npm run lint`
Expected: No new violations (baseline: root ≤137, admin ≤294)

- [ ] **Step4: Commit any final fixes**

If any fixes were needed, commit them.

```bash
git add -A
git commit -m "chore: Phase6a integration fixes"
```

---

## Deployment Notes

1. Create R2 bucket: `wrangler r2 bucket create azadi-products`
2. Enable public access on the R2 bucket in Cloudflare dashboard (Settings → Public Access → R2.dev subdomain)
3. Run migration: `npx drizzle-kit push` (or let CI handle it)
4. Deploy Worker: `npm run deploy`
5. Deploy admin app: `cd admin-app && npm run build && wrangler pages deploy dist --project-name=azadi-admin`
