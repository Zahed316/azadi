# Architecture Migration Design: Azadi Coffee Bot

**Date**: 2026-08-10  
**Author**: Claude (AI Assistant)  
**Status**: Draft  
**Review**: Pending user approval

## Executive Summary

This document outlines a comprehensive architecture redesign for the Azadi Coffee Bot backend, transitioning from a monolithic structure to a modular monolith with service boundaries. The redesign focuses on three key improvements:

1. **Performance**: 50-70% reduction in admin app load time, 10-20x faster menu navigation
2. **Maintainability**: Clear service boundaries, dependency injection, testable components
3. **Scalability**: KV caching layer, batch operations, prepared for future growth

**Constraints**:

- Free tier only (no R2, no Durable Objects)
- Gradual implementation over 4 weeks
- Backward compatible with existing bot behavior

## Current Architecture Analysis

### Pain Points Identified

1. **No Caching Layer**: Every request hits D1 directly (50-200ms per query)
2. **Monolithic Repository**: 749-line file with10 repository classes
3. **Module-Level State**: Fragile `requestContext.ts` pattern with race condition risks
4. **Full-Table Scans**: Menu data fetched entirely then paginated in JavaScript
5. **Sequential Queries**: Some callbacks make3+ sequential D1 queries (e.g., product detail handler: getProductById, getValue('price_unit'), isFavorited)
6. **Admin App Slowness**: Initial load takes3-5 seconds due to bundle size

### Performance Bottlenecks

| Operation           | Current Latency  | Target Latency | Improvement     |
| ------------------- | ---------------- | -------------- | --------------- |
| Menu navigation     | 50-200ms         | 5-10ms         | 10-20x          |
| AI context building | 200-500ms        | 50-100ms       | 3-5x            |
| Admin app load      | 3-5s             | 1-2s           | 50-70%          |
| D1 read quota       | 8 queries/AI msg | 1 KV read      | 87.5% reduction |

## Proposed Architecture

### Service Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Bot Service  │  │ API Service │  │ AI Service  │         │
│  │ (webhook)    │  │ (admin)     │  │ (fallback)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                  │
│        └────────────────┼────────────────┘                  │
│                          │                                   │
│                  ┌───────▼───────┐                          │
│                  │  Cache Layer  │                          │
│                  │  (KV + Memo)  │                          │
│                  └───────┬───────┘                          │
│                          │                                   │
│                  ┌───────▼───────┐                          │
│                  │  Data Layer   │                          │
│                  │  (D1 + Repos) │                          │
│                  └───────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Service Communication Pattern

Services communicate via method calls (not HTTP), maintaining single Worker deployment:

```typescript
// src/services/container.ts
export class ServiceContainer {
  private cache: CacheService;
  private data: DataService;
  private bot: BotService;
  private api: APIService;
  private ai: AIService;

  constructor(env: Env) {
    this.cache = new CacheService(env.CACHE);
    this.data = new DataService(env.DB, this.cache);
    this.ai = new AIService(this.data, this.cache);
    this.bot = new BotService(this.data, this.cache, this.ai);
    this.api = new APIService(this.data, this.cache);
  }

  getBot() {
    return this.bot;
  }
  getAPI() {
    return this.api;
  }
}
```

**Key Principle**: Dependencies flow inward (Bot/API → AI → Data → Cache → D1/KV). No circular dependencies.

### Service Responsibilities

#### 1. Bot Service (`src/services/bot/`)

- **Responsibility**: Telegram webhook handling, middleware chain, menu navigation
- **Input**: Telegram updates (messages, callbacks)
- **Output**: Bot responses (text, photos, inline keyboards)
- **Dependencies**: Cache Service, Data Service, AI Service
- **Key Methods**:
  - `handleMessage(ctx: MyContext)`: Process text messages
  - `handleCallback(ctx: MyContext)`: Process inline keyboard presses
  - `handleCommand(ctx: MyContext)`: Process bot commands (/start, /admin)

#### 2. API Service (`src/services/api/`)

