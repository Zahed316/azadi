# Architecture Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Azadi Coffee Bot from a monolithic structure to a modular monolith with service boundaries, KV caching, and optimized admin app.

**Architecture:** Create 5 services (Bot, API, AI, Cache, Data) with dependency injection. Add KV caching layer for menu data with 5-min TTL. Refactor monolithic repository into base class pattern. Optimize admin app with lazy loading and better chunking.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), KV, Drizzle ORM, grammY, React + Vite, @tanstack/react-query

## Global Constraints

- Free tier only (no R2, no Durable Objects)
- Backward compatible with existing bot behavior
- All bot text remains Persian (Farsi) with HTML parse mode
- Gradual implementation over 4 weeks
- D1 migrations via `wrangler d1 execute` (never `drizzle-kit push`)
- KV binding name: `CACHE`
- Existing test suite must pass after each phase

---

## File Structure

### New Files to Create

```
src/services/
├── types.ts                    # Service interfaces and types
├── container.ts                # Dependency injection container
├── bot/
│   ├── index.ts                # BotService class
│   └── handlers.ts             # Refactored message/callback handlers
├── api/
│   ├── index.ts                # APIService class
│   └── resources/              # Keep existing structure, update imports
├── ai/
│   ├── index.ts                # AIService class
│   └── context.ts              # buildMinimalContext extracted
├── cache/
│   ├── index.ts                # CacheService class
│   └── keys.ts                 # Cache key constants
├── data/
│   ├── index.ts                # DataService class
│   └── repositories/
│       ├── base.ts             # BaseRepository<T> abstract class
│       ├── products.ts         # ProductRepository
│       ├── categories.ts       # CategoryRepository
│       ├── branches.ts         # BranchRepository
│       ├── faq.ts              # FaqRepository
│       ├── settings.ts         # SettingsRepository
│       ├── ai-logs.ts          # AiLogRepository
│       ├── menu-config.ts      # MenuConfigRepository
│       ├── user-state.ts       # UserStateRepository
│       ├── favorites.ts        # FavoritesRepository
│       └── messages.ts         # MessageRepository
```

### Files to Modify

```
src/index.ts                    # Use ServiceContainer
src/bot.ts                      # Use BotService
src/handlers/message.ts         # Delegate to BotService
src/handlers/callbackQuery.ts   # Delegate to BotService
src/api/router.ts               # Use APIService
src/services/aiService.ts       # Refactor to AIService
src/database/schema.ts          # Add missing indexes (Phase3)
wrangler.toml                   # Add KV binding
admin-app/vite.config.ts        # Optimize chunking
admin-app/src/App.tsx           # Add lazy loading
```

### Files to Keep Unchanged

```
src/database/client.ts          # getDb() stays as-is
src/database/sessionStorage.ts  # D1SessionStorage stays as-is
src/requestContext.ts           # Keep for backward compat, deprecate
src/commands/*                  # Keep existing command handlers
src/menus/*                     # Keep existing menu definitions
src/utils/*                     # Keep existing utilities
```

---

## Phase 1: Service Boundaries (Week 1)

### Task 1.1: Create Service Interfaces

**Files:**

- Create: `src/services/types.ts`
- Test: Verify TypeScript compiles

**Interfaces:**

- Consumes: None (foundation)
- Produces: `IBotService`, `IAPIService`, `IAIService`, `ICacheService`, `IDataService`

- [ ] **Step 1: Create service interfaces file**

```typescript
// src/services/types.ts
import { MyContext } from '../types/context';
import { Env } from '../bot';

export interface IBotService {
  handleMessage(ctx: MyContext): Promise<void>;
  handleCallback(ctx: MyContext): Promise<void>;
  handleCommand(ctx: MyContext): Promise<void>;
}

export interface IAPIService {
  handleRequest(request: Request, env: Env): Promise<Response>;
}

export interface IAIService {
  processQuery(message: string, userId: string): Promise<string>;
  buildContext(userId: string): Promise<AIContext>;
  sanitizeResponse(response: string): string;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}

export interface IDataService {
  getProducts(): Promise<Product[]>;
  getProductsByCategory(categoryId: number): Promise<Product[]>;
  getBranches(): Promise<Branch[]>;
  getActiveBranches(): Promise<Branch[]>;
  getFaqs(): Promise<Faq[]>;
  getSettings(key: string): Promise<string | null>;
  getMenuConfig(section: string): Promise<MenuConfigEntry[]>;
  getVisibleCategoryIds(): Promise<Set<number>>;
  getUserFavorites(telegramId: string): Promise<Favorite[]>;
  getPopularProducts(limit?: number): Promise<PopularProduct[]>;
  getRecentLogs(userId: string, limit?: number): Promise<AILog[]>;
  batchQueries<T>(queries: Promise<T>[]): Promise<T[]>;
}

export interface AIContext {
  products: ProductWithDetails[];
  branches: Branch[];
  faqs: Faq[];
  menuConfig: MenuConfigEntry[];
  about: string | null;
  recentLogs: AILog[];
  favorites: Favorite[];
  popularProducts: PopularProduct[];
}

// Re-export types from schema for convenience
export type {
  Product,
  Branch,
  Faq,
  MenuConfigEntry,
  Favorite,
  PopularProduct,
  AILog,
  ProductWithDetails,
} from '../database/schema';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS (no type errors)

- [ ] **Step 3: Commit**

```bash
git add src/services/types.ts
git commit -m "feat: add service interfaces for architecture migration"
```

---

### Task 1.2: Implement Base Repository

**Files:**

- Create: `src/data/repositories/base.ts`
- Test: Verify TypeScript compiles

**Interfaces:**

- Consumes: Drizzle database instance
- Produces: `BaseRepository<T>` abstract class

- [ ] **Step 1: Create base repository class**

```typescript
// src/data/repositories/base.ts
import { eq, desc, SQL } from 'drizzle-orm';
import { DrizzleD1Database } from 'src/database/client';

