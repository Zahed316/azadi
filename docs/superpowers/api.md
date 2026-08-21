# REST API Reference

Complete API reference for both the Admin API and Public API. See also: [architecture.md](architecture.md) for request flow, [database.md](database.md) for data model, [admin-app.md](admin-app.md) and [menu-app.md](menu-app.md) for how each frontend consumes these APIs.

## Auth Flow

### Admin API (`/api/*`)

Every request (except `/api/health`) requires:

```
Authorization: Telegram <rawInitData>
```

The Worker validates:

1. HMAC signature of `rawInitData` against `TELEGRAM_BOT_TOKEN`
2. `auth_date` field is within 24 hours (86400 seconds) — Telegram's default is 5 minutes, but this is extended to prevent admin app session expiry
3. The `user.id` from the decoded data exists in the `admins` table

The authenticated user's role (`super_admin` or `category_admin`) and `allowedCategoryId` are passed to every resource handler.

### Public API (`/api/public/*`)

No authentication required. Fully public.

### Health Check

```
GET /api/health
```

No auth required. Returns:

```json
{ "status": "ok" | "degraded", "db": true | false, "timestamp": "..." }
```

## CORS

### Admin API

Allowed origins:

- `https://azadi-admin.pages.dev`
- `https://azadi-menu.pages.dev`
- `https://web.telegram.org`

`OPTIONS` returns 204 with CORS headers (preflight only).

### Public API

`Access-Control-Allow-Origin: *` (fully public).

## Rate Limiting

The Public API implements fixed-window rate limiting per IP:

- **100 requests per 60-second window**
- Uses `CF-Connecting-IP` header
- Stored in KV

## Admin API Endpoints

All paths are relative to `/api/`. The resource handler dispatch is first-match-wins across 11 handlers.

### Role Requirements

| Role             | Access                                                                             |
| ---------------- | ---------------------------------------------------------------------------------- |
| `super_admin`    | Full access to all endpoints                                                       |
| `category_admin` | Read access to all resources; write access restricted to their `allowedCategoryId` |

### Admins (`/admins`)

| Method   | Path          | Auth        | Body                                                                                    | Response                           |
| -------- | ------------- | ----------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| `GET`    | `/admins`     | super_admin | —                                                                                       | `{ admins: Admin[] }`              |
| `POST`   | `/admins`     | super_admin | `{ telegramId: string, role?: "super_admin" \| "category_admin", categoryId?: string }` | `{ success: true }` (201)          |
| `DELETE` | `/admins/:id` | super_admin | —                                                                                       | 204. Cannot delete yourself (403). |

### Settings (`/settings`)

