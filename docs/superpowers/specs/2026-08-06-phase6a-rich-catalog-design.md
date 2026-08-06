# Phase 6a — Rich Catalog (Product Images + Nutritional Info)

**Date:** 2026-08-06
**Status:** Approved
**Scope:** Data model, API, bot UI, admin app for product images and nutritional info

## Goal

Enrich the product catalog with images (R2 upload + external URL fallback), nutritional information (calories, allergens, caffeine), and enhanced coffee details (brew guide). Display these in both the Telegram bot and admin Mini App.

## 1. Data Model

### New columns on `products`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `calories` | `integer` | `null` | kcal per serving |
| `allergens` | `text` | `null` | Comma-separated list (e.g., `"milk,gluten,nuts"`) |
| `caffeineMg` | `integer` | `null` | Caffeine in milligrams |

### New column on `coffee_details`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `brewGuide` | `text` | `null` | Brewing instructions (Persian text) |

### Image storage

- **R2 bucket**: `azadi-products`
- **Object key**: `products/{productId}/{sha256-hex}.{ext}`
- **Public access**: R2.dev subdomain (`pub-{hash}.r2.dev`)
- **Fallback**: If no R2 image, use `imageUrl` text field (external URL or null)

### MigrationSingle Drizzle migration (`drizzle/0006_*.sql`):

```sql
ALTER TABLE products ADD calories integer;
ALTER TABLE products ADD allergens text;
ALTER TABLE products ADD caffeine_mg integer;
ALTER TABLE coffee_details ADD brew_guide text;
```

Zero-downtime, no renames, fully backward-compatible.

## 2. API Endpoints

### New

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `PUT` | `/api/products/{id}/image` | category_admin (scoped) | Upload image to R2. `multipart/form-data` with `file` field. Returns `{ imageUrl }` |
| `DELETE` | `/api/products/{id}/image` | category_admin (scoped) | Remove image from R2, clear `imageUrl` |

### Modified

- **`GET /api/products`** — response gains `calories`, `allergens`, `caffeineMg` fields. `imageUrl` is now either R2 public URL or external URL.
- **`POST /api/products`** and **`PUT /api/products/{id}`** — accept `calories`, `allergens`, `caffeineMg` in body. `brewGuide` joins the `coffeeDetails` nested object.

### Image upload flow

```
Admin app → PUT /api/products/{id}/image (multipart)
  → Validate content-type (jpg/png/webp, max 5MB)
  → Upload to R2: products/{id}/{hash}.{ext}
  → Update products.imageUrl = R2 public URL
  → Return { imageUrl }
```

### Error responses (Persian)

- Invalid content type → `400` `"فقط فایل‌های JPG، PNG و WebP پشتیبانی می‌شوند"`
- File too large → `400` `"حجم فایل نباید بیشتر از ۵ مگابایت باشد"`
- R2 failure → `500` `"خطا در آپلود تصویر"`
- Product not found → `404`

## 3. Bot UI

### Product detail view (`product:{id}`)

When image exists, switch from `editMessageText` to `sendPhoto`:

```
[Product Image]
Caption (HTML):
  ☕ Product Name
  💰 ۴۵,۰۰۰ تومان
  📦 موجودی: ۱۲ عدد        (if stock > 0, not cups)
  🔥 ۱۲۰ کالری             (if calories present)
  ⚡ کافئین: ۶۳ میلی‌گرم   (if caffeineMg present)
  ⚠️ آلرژن‌ها: شیر         (if allergens present)

  [⭐ افزودن به علاقه‌مندی]
  [🔙 بازگشت]
```

No image → falls back to current text-only behavior (no change).

### Coffee Passport view (`pasport:{id}`)

Gains `brewGuide` section at the bottom of the existing coffee details display. Shown only when `brewGuide` is non-null.

### Behavior rules

- Nutritional fields: only shown if non-null (no empty rows)
- Featured/seasonal lists: stay text-only (images in paginated lists would be too slow)
- Image URL is read from the `imageUrl` field (R2 or external — consumer doesn't know which)

## 4. Admin App

### ProductsPage — image upload widget

Each product's edit form gains an image section:

```
Product Image
┌──────────┐
│ [Photo] │  ← thumbnail preview (if image exists)
└──────────┘
[Choose File] [Remove]

Or paste URL:
┌──────────────────────────────┐
│ https://...                  │
└──────────────────────────────┘
```

- Upload sends `PUT /api/products/{id}/image` (multipart)
- Remove sends `DELETE /api/products/{id}/image`
- External URL fallback: paste into existing `imageUrl` text field
- Thumbnail:48×48 in product list rows, larger in edit form

### ProductsPage — nutritional info fields

New card section below existing product form:

```
Nutritional Information
┌──────────────────────────────┐
│ Calories (kcal): [        ]  │
│ Caffeine (mg):   [        ]  │
│ Allergens:        [        ]  │  ← comma-separated text
└──────────────────────────────┘
```

### Coffee details — brew guide

Existing `coffeeDetails` form gains a `brewGuide` textarea field.

### Responsive foundations

- Form fields: `width: 100%` + `max-width`
- Image upload widget: large touch targets
- Nutritional fields: stack vertically on small screens

## 5. R2 Integration

### Wrangler config

```toml
[[r2_buckets]]
binding = "PRODUCT_IMAGES"
bucket_name = "azadi-products"
```

### Env type

Add `PRODUCT_IMAGES: R2Bucket` to Worker env interface.

### File management

- **Naming**: `products/{productId}/{sha256-hex}.{ext}` — content-addressed, prevents duplicates
- **Max size**:5 MB (enforced at Worker level)
- **Allowed types**: `image/jpeg`, `image/png`, `image/webp`
- **Cleanup**: DELETE endpoint removes from R2 + clears `imageUrl`

## 6. Testing

| Test file | Coverage |
|-----------|----------|
| `src/tests/router-products.test.ts` | Image upload (valid/invalid types, size limit, product not found) |
| `src/tests/router-products.test.ts` | Image delete |
| `src/tests/router-products.test.ts` | Nutritional fields in POST/PUT/GET |
| New or existing repo test | ProductRepository methods for new fields |

## 7. Out of Scope (Phase6b)

- Responsive UI redesign (admin app + bot)
- Image lazy-loading and responsive sizing
- Bot adaptive inline keyboard layouts

## 8. Dependencies

- Cloudflare R2 bucket must be created before deploy (`wrangler r2 bucket create azadi-products`)
- No external service dependencies
- No breaking changes to existing API consumers

## 9. Lint Baseline

- Root: ≤137 warnings (COUNT, not category)
- Admin-app: ≤294 warnings (COUNT, not category)
- No new lint categories introduced

## 10. Deployment

1. Create R2 bucket: `wrangler r2 bucket create azadi-products`
2. Add R2 binding to `wrangler.toml`
3. Run migration: `npx drizzle-kit push`
4. Deploy Worker: `npm run deploy`
5. Deploy admin app: `cd admin-app && npm run build && wrangler pages deploy dist --project-name=azadi-admin`