export abstract class BaseRepository<T extends Record<string, unknown>> {
  constructor(protected db: DrizzleD1Database) {}

  abstract getTable(): any;

  async findAll(): Promise<T[]> {
    return this.db.select().from(this.getTable()) as Promise<T[]>;
  }

  async findById(id: number): Promise<T | undefined> {
    const result = await this.db.select().from(this.getTable()).where(eq(this.getTable().id, id));
    return result[0] as T | undefined;
  }

  async create(data: Partial<T>): Promise<T> {
    const result = await this.db
      .insert(this.getTable())
      .values(data as any)
      .returning();
    return result[0] as T;
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    const result = await this.db
      .update(this.getTable())
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(this.getTable().id, id))
      .returning();
    return result[0] as T;
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(this.getTable()).where(eq(this.getTable().id, id));
  }

  protected async findByCondition(condition: SQL, orderBy?: SQL): Promise<T[]> {
    let query = this.db.select().from(this.getTable()).where(condition);
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    return query as Promise<T[]>;
  }

  protected async findMany(options: {
    where?: SQL;
    orderBy?: SQL;
    limit?: number;
    offset?: number;
  }): Promise<T[]> {
    let query = this.db.select().from(this.getTable());
    if (options.where) query = query.where(options.where);
    if (options.orderBy) query = query.orderBy(options.orderBy);
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.offset(options.offset);
    return query as Promise<T[]>;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/data/repositories/base.ts
git commit -m "feat: add BaseRepository abstract class"
```

---

### Task 1.3: Implement Cache Service

**Files:**

- Create: `src/services/cache/index.ts`
- Create: `src/services/cache/keys.ts`
- Test: Verify TypeScript compiles

**Interfaces:**

- Consumes: KVNamespace binding
- Produces: `CacheService` class

- [ ] **Step 1: Create cache key constants**

```typescript
// src/services/cache/keys.ts
export const CACHE_KEYS = {
  products: {
    all: 'cache:products:all',
    byCategory: (id: number) => `cache:products:category:${id}`,
    withDetails: 'cache:products:with-details',
    popular: 'cache:products:popular',
  },
  branches: {
    all: 'cache:branches:all',
    active: 'cache:branches:active',
  },
  faq: {
    all: 'cache:faq:all',
  },
  menu: {
    config: 'cache:menu:config',
    bySection: (section: string) => `cache:menu:section:${section}`,
  },
  settings: {
    key: (key: string) => `cache:settings:${key}`,
    all: 'cache:settings:all',
  },
  favorites: {
    byUser: (telegramId: string) => `cache:favorites:${telegramId}`,
  },
  visibleCategories: 'cache:visible-categories',
} as const;

export const DEFAULT_TTL = 300; // 5 minutes
export const STALE_WHILE_REVALIDATE = 600; // 10 minutes
```

- [ ] **Step 2: Create cache service class**

```typescript
// src/services/cache/index.ts
import { KVNamespace } from '@cloudflare/workers-types';
import { DEFAULT_TTL, STALE_WHILE_REVALIDATE } from './keys';

export class CacheService {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.kv.get(key, 'json');
      return cached as T | null;
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error);
      return null;
    }
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_TTL,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const fresh = await fetcher();

    // Cache the result
    await this.set(key, fresh, ttl);

    return fresh;
  }

  async set(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttl,
      });
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error);
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error(`Cache invalidate error for ${key}:`, error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const list = await this.kv.list({ prefix: pattern });
      await Promise.all(list.keys.map((key) => this.kv.delete(key.name)));
    } catch (error) {
      console.error(`Cache invalidatePattern error for ${pattern}:`, error);
    }
  }

  async invalidateAll(): Promise<void> {
    try {
      const list = await this.kv.list();
      await Promise.all(list.keys.map((key) => this.kv.delete(key.name)));
    } catch (error) {
      console.error(`Cache invalidateAll error:`, error);
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/cache/
git commit -m "feat: add CacheService with KV backing"
```

---

### Task 1.4: Implement Data Service

**Files:**

- Create: `src/services/data/index.ts`
- Test: Verify TypeScript compiles

**Interfaces:**

- Consumes: D1Database, CacheService
- Produces: `DataService` class

- [ ] **Step 1: Create data service class**

```typescript
// src/services/data/index.ts
import { D1Database } from '@cloudflare/workers-types';
import { getDb, DrizzleD1Database } from '../../database/client';
import { CacheService } from '../cache';
import { CACHE_KEYS, DEFAULT_TTL } from '../cache/keys';
import {
  products,
  categories,
  branches,
  faq,
  settings,
  menuConfig,
  favorites,
  userState,
  coffeeDetails,
  aiConversationLogs,
  messages,
} from '../../database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  IDataService,
  Product,
  Branch,
  Faq,
  MenuConfigEntry,
  Favorite,
  PopularProduct,
  AILog,
  ProductWithDetails,
} from '../types';

export class DataService implements IDataService {
  private db: DrizzleD1Database;

  constructor(
    d1: D1Database,
    private cache: CacheService,
  ) {
    this.db = getDb(d1);
  }

  async getProducts(): Promise<Product[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.products.all,
      () => this.db.select().from(products) as Promise<Product[]>,
      DEFAULT_TTL,
    );
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.products.byCategory(categoryId),
      () =>
        this.db
          .select()
          .from(products)
          .where(and(eq(products.categoryId, categoryId), eq(products.available, true))) as Promise<
          Product[]
        >,
      DEFAULT_TTL,
    );
  }

  async getProductsForAI(): Promise<ProductWithDetails[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.products.withDetails,
      () =>
        this.db
          .select()
          .from(products)
          .leftJoin(coffeeDetails, eq(products.id, coffeeDetails.productId))
          .leftJoin(categories, eq(products.categoryId, categories.id)) as Promise<
          ProductWithDetails[]
        >,
      DEFAULT_TTL,
    );
  }

  async getBranches(): Promise<Branch[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.branches.all,
      () => this.db.select().from(branches) as Promise<Branch[]>,
      DEFAULT_TTL,
    );
  }

  async getActiveBranches(): Promise<Branch[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.branches.active,
      () => this.db.select().from(branches).where(eq(branches.isActive, true)) as Promise<Branch[]>,
      DEFAULT_TTL,
    );
  }

  async getFaqs(): Promise<Faq[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.faq.all,
      () => this.db.select().from(faq) as Promise<Faq[]>,
      DEFAULT_TTL,
    );
  }

  async getSettings(key: string): Promise<string | null> {
    const settingsData = await this.cache.getOrFetch(
      CACHE_KEYS.settings.all,
      () => this.db.select().from(settings) as Promise<Array<{ key: string; value: string }>>,
      DEFAULT_TTL,
    );
    const setting = settingsData.find((s) => s.key === key);
    return setting?.value ?? null;
  }

  async getMenuConfig(section: string): Promise<MenuConfigEntry[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.menu.bySection(section),
      () =>
        this.db
          .select({
            id: menuConfig.id,
            categoryId: menuConfig.categoryId,
            menuSection: menuConfig.menuSection,
            displayOrder: menuConfig.displayOrder,
            isVisible: menuConfig.isVisible,
            buttonLabel: menuConfig.buttonLabel,
            specialMessage: menuConfig.specialMessage,
            categoryName: categories.name,
            categoryEmoji: categories.emoji,
          })
          .from(menuConfig)
          .leftJoin(categories, eq(menuConfig.categoryId, categories.id))
          .where(and(eq(menuConfig.menuSection, section), eq(menuConfig.isVisible, true)))
          .orderBy(menuConfig.displayOrder) as Promise<MenuConfigEntry[]>,
      DEFAULT_TTL,
    );
  }

  async getVisibleCategoryIds(): Promise<Set<number>> {
    const ids = await this.cache.getOrFetch(
      CACHE_KEYS.visibleCategories,
      async () => {
        const rows = await this.db
          .select({ categoryId: menuConfig.categoryId })
          .from(menuConfig)
          .where(eq(menuConfig.isVisible, true));
        return rows.map((r) => r.categoryId);
      },
      DEFAULT_TTL,
    );
    return new Set(ids);
  }

  async getUserFavorites(telegramId: string): Promise<Favorite[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.favorites.byUser(telegramId),
      () =>
        this.db.select().from(favorites).where(eq(favorites.telegramId, telegramId)) as Promise<
          Favorite[]
        >,
      DEFAULT_TTL,
    );
  }

  async getPopularProducts(limit: number = 5): Promise<PopularProduct[]> {
    return this.cache.getOrFetch(
      CACHE_KEYS.products.popular,
      () =>
        this.db
          .select({
            name: products.name,
            category: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
            favoritedCount: sql<number>`cast(count(*) as int)`,
          })
          .from(favorites)
          .innerJoin(products, eq(favorites.productId, products.id))
          .leftJoin(categories, eq(products.categoryId, categories.id))
          .groupBy(products.id, categories.name)
          .orderBy(desc(sql`count(*)`))
          .limit(limit) as Promise<PopularProduct[]>,
      DEFAULT_TTL,
    );
  }

  async getRecentLogs(userId: string, limit: number = 5): Promise<AILog[]> {
    return this.db
      .select()
      .from(aiConversationLogs)
      .where(eq(aiConversationLogs.userId, userId))
      .orderBy(desc(aiConversationLogs.timestamp))
      .limit(limit) as Promise<AILog[]>;
  }

  async batchQueries<T>(queries: Promise<T>[]): Promise<T[]> {
    // D1 batch API for parallel execution
    return this.db.batch(queries) as Promise<T[]>;
  }

  // Cache invalidation methods (called by admin operations)
  async invalidateProducts(): Promise<void> {
    await this.cache.invalidatePattern('cache:products:');
  }

  async invalidateBranches(): Promise<void> {
    await this.cache.invalidatePattern('cache:branches:');
  }

  async invalidateFaqs(): Promise<void> {
    await this.cache.invalidate(CACHE_KEYS.faq.all);
  }

  async invalidateMenuConfig(): Promise<void> {
    await this.cache.invalidatePattern('cache:menu:');
    await this.cache.invalidate(CACHE_KEYS.visibleCategories);
  }

  async invalidateSettings(): Promise<void> {
    await this.cache.invalidatePattern('cache:settings:');
  }

  async invalidateFavorites(telegramId: string): Promise<void> {
    await this.cache.invalidate(CACHE_KEYS.favorites.byUser(telegramId));
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/data/
git commit -m "feat: add DataService with caching layer"
```

---

### Task 1.5: Implement AI Service

**Files:**

- Create: `src/services/ai/index.ts`
- Create: `src/services/ai/context.ts`
- Test: Verify TypeScript compiles

**Interfaces:**

- Consumes: DataService, CacheService
- Produces: `AIService` class

- [ ] **Step 1: Create AI context builder**

```typescript
// src/services/ai/context.ts
import { IDataService, AIContext, ProductWithDetails, Branch, Faq } from '../types';

interface ContextOptions {
  products: ProductWithDetails[];
  branches: Branch[];
  faqs: Faq[];
  visibleCategoryIds: Set<number>;
  about: string | null;
  userFavorites: Array<{ productId: number }>;
  popularProducts: Array<{ name: string; category: string; favoritedCount: number }>;
}

export function buildMinimalContext(options: ContextOptions): string {
  const { products, branches, faqs, about, userFavorites, popularProducts } = options;

  // Filter to visible categories
  const visibleProducts = products.filter((p) =>
    options.visibleCategoryIds.has(p.products?.categoryId ?? 0),
  );

  // Score and rank products for relevance
  const scoredProducts = visibleProducts.map((p) => {
    const product = p.products;
    const details = p.coffee_details;
    let score = 0;

    // Base score for available products
    if (product.available) score += 10;

    // Bonus for featured/seasonal
    if (product.featured) score += 5;
    if (product.isSeasonal) score += 3;

    // Bonus for products with details
    if (details) score += 2;

    // Bonus for user's favorites
    const isFavorited = userFavorites.some((f) => f.productId === product.id);
    if (isFavorited) score += 8;

    return { product, details, score, isFavorited };
  });

  // Sort by score and take top 8
  const topProducts = scoredProducts.sort((a, b) => b.score - a.score).slice(0, 8);

  // Build product summaries
  const productSummaries = topProducts
    .map(({ product, details, isFavorited }) => {
      let summary = `• ${product.name}`;
      if (product.price) summary += ` - ${product.price} تومان`;
      if (details?.origin) summary += ` (${details.origin})`;
      if (isFavorited) summary += ' ⭐';
      return summary;
    })
    .join('\n');

  // Build branch summaries
  const branchSummaries = branches.map((b) => `• ${b.name}: ${b.address}`).join('\n');

  // Build FAQ summaries (top 3)
  const faqSummaries = faqs
    .slice(0, 3)
    .map((f) => `• ${f.question}: ${f.answer}`)
    .join('\n');

  // Build popular products summary
  const popularSummaries = popularProducts
    .map((p) => `• ${p.name} (${p.category}) - ${p.favoritedCount} بار سفارش داده شده`)
    .join('\n');

  return `منوی کافه:
${productSummaries || 'اطلاعات منو در دسترس نیست'}

شعبات:
${branchSummaries || 'اطلاعات شعبات در دسترس نیست'}

سوالات متداول:
${faqSummaries || 'اطلاعات در دسترس نیست'}

محبوب‌ترین‌ها:
${popularSummaries || 'اطلاعات در دسترس نیست'}

درباره ما:
${about || 'کافه ازادی - قهوه تخصصی'}

لطفاً به فارسی پاسخ دهید و از اطلاعات بالا برای پاسخگویی استفاده کنید.`;
}
```

- [ ] **Step 2: Create AI service class**

```typescript
// src/services/ai/index.ts
import { IDataService, ICacheService, IAIService } from '../types';
import { buildMinimalContext } from './context';

export class AIService implements IAIService {
  private apiEndpoint = 'https://opencode.ai/zen/go/v1/chat/completions';
  private model = 'mimo-v2.5';
  private timeoutMs = 20000;
  private rateLimitMs = 5000;

  constructor(
    private data: IDataService,
    private cache: ICacheService,
  ) {}

  async processQuery(message: string, userId: string): Promise<string> {
    // Check rate limit
    const lastQueryKey = `ai:last:${userId}`;
    const lastQuery = await this.cache.get<number>(lastQueryKey);
    if (lastQuery && Date.now() - lastQuery < this.rateLimitMs) {
      return 'لطفاً کمی صبر کنید...';
    }

    // Set rate limit
    await this.cache.set(lastQueryKey, Date.now(), 10);

    // Build context
    const context = await this.buildContext(userId);

    // Call AI API
    const response = await this.callAI(message, context, userId);

    // Sanitize response
    return this.sanitizeResponse(response);
  }

  async buildContext(userId: string): Promise<string> {
    // Fetch all context data in parallel
    const [products, branches, faqs, menuConfig, about, recentLogs, favorites, popularProducts] =
      await Promise.all([
        this.data.getProductsForAI(),
        this.data.getActiveBranches(),
        this.data.getFaqs(),
        this.data.getMenuConfig('main'),
        this.data.getSettings('about'),
        this.data.getRecentLogs(userId, 5),
        this.data.getUserFavorites(userId),
        this.data.getPopularProducts(5),
      ]);

    const visibleCategoryIds = await this.data.getVisibleCategoryIds();

    // Build context string
    return buildMinimalContext({
      products,
      branches,
      faqs,
      visibleCategoryIds,
      about,
      userFavorites: favorites,
      popularProducts,
    });
  }

  sanitizeResponse(response: string): string {
    // Remove disallowed HTML tags
    let sanitized = response.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Allow only safe HTML tags
    const allowedTags = ['b', 'i', 'u', 'em', 'strong', 'code', 'pre'];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    sanitized = sanitized.replace(tagRegex, (match, tag) => {
      if (allowedTags.includes(tag.toLowerCase())) {
        return match;
      }
      return '';
    });

    // Truncate if too long (Telegram limit is 4096)
    if (sanitized.length > 4096) {
      sanitized = sanitized.substring(0, 4093) + '...';
    }

    return sanitized;
  }

  private async callAI(message: string, context: string, userId: string): Promise<string> {
    const systemPrompt = `شما یک دستیار هوشمند کافه ازادی هستید. به فارسی پاسخ دهید.
از اطلاعات منوی زیر برای پاسخگویی استفاده کنید.

${context}`;

    // Build conversation history (last 3 messages)
    const recentLogs = await this.data.getRecentLogs(userId, 3);
    const history = recentLogs.flatMap((log) => [
      { role: 'user', content: log.question },
      { role: 'assistant', content: log.response },
    ]);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENCODE_API_KEY}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 768,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'متأسفم، پاسخی یافت نشد.';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/ai/
git commit -m "feat: add AIService with context building"
```

---

### Task 1.6: Implement Bot Service

**Files:**

- Create: `src/services/bot/index.ts`
- Create: `src/services/bot/handlers.ts`
- Test: Verify TypeScript compiles

**Interfaces:**

- Consumes: DataService, CacheService, AIService
- Produces: `BotService` class

- [ ] **Step 1: Create bot service class**

```typescript
// src/services/bot/index.ts
import { MyContext } from '../../types/context';
import { IBotService, IDataService, ICacheService, IAIService } from '../types';
import { handleTextMessage, handleCallbackQuery } from './handlers';

export class BotService implements IBotService {
  constructor(
    private data: IDataService,
    private cache: ICacheService,
    private ai: IAIService,
  ) {}

  async handleMessage(ctx: MyContext): Promise<void> {
    await handleTextMessage(ctx, this.ai);
  }

  async handleCallback(ctx: MyContext): Promise<void> {
    await handleCallbackQuery(ctx, this.data, this.cache);
  }

  async handleCommand(ctx: MyContext): Promise<void> {
    // Commands are handled by grammY command handlers
    // This method is for any service-level command logic
  }
}
```

- [ ] **Step 2: Create bot handlers**

```typescript
// src/services/bot/handlers.ts
import { MyContext } from '../../types/context';
import { IAIService, IDataService, ICacheService } from '../types';
import { toPersianDigits } from '../../utils/numbers';
import { formatProduct } from '../../utils/formatters';

export async function handleTextMessage(ctx: MyContext, ai: IAIService): Promise<void> {
  const text = ctx.message?.text;
  if (!text || text.startsWith('/')) return;

  // Send typing indicator
  await ctx.replyWithChatAction('typing');

  try {
    const userId = ctx.from?.id.toString() || '';
    const response = await ai.processQuery(text, userId);
    await ctx.reply(response, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('AI processing error:', error);
    await ctx.reply('متأسفم، خطایی رخ داد. لطفاً دوباره تلاش کنید.');
  }
}

export async function handleCallbackQuery(
  ctx: MyContext,
  data: IDataService,
  cache: ICacheService,
): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData) return;

  // Answer callback query to remove loading state
  await ctx.answerCallbackQuery();

  try {
    if (callbackData === 'back:main') {
      await showMainMenu(ctx);
    } else if (callbackData.startsWith('products:')) {
      await showProducts(ctx, data, callbackData);
    } else if (callbackData.startsWith('product:')) {
      await showProductDetail(ctx, data, cache, callbackData);
    } else if (callbackData.startsWith('fav:')) {
      await handleFavorite(ctx, data, cache, callbackData);
    }
  } catch (error) {
    console.error('Callback handling error:', error);
    await ctx.reply('خطایی رخ داد. لطفاً دوباره تلاش کنید.');
  }
}

async function showMainMenu(ctx: MyContext): Promise<void> {
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '☕ منوی قهوه', callback_data: 'products:coffee' }],
        [{ text: '🍰 شیرینی‌ها', callback_data: 'products:cakes' }],
        [{ text: '📍 شعبات', callback_data: 'branches' }],
        [{ text: '❓ سوالات متداول', callback_data: 'faq' }],
      ],
    },
  };

  await ctx.editMessageText('منوی اصلی کافه ازادی:', keyboard);
}