- **Responsibility**: Admin REST endpoints, authentication, CRUD operations
- **Input**: HTTP requests with Telegram initData auth
- **Output**: JSON responses
- **Dependencies**: Cache Service, Data Service
- **Key Methods**:
  - `handleRequest(request: Request, env: Env)`: Route and handle API requests
  - `authenticateUser(request: Request)`: Validate Telegram initData
  - `authorizeAdmin(user: TelegramUser)`: Check admin permissions

#### 3. AI Service (`src/services/ai/`)

- **Responsibility**: OpenCode integration, context building, response handling
- **Input**: User messages + menu context
- **Output**: AI-generated responses
- **Dependencies**: Data Service (for context), Cache Service (for menu data)
- **Key Methods**:
  - `processQuery(message: string, userId: string)`: Handle AI fallback
  - `buildContext(userId: string)`: Build menu context for AI
  - `sanitizeResponse(response: string)`: Clean AI output

#### 4. Cache Service (`src/services/cache/`)

- **Responsibility**: KV operations, cache invalidation, stale-while-revalidate
- **Input**: Cache keys, data to cache
- **Output**: Cached data or null
- **Dependencies**: KV namespace
- **Key Methods**:
  - `get<T>(key: string)`: Fetch from cache or D1
  - `set(key: string, value: any, ttl: number)`: Store in cache
  - `invalidate(key: string)`: Remove from cache
  - `invalidatePattern(pattern: string)`: Remove matching keys

#### 5. Data Service (`src/services/data/`)

- **Responsibility**: Repository pattern, D1 queries, batch operations
- **Input**: Query parameters
- **Output**: Database results
- **Dependencies**: D1 database
- **Key Methods**:
  - `getProducts()`: Fetch products with caching
  - `getBranches()`: Fetch branches with caching
  - `batchQueries(queries[])`: Execute multiple queries in one round-trip

### Cache Strategy

#### What to Cache (read-heavy, rarely changes):

- Product catalog with details
- Branch locations
- FAQ entries
- Menu configuration
- Settings (price_unit, about text)

#### Cache Keys:

```
cache:products:all          → All products with details
cache:branches:active       → Active branches
cache:faq:all               → All FAQs
cache:menu:config           → Menu section configuration
cache:settings:{key}        → Individual settings
```

#### TTL Strategy:

- **Default TTL**: 5 minutes (300 seconds)
- **Stale-while-revalidate**: 10 minutes (600 seconds)
- **Admin invalidation**: Immediate purge on edits

#### Cache-Aside Pattern:

```typescript
// Implementation in CacheService
async get<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await this.kv.get(key, 'json');
  if (cached) return cached as T;

  const fresh = await fetcher();
  await this.kv.put(key, JSON.stringify(fresh), { expirationTtl: 300 });
  return fresh;
}
```

### Data Layer Improvements

#### Request Context Pattern:

Replace module-level globals with proper middleware:

```typescript
export interface RequestContext {
  env: Env;
  ctx: ExecutionContext;
  db: DrizzleD1Database;
  cache: CacheService;
}
```

#### Base Repository Class:

```typescript
export abstract class BaseRepository<T> {
  constructor(protected db: DrizzleD1Database) {}

  abstract getTableName(): string;

  async findAll(): Promise<T[]> {
    return this.db.select().from(this.getTable());
  }

  async findById(id: number): Promise<T | undefined> {
    return this.db.select().from(this.getTable()).where(eq(this.getTable().id, id));
  }

  async create(data: Insertable<T>): Promise<T> {
    return this.db.insert(this.getTable()).values(data).returning();
  }

  async update(id: number, data: Partial<Insertable<T>>): Promise<T> {
    return this.db.update(this.getTable()).set(data).where(eq(this.getTable().id, id)).returning();
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(this.getTable()).where(eq(this.getTable().id, id));
  }
}
```

#### D1 Batch Operations:

For AI context building (8 parallel D1 queries → 1 batch):