| Method   | Path             | Auth              | Body                                                             | Response                                                                                                          |
| -------- | ---------------- | ----------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/settings`      | any authenticated | —                                                                | `{ settings: [{ key, value }] }` (sensitive keys filtered: `bot_token`, `api_key`, `secret`, `password`, `token`) |
| `POST`   | `/settings`      | super_admin       | `{ settings: [{ key: string, value: string }] }` (max 100 items) | `{ success: true }` (201)                                                                                         |
| `PUT`    | `/settings/:key` | super_admin       | `{ value: string }`                                              | `{ success: true }`                                                                                               |
| `DELETE` | `/settings/:key` | super_admin       | —                                                                | 204                                                                                                               |

### Categories (`/categories`)

| Method   | Path              | Auth              | Body                                                                         | Response                     |
| -------- | ----------------- | ----------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| `GET`    | `/categories`     | any authenticated | —                                                                            | `{ categories: Category[] }` |
| `POST`   | `/categories`     | super_admin       | `{ name: string, description?: string, emoji?: string, sortOrder?: number }` | `{ success: true }` (201)    |
| `PUT`    | `/categories/:id` | super_admin       | `{ name: string, description?: string, emoji?: string, sortOrder?: number }` | `{ success: true }`          |
| `DELETE` | `/categories/:id` | super_admin       | —                                                                            | 204                          |

### Products (`/products`)

| Method   | Path                   | Auth                                            | Body                                                                                 | Response                                                                                 |
| -------- | ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `GET`    | `/products`            | any authenticated                               | —                                                                                    | `{ products: Product[] }` (includes `coffee_details`, `category_name`, `category_emoji`) |
| `POST`   | `/products`            | super_admin or category_admin (own category)    | `ProductBody`                                                                        | `{ success: true }` (201)                                                                |
| `PUT`    | `/products/:id`        | super_admin or category_admin (own category)    | `ProductBody`                                                                        | `{ success: true }`                                                                      |
| `DELETE` | `/products/:id`        | super_admin or category_admin (own category)    | —                                                                                    | 204                                                                                      |
| `POST`   | `/products/batch`      | super_admin or category_admin (per-product)     | `{ ids: number[], action: "update" \| "delete", updateData?: Partial<ProductBody> }` | `{ success: true, results: [{ id, status }] }`                                           |
| `PUT`    | `/products/:id/stock`  | super_admin or category_admin (own category)    | `{ stock: number }`                                                                  | `{ success: true }`                                                                      |
| `PUT`    | `/products/:id/toggle` | super_admin or category_admin (own category)    | `{ available: boolean }`                                                             | `{ success: true }`                                                                      |
| `PUT`    | `/products/:id/image`  | super_admin or category_admin (own category)    | `{ imageUrl: string }` (URL validated)                                               | `{ success: true, imageUrl }`                                                            |
| `DELETE` | `/products/:id/image`  | super_admin or category_admin (own category)    | —                                                                                    | `{ success: true }`                                                                      |
| `POST`   | `/products/:id/clone`  | super_admin or category_admin (source category) | `{ targetBranchId: number }`                                                         | `{ product: Product }` (201)                                                             |

**`ProductBody` shape:**

```json
{
  "name": "string (required)",
  "categoryId": "number (required)",
  "description": "string | null",
  "price": "number | null",
  "unit": "item | kg | g | cup (default: item)",
  "stock": "number (default: 0)",
  "available": "boolean (default: true)",
  "featured": "boolean (default: false)",
  "isSeasonal": "boolean (default: false)",
  "priceOnRequest": "boolean (default: false)",
  "imageUrl": "string | null",
  "sizeOptions": "string | null",
  "syrupOptions": "string | null",
  "calories": "number | null",
  "caffeineMg": "number | null",
  "allergens": "string | null",
  "coffeeDetails": {
    "origin": "string | null",
    "farm": "string | null",
    "altitude": "string | null",
    "processing": "string | null",
    "variety": "string | null",
    "roastLevel": "string | null",
    "flavorNotes": "string | null",
    "recommendedBrew": "string | null",
    "acidity": "string | null",
    "body": "string | null",
    "brewGuide": "string | null"
  } | null
}
```

### FAQs (`/faqs`)

| Method   | Path        | Auth              | Body                                   | Response                  |
| -------- | ----------- | ----------------- | -------------------------------------- | ------------------------- |
| `GET`    | `/faqs`     | any authenticated | —                                      | `{ faqs: Faq[] }`         |
| `POST`   | `/faqs`     | super_admin       | `{ question: string, answer: string }` | `{ success: true }` (201) |
| `PUT`    | `/faqs/:id` | super_admin       | `{ question: string, answer: string }` | `{ success: true }`       |
| `DELETE` | `/faqs/:id` | super_admin       | —                                      | 204                       |

### Branches (`/branches`)

| Method   | Path            | Auth              | Body                                                                                                              | Response                  |
| -------- | --------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `GET`    | `/branches`     | any authenticated | —                                                                                                                 | `{ branches: Branch[] }`  |
| `POST`   | `/branches`     | super_admin       | `{ name: string, address: string, phone?: string, location?: string, openingHours?: string, isActive?: boolean }` | `{ success: true }` (201) |
| `PUT`    | `/branches/:id` | super_admin       | `{ name: string, address: string, phone?: string, location?: string, openingHours?: string, isActive?: boolean }` | `{ success: true }`       |
| `DELETE` | `/branches/:id` | super_admin       | —                                                                                                                 | 204                       |

### Menu Config (`/menu-config`)

| Method   | Path                   | Auth              | Body                                                                                                                                     | Response                              |
| -------- | ---------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `GET`    | `/menu-config`         | any authenticated | —                                                                                                                                        | `{ menuConfigs: MenuConfig[] }`       |
| `POST`   | `/menu-config`         | super_admin       | `{ categoryId: string, menuSection: string, displayOrder?: number, isVisible?: boolean, buttonLabel?: string, specialMessage?: string }` | `{ success: true, menuConfig }` (201) |
| `POST`   | `/menu-config/reorder` | super_admin       | `{ items: [{ id: number, displayOrder: number }] }`                                                                                      | `{ success: true }`                   |
| `PUT`    | `/menu-config/:id`     | super_admin       | `{ menuSection?, displayOrder?, isVisible?, buttonLabel?, specialMessage? }`                                                             | `{ success: true }`                   |
| `DELETE` | `/menu-config/:id`     | super_admin       | —                                                                                                                                        | 204                                   |

### Messages (`/messages`)

| Method | Path                     | Auth        | Body                    | Response                                                              |
| ------ | ------------------------ | ----------- | ----------------------- | --------------------------------------------------------------------- |
| `GET`  | `/messages`              | super_admin | —                       | `{ messages: Message[] }`                                             |
| `GET`  | `/messages/unread-count` | super_admin | —                       | `{ count: number }`                                                   |
| `GET`  | `/messages/:id`          | super_admin | —                       | `Message` (marks as read automatically; 404 if not found)             |
| `POST` | `/messages/:id/reply`    | super_admin | `{ replyText: string }` | `{ success: true }` (201). Also sends a Telegram message to the user. |

### AI Logs (`/ai-logs`)

| Method | Path       | Auth        | Body | Response            |
| ------ | ---------- | ----------- | ---- | ------------------- |
| `GET`  | `/ai-logs` | super_admin | —    | `{ logs: AiLog[] }` |

Query params: `?userId=<id>` (filter by user), `?limit=<n>` (1–200, default 50).

### AI Test (`/ai-test`)

| Method | Path       | Auth        | Body                | Response               |
| ------ | ---------- | ----------- | ------------------- | ---------------------- |
| `POST` | `/ai-test` | super_admin | `{ query: string }` | `{ response: string }` |

### AI Chat (`/ai`)

| Method | Path          | Auth        | Body                               | Response                                                    |
| ------ | ------------- | ----------- | ---------------------------------- | ----------------------------------------------------------- |
| `POST` | `/ai/chat`    | super_admin | `{ message: string }`              | AI chat response. 500 if `OPENCODE_API_KEY` not configured. |
| `POST` | `/ai/execute` | super_admin | `{ tool: string, params: object }` | Tool execution response                                     |
| `GET`  | `/ai/history` | super_admin | —                                  | `{ logs: AiLog[] }`                                         |

Query params: `?userId=<id>`, `?limit=<n>` (1–200, default 50).

### Current User (`/currentUser`)

| Method | Path           | Auth              | Body | Response                                          |
| ------ | -------------- | ----------------- | ---- | ------------------------------------------------- |
| `GET`  | `/currentUser` | any authenticated | —    | Admin's role info (`{ role, allowedCategoryId }`) |

## Public API Endpoints

All paths are relative to `/api/public/`. GET only (405 for other methods).

### Envelope Format

Every response is wrapped in an envelope:

```json
{ "<key>": [...] }
```

The menu-app's `apiFetch<T>(path, envelopeKey)` unwraps this automatically when you pass the envelope key. **Forgetting the key** means the page receives the wrapper object instead of the data array — `.map()` silently produces nothing (empty page) or crashes.

| Endpoint             | Envelope key |
| -------------------- | ------------ |
| `/categories`        | `categories` |
| `/products`          | `products`   |
| `/products/:id`      | `product`    |
| `/products/featured` | `products`   |
| `/products/seasonal` | `products`   |
| `/branches`          | `branches`   |
| `/faq`               | `faqs`       |
| `/menu`              | `sections`   |
| `/settings`          | `settings`   |

### Endpoints

| Path                     | Description       | Filtering                                                                                                  |
| ------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /categories`        | All categories    | —                                                                                                          |
| `GET /products`          | All products      | `available = true` only. Optional `?categoryId=N` for server-side filtering. Stock hidden for `cup` units. |
| `GET /products/featured` | Featured products | `featured = true` AND `available = true`                                                                   |
| `GET /products/seasonal` | Seasonal products | `isSeasonal = true` AND `available = true`                                                                 |
| `GET /products/:id`      | Single product    | `available = true` only. Includes `coffee_details` and `category`. 404 if not found or unavailable.        |
| `GET /branches`          | All branches      | `isActive = true` only                                                                                     |
| `GET /faq`               | All FAQ entries   | —                                                                                                          |
| `GET /menu`              | Menu sections     | `isVisible = true` only, ordered by `displayOrder`                                                         |
| `GET /settings`          | Shop settings     | Whitelisted keys only: `about`, `price_unit`, `instagram`, `welcome_message`, `vat_note`, `announcement`   |