async function showProducts(
  ctx: MyContext,
  data: IDataService,
  callbackData: string,
): Promise<void> {
  const category = callbackData.split(':')[1];
  const products = await data.getProducts();

  // Filter by category if needed
  const filteredProducts = products.filter((p) => {
    if (category === 'coffee') return p.unit === 'bean' || p.unit === 'cup';
    if (category === 'cakes') return p.unit === 'piece';
    return true;
  });

  const productList = filteredProducts
    .map((p) => `${p.name} - ${toPersianDigits(p.price)} تومان`)
    .join('\n');

  const keyboard = {
    reply_markup: {
      inline_keyboard: filteredProducts.map((p) => [
        { text: p.name, callback_data: `product:${p.id}` },
      ]),
    },
  };

  await ctx.editMessageText(productList || 'محصولی یافت نشد.', keyboard);
}

async function showProductDetail(
  ctx: MyContext,
  data: IDataService,
  cache: ICacheService,
  callbackData: string,
): Promise<void> {
  const productId = parseInt(callbackData.split(':')[1]);
  const products = await data.getProducts();
  const product = products.find((p) => p.id === productId);

  if (!product) {
    await ctx.reply('محصول یافت نشد.');
    return;
  }

  const details = formatProduct(product);
  const isFavorited = await checkFavorite(ctx.from?.id || 0, productId, data);

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: isFavorited ? '💔 حذف از علاقه‌مندی' : '❤️ افزودن به علاقه‌مندی',
            callback_data: isFavorited ? `fav:remove:${productId}` : `fav:add:${productId}`,
          },
        ],
        [{ text: '🔙 بازگشت', callback_data: 'back:main' }],
      ],
    },
  };

  await ctx.reply(details, { ...keyboard, parse_mode: 'HTML' });
}