```typescript
async buildAIContext(userId: string) {
  const batch = await this.db.batch([
    this.db.select().from(products).leftJoin(coffeeDetails, eq(products.id, coffeeDetails.productId)),
    this.db.select().from(branches).where(eq(branches.isActive, true)),
    this.db.select().from(faq),
    this.db.select().from(menuConfig).where(eq(menuConfig.isVisible, true)),
    this.db.select().from(settings).where(eq(settings.key, 'about')),
    this.db.select().from(aiConversationLogs).where(eq(aiConversationLogs.userId, userId)).orderBy(desc(aiConversationLogs.timestamp)).limit(5),
    this.db.select().from(favorites).where(eq(favorites.telegramId, userId)),
    this.db.select({ name: products.name, category: categories.name, favoritedCount: sql<number>`count(*)` })
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

### Admin App Optimization

#### Bundle Optimization:

```typescript
// Improved chunking strategy
manualChunks: {
  vendor: ['react', 'react-dom', 'react-router-dom'],
  query: ['@tanstack/react-query'],
  telegram: ['@telegram-apps/sdk'],
  charts: ['recharts'], // Only load on analytics page
  forms: ['react-hook-form'], // Only load on edit pages
}
```

#### Lazy Loading:

```typescript
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
```

#### Skeleton Loading States:

```typescript
export function ProductSkeleton() {
  return (
    <div className="skeleton">
      <div className="skeleton-image" />
      <div className="skeleton-text" />
      <div className="skeleton-text short" />
    </div>
  );
}
```

#### Prefetching Critical Data:

```typescript
useEffect(() => {
  queryClient.prefetchQuery({
    queryKey: ['products'],
    queryFn: () => fetchProducts(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}, []);
```

## Implementation Phases

### Phase1: Service Boundaries (Week1)

**Goal**: Create service interfaces and refactor existing handlers

**Tasks**:

1. Create service interfaces (`src/services/types.ts`)
2. Implement base repository class (`src/repositories/base.ts`)
3. Refactor `src/handlers/message.ts` → Bot Service
4. Refactor `src/api/router.ts` → API Service
5. Refactor `src/services/aiService.ts` → AI Service
6. Add dependency injection container (`src/services/container.ts`)

**Deliverables**:

- Service interfaces defined
- Base repository implemented
- Existing handlers refactored into services
- Unit tests for service boundaries

### Phase2: Cache Layer (Week2)

**Goal**: Add KV caching for menu data

**Tasks**:

1. Add KV binding to `wrangler.toml`
2. Implement Cache Service (`src/services/cache/index.ts`)
3. Add cache-aside pattern to Data Service
4. Implement cache invalidation on admin edits
5. Add cache headers to API responses

**Deliverables**:

- KV namespace created and bound
- Cache Service implemented with TTL
- Cache invalidation working
- Performance metrics showing improvement

### Phase3: Query Optimization (Week3)

**Goal**: Optimize D1 queries and add batch operations

**Tasks**:

1. Add missing D1 indexes (favorites by user, streak sweep columns)
2. Implement D1 batch operations in Data Service
3. Add request-level memoization
4. Optimize callback query handlers (parallel queries)
5. Add cursor-based pagination for large datasets

**Deliverables**:

- D1 indexes added via migration
- Batch operations reducing query count
- Callback handlers optimized
- Pagination implemented for API endpoints

### Phase4: Admin App Optimization (Week4)

**Goal**: Reduce initial load time by 50-70%

**Tasks**:

1. Optimize bundle chunking in `vite.config.ts`
2. Implement lazy loading for routes
3. Add skeleton loading states
4. Implement data prefetching
5. Add API response compression

**Deliverables**:

- Bundle size reduced by 40-60%
- Lazy loading implemented
- Skeleton states for better UX
- Prefetching reducing perceived load time

## Technical Specifications

### KV Configuration

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

### Environment Variables

```typescript
export interface Env {
  // Existing
  TELEGRAM_BOT_TOKEN: string;
  SECRET_TOKEN: string;
  DB: D1Database;
  OPENCODE_API_KEY: string;

  // New
  CACHE: KVNamespace; // KV binding
  CACHE_TTL?: string; // Optional override (default: 300)
}
```

### TypeScript Interfaces

```typescript
// src/services/types.ts
export interface IBotService {
  handleMessage(ctx: MyContext): Promise<void>;
  handleCallback(ctx: MyContext): Promise<void>;
  handleCommand(ctx: MyContext): Promise<void>;
}

export interface IAPIService {
  handleRequest(request: Request, env: Env): Promise<Response>;
  authenticateUser(request: Request): Promise<TelegramUser>;
  authorizeAdmin(user: TelegramUser): Promise<AdminRole>;
}

export interface IAIService {
  processQuery(message: string, userId: string): Promise<string>;
  buildContext(userId: string): Promise<AIContext>;
  sanitizeResponse(response: string): string;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}

export interface IDataService {
  getProducts(): Promise<Product[]>;
  getBranches(): Promise<Branch[]>;
  batchQueries<T>(queries: Promise<T>[]): Promise<T[]>;
}
```

## Performance Metrics

### Expected Improvements

| Metric                  | Current          | Target            | Improvement     |
| ----------------------- | ---------------- | ----------------- | --------------- |
| Menu navigation latency | 50-200ms         | 5-10ms            | 10-20x          |
| AI context building     | 200-500ms        | 50-100ms          | 3-5x            |
| Admin app load time     | 3-5s             | 1-2s              | 50-70%          |
| D1 read quota usage     | 8 queries/AI msg | 1 KV read         | 87.5% reduction |
| Code maintainability    | 749-line file    | ~10 focused files | 90% reduction   |

### Monitoring Setup

1. **Performance Logs**: Extend existing `PERF_LOG` to track cache hits/misses
2. **Cache Metrics**: Track KV read/write counts, hit rates
3. **D1 Metrics**: Monitor query latency, batch operation performance
4. **Admin App Metrics**: Track bundle size, load times, cache effectiveness

## Risk Assessment

### Technical Risks

1. **Cache Inconsistency**: Admin edits may take up to5 minutes to reflect (default TTL)
   - **Mitigation**: Immediate cache invalidation on admin edits
   - **Fallback**: Force cache refresh endpoint for admins

2. **KV Free Tier Limits**: 100k reads/day may be exceeded
   - **Mitigation**: Monitor usage, implement request deduplication
   - **Fallback**: Reduce TTL, implement more aggressive invalidation

3. **Batch Operation Complexity**: D1 batch API has limitations
   - **Mitigation**: Start with simple batches, expand gradually
   - **Fallback**: Keep parallel queries for complex operations

### Implementation Risks

1. **Refactoring Scope**: Large changes may introduce bugs
   - **Mitigation**: Incremental implementation, comprehensive testing
   - **Fallback**: Feature flags for new vs old code paths

2. **Performance Regression**: New abstraction layers may add overhead
   - **Mitigation**: Benchmark before/after each phase
   - **Fallback**: Optimize hot paths, remove unnecessary abstractions

## Success Criteria

### Phase1 Success

- [ ] All services have defined interfaces
- [ ] Base repository class implemented
- [ ] Existing handlers refactored without breaking functionality
- [ ] Unit tests passing for service boundaries

### Phase2 Success

- [ ] KV namespace created and bound
- [ ] Cache Service working with 5-min TTL
- [ ] Cache invalidation working on admin edits
- [ ] Menu navigation latency reduced by 10x

### Phase3 Success

- [ ] D1 indexes added for common queries
- [ ] Batch operations reducing query count by 50%
- [ ] Request-level memoization working
- [ ] Callback handlers optimized

### Phase4 Success

- [ ] Admin app bundle size reduced by 40-60%
- [ ] Lazy loading implemented for all routes
- [ ] Skeleton states for better perceived performance
- [ ] Initial load time under 2 seconds

## Conclusion

This architecture redesign transforms the Azadi Coffee Bot from a monolithic structure to a maintainable, performant modular monolith. By adding a KV caching layer, implementing service boundaries, and optimizing the admin app, we achieve:

1. **10-20x faster menu navigation** through KV caching
2. **50-70% faster admin app load** through bundle optimization
3. **Better maintainability** through clear service boundaries
4. **Scalability foundation** for future growth

The gradual4-week implementation plan minimizes risk while delivering incremental improvements. Free tier constraints are respected throughout, with clear upgrade paths if traffic grows.

**Next Steps**: Upon approval, proceed to detailed implementation planning with the writing-plans skill.