### Rate Limiting

Fixed-window per IP via KV: **100 requests per 60-second window**. Uses `CF-Connecting-IP` header for identification.

## Error Responses

All errors return JSON:

```json
{ "error": "Error message" }
```

| Status | Meaning                                                                      |
| ------ | ---------------------------------------------------------------------------- |
| 400    | Bad request (missing/invalid body)                                           |
| 401    | Missing or invalid `Authorization` header                                    |
| 403    | Not an admin, or `category_admin` accessing resources outside their category |
| 404    | Resource not found                                                           |
| 405    | Wrong HTTP method (public API only)                                          |
| 500    | Internal error (stack traces never included in responses)                    |

## Cache Invalidation

Every mutation in the Admin API invalidates the relevant KV cache entries after the D1 write:

| Resource    | Cache prefix deleted                                                   |
| ----------- | ---------------------------------------------------------------------- |
| Products    | `cache:products:`                                                      |
| Categories  | `cache:menu:`, `cache:visible-categories`, `cache:settings:categories` |
| Branches    | `cache:branches:`                                                      |
| FAQs        | `cache:faq:all`                                                        |
| Settings    | `cache:settings:`                                                      |
| Menu config | `cache:menu:`, `cache:visible-categories`                              |

D1 is always updated first, then the external store (KV cache). See [conventions.md](conventions.md) for the delete ordering rationale.