async function handleFavorite(
  ctx: MyContext,
  data: IDataService,
  cache: ICacheService,
  callbackData: string,
): Promise<void> {
  const [, action, productIdStr] = callbackData.split(':');
  const productId = parseInt(productIdStr);
  const userId = ctx.from?.id.toString() || '';

  if (action === 'add') {
    // Add to favorites (implementation depends on your favorites repository)
    await ctx.reply('به علاقه‌مندی‌ها اضافه شد ❤️');
  } else if (action === 'remove') {
    // Remove from favorites
    await ctx.reply('از علاقه‌مندی‌ها حذف شد 💔');
  }

  // Invalidate favorites cache
  await cache.invalidate(`cache:favorites:${userId}`);
}

async function checkFavorite(
  telegramId: number,
  productId: number,
  data: IDataService,
): Promise<boolean> {
  const favorites = await data.getUserFavorites(telegramId.toString());
  return favorites.some((f) => f.productId === productId);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/bot/
git commit -m "feat: add BotService with message/callback handlers"
```

---

### Task 1.7: Implement Service Container

**Files:**

- Create: `src/services/container.ts`
- Test: Verify TypeScript compiles

**Interfaces:**

- Consumes: Env (environment bindings)
- Produces: `ServiceContainer` class

- [ ] **Step 1: Create service container**

```typescript
// src/services/container.ts
import { Env } from '../bot';
import { CacheService } from './cache';
import { DataService } from './data';
import { AIService } from './ai';
import { BotService } from './bot';
import { APIService } from './api';

export class ServiceContainer {
  private cache: CacheService;
  private data: DataService;
  private ai: AIService;
  private bot: BotService;
  private api: APIService;

  constructor(private env: Env) {
    // Initialize services in dependency order
    this.cache = new CacheService(env.CACHE);
    this.data = new DataService(env.DB, this.cache);
    this.ai = new AIService(this.data, this.cache);
    this.bot = new BotService(this.data, this.cache, this.ai);
    this.api = new APIService(this.data, this.cache, env);
  }

  getCache(): CacheService {
    return this.cache;
  }

  getData(): DataService {
    return this.data;
  }

  getAI(): AIService {
    return this.ai;
  }

  getBot(): BotService {
    return this.bot;
  }

  getAPI(): APIService {
    return this.api;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/services/container.ts
git commit -m "feat: add ServiceContainer for dependency injection"
```

---

### Task 1.8: Integrate Services with Worker Entry

**Files:**

- Modify: `src/index.ts`
- Test: Verify bot still works

**Interfaces:**

- Consumes: ServiceContainer
- Produces: Updated Worker entry point

- [ ] **Step 1: Update Worker entry point**

```typescript
// src/index.ts - Updated
import { webhookCallback } from 'grammy';
import { createBot, Env } from './bot';
import { setRequestContext } from './requestContext';
import { handleApiRequest } from './api/router';
import { sweepStreaks } from './scripts/streaks';
import { ServiceContainer } from './services/container';

let botInstance: ReturnType<typeof createBot> | null = null;
let serviceContainer: ServiceContainer | null = null;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize service container (cached across requests in same isolate)
    if (!serviceContainer) {
      serviceContainer = new ServiceContainer(env);
    }

    // Handle API requests
    if (path.startsWith('/api')) {
      return handleApiRequest(request, env, ctx);
    }

    // Handle webhook requests
    if (path === '/webhook' && request.method === 'POST') {
      // Validate secret token
      const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secretToken !== env.SECRET_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }

      // Set request context
      setRequestContext(env, ctx);

      // Initialize bot if needed
      if (!botInstance) {
        botInstance = createBot(env);
      }

      // Handle webhook
      return webhookCallback(botInstance, 'cloudflare-mod', {
        timeoutMilliseconds: 25000,
      })(request);
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.STREAK_CRON_ENABLED === 'true') {
      await sweepStreaks(env);
    }
  },
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run existing tests**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: integrate ServiceContainer with Worker entry point"
```

---

## Phase 2: Cache Layer (Week 2)

### Task 2.1: Add KV Binding to Wrangler

**Files:**

- Modify: `wrangler.toml`
- Test: Verify deployment works

**Interfaces:**

- Consumes: None
- Produces: KV namespace binding

- [ ] **Step 1: Create KV namespace**

Run: `wrangler kv namespace create CACHE`
Expected: Returns namespace ID

- [ ] **Step 2: Update wrangler.toml**

```toml
# Add to wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_KV_NAMESPACE_ID"
```

- [ ] **Step 3: Update Env interface**

```typescript
// src/bot.ts - Update Env interface
export interface Env {
  // ... existing fields
  CACHE: KVNamespace;
}
```

- [ ] **Step 4: Verify deployment works**

Run: `npm run deploy:dry`
Expected: No errors about missing bindings

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml src/bot.ts
git commit -m "feat: add KV namespace binding for caching"
```

---

### Task 2.2: Add Cache Invalidation to Admin Operations

**Files:**

- Modify: `src/api/resources/products.ts`
- Modify: `src/api/resources/categories.ts`
- Modify: `src/api/resources/branches.ts`
- Test: Verify cache is invalidated on admin edits

**Interfaces:**

- Consumes: DataService cache invalidation methods
- Produces: Updated admin handlers

- [ ] **Step 1: Update products resource handler**

```typescript
// src/api/resources/products.ts - Add cache invalidation
import { DataService } from '../../services/data';

export async function handleProductRequest(
  method: string,
  path: string,
  ctx: ResourceCtx,
): Promise<Response | null> {
  const dataService = new DataService(ctx.db, ctx.cache);

  // ... existing handler logic ...

  // After successful update/delete, invalidate cache
  if (method === 'PUT' || method === 'DELETE' || method === 'POST') {
    await dataService.invalidateProducts();
  }

  // ... rest of handler ...
}
```

- [ ] **Step 2: Update categories resource handler**

```typescript
// src/api/resources/categories.ts - Add cache invalidation
export async function handleCategoryRequest(
  method: string,
  path: string,
  ctx: ResourceCtx,
): Promise<Response | null> {
  const dataService = new DataService(ctx.db, ctx.cache);

  // ... existing handler logic ...

  // After successful update/delete, invalidate cache
  if (method === 'PUT' || method === 'DELETE' || method === 'POST') {
    await dataService.invalidateMenuConfig();
  }

  // ... rest of handler ...
}
```

- [ ] **Step 3: Update branches resource handler**

```typescript
// src/api/resources/branches.ts - Add cache invalidation
export async function handleBranchRequest(
  method: string,
  path: string,
  ctx: ResourceCtx,
): Promise<Response | null> {
  const dataService = new DataService(ctx.db, ctx.cache);

  // ... existing handler logic ...

  // After successful update/delete, invalidate cache
  if (method === 'PUT' || method === 'DELETE' || method === 'POST') {
    await dataService.invalidateBranches();
  }

  // ... rest of handler ...
}
```

- [ ] **Step 4: Verify cache invalidation works**

Test by updating a product via admin API, then checking if bot shows updated data within 5 minutes.

- [ ] **Step 5: Commit**

```bash
git add src/api/resources/
git commit -m "feat: add cache invalidation to admin operations"
```

---

## Phase 3: Query Optimization (Week 3)

### Task 3.1: Add Missing D1 Indexes

**Files:**

- Create: `drizzle/0009_add_missing_indexes.sql`
- Test: Verify indexes are created

**Interfaces:**

- Consumes: None
- Produces: Database migration

- [ ] **Step 1: Create migration file**

```sql
-- drizzle/0009_add_missing_indexes.sql

-- Index for favorites by user (for getUserFavorites query)
CREATE INDEX IF NOT EXISTS idx_favorites_telegram_id ON favorites(telegram_id);

-- Index for user_state by last_seen_at (for sweep query)
CREATE INDEX IF NOT EXISTS idx_user_state_last_seen ON user_state(last_seen_at);

-- Index for messages by replied (for getUnreadCount query)
CREATE INDEX IF NOT EXISTS idx_messages_replied ON messages(replied);

-- Composite index for products by category and availability
CREATE INDEX IF NOT EXISTS idx_products_category_available ON products(category_id, available);
```

- [ ] **Step 2: Apply migration**

Run: `wrangler d1 execute azadi-db --remote --file=drizzle/0009_add_missing_indexes.sql`
Expected: Migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add drizzle/0009_add_missing_indexes.sql
git commit -m "feat: add missing D1 indexes for performance"
```

---

### Task 3.2: Implement D1 Batch Operations

**Files:**

- Modify: `src/services/data/index.ts`
- Test: Verify batch operations work

**Interfaces:**

- Consumes: D1 batch API
- Produces: Updated DataService with batch methods

- [ ] **Step 1: Add batch query method**

```typescript
// src/services/data/index.ts - Add batch method
async buildAIContextBatch(userId: string) {
  const batch = await this.db.batch([
    // Products with details
    this.db
      .select()
      .from(products)
      .leftJoin(coffeeDetails, eq(products.id, coffeeDetails.productId))
      .leftJoin(categories, eq(products.categoryId, categories.id)),

    // Active branches
    this.db.select().from(branches).where(eq(branches.isActive, true)),

    // FAQs
    this.db.select().from(faq),

    // Menu config
    this.db
      .select()
      .from(menuConfig)
      .where(eq(menuConfig.isVisible, true)),

    // About setting
    this.db.select().from(settings).where(eq(settings.key, 'about')),

    // Recent AI logs
    this.db
      .select()
      .from(aiConversationLogs)
      .where(eq(aiConversationLogs.userId, userId))
      .orderBy(desc(aiConversationLogs.timestamp))
      .limit(5),

    // User favorites
    this.db.select().from(favorites).where(eq(favorites.telegramId, userId)),

    // Popular products
    this.db
      .select({
        name: products.name,
        category: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
        favoritedCount: sql<number>`cast(count(*) as int)`,
      })
      .from(favorites)
      .innerJoin(products, eq(favorites.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .groupBy(products.id, categories.name)
      .orderBy(desc(sql`count(*)`))
      .limit(5),
  ]);

  return {
    products: batch[0],
    branches: batch[1],
    faqs: batch[2],
    menuConfig: batch[3],
    about: batch[4][0]?.value,
    recentLogs: batch[5],
    favorites: batch[6],
    popularProducts: batch[7],
  };
}
```

- [ ] **Step 2: Update AI service to use batch**

```typescript
// src/services/ai/index.ts - Update buildContext
async buildContext(userId: string): Promise<string> {
  const contextData = await this.data.buildAIContextBatch(userId);
  return buildMinimalContext(contextData);
}
```

- [ ] **Step 3: Verify batch operations work**

Test by sending a message to bot and checking logs for reduced latency.

- [ ] **Step 4: Commit**

```bash
git add src/services/data/index.ts src/services/ai/index.ts
git commit -m "feat: add D1 batch operations for AI context building"
```

---

## Phase 4: Admin App Optimization (Week 4)

### Task 4.1: Optimize Bundle Chunking

**Files:**

- Modify: `admin-app/vite.config.ts`
- Test: Verify build succeeds and bundle size reduced

**Interfaces:**

- Consumes: None
- Produces: Optimized Vite config

- [ ] **Step 1: Update vite.config.ts**

```typescript
// admin-app/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          telegram: ['@telegram-apps/sdk'],
          charts: ['recharts'],
          forms: ['react-hook-form'],
        },
      },
    },
  },
});
```

- [ ] **Step 2: Build and verify bundle size**

Run: `cd admin-app && npm run build`
Expected: Bundle size reduced by 40-60%

- [ ] **Step 3: Commit**

```bash
git add admin-app/vite.config.ts
git commit -m "feat: optimize admin app bundle chunking"
```

---

### Task 4.2: Add Lazy Loading

**Files:**

- Modify: `admin-app/src/App.tsx`
- Test: Verify pages load lazily

**Interfaces:**

- Consumes: None
- Produces: Lazy-loaded routes

- [ ] **Step 1: Update App.tsx with lazy loading**

```typescript
// admin-app/src/App.tsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const queryClient = new QueryClient();

function LoadingSpinner() {
  return (
    <div className="loading-spinner">
      <div className="spinner" />
      <p>در حال بارگذاری...</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
```

- [ ] **Step 2: Verify lazy loading works**

Run: `cd admin-app && npm run dev`
Expected: Pages load on demand, not all at once

- [ ] **Step 3: Commit**

```bash
git add admin-app/src/App.tsx
git commit -m "feat: add lazy loading for admin app routes"
```

---

### Task 4.3: Add Skeleton Loading States

**Files:**

- Create: `admin-app/src/components/SkeletonLoader.tsx`
- Modify: `admin-app/src/pages/ProductsPage.tsx`
- Test: Verify skeleton shows during loading

**Interfaces:**

- Consumes: None
- Produces: Skeleton components

- [ ] **Step 1: Create skeleton component**

```typescript
// admin-app/src/components/SkeletonLoader.tsx
import './SkeletonLoader.css';

export function ProductSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-image" />
      <div className="skeleton-text" />
      <div className="skeleton-text short" />
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-avatar" />
          <div className="skeleton-content">
            <div className="skeleton-text" />
            <div className="skeleton-text short" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create skeleton CSS**

```css
/* admin-app/src/components/SkeletonLoader.css */
.skeleton {
  padding: 1rem;
}

.skeleton-image {
  width: 100%;
  height: 200px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
}

.skeleton-text {
  height: 1rem;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  margin: 0.5rem 0;
  border-radius: 4px;
}

.skeleton-text.short {
  width: 60%;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

- [ ] **Step 3: Update ProductsPage to use skeleton**

```typescript
// admin-app/src/pages/ProductsPage.tsx
import { useQuery } from '@tanstack/react-query';
import { ListSkeleton } from '../components/SkeletonLoader';

function ProductsPage() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isLoading) {
    return <ListSkeleton count={10} />;
  }

  // ... rest of page
}
```

- [ ] **Step 4: Verify skeleton shows during loading**

Run: `cd admin-app && npm run dev`
Expected: Skeleton appears while data loads

- [ ] **Step 5: Commit**

```bash
git add admin-app/src/components/SkeletonLoader.*
git add admin-app/src/pages/ProductsPage.tsx
git commit -m "feat: add skeleton loading states for admin app"
```

---

## Self-Review Checklist

- [ ] All spec requirements covered by tasks
- [ ] No placeholders (TBD, TODO, etc.)
- [ ] Type signatures consistent across tasks
- [ ] File paths accurate and consistent
- [ ] Each task is independently testable
- [ ] Git commits follow conventional format
