/**
 * Data service for the Azadi Coffee Bot modular monolith.
 *
 * Implements {@link IDataService} by delegating to the existing repository
 * classes and optionally wrapping read operations with KV caching.
 *
 * @module services/data
 */

import {
  ProductRepository,
  CategoryRepository,
  BranchRepository,
  FaqRepository,
  SettingsRepository,
  AiLogRepository,
  MenuConfigRepository,
  MessageRepository,
} from '../../repositories';
import type { D1Database } from '@cloudflare/workers-types';
import { getDb } from '../../database/client';
import { eq, desc } from 'drizzle-orm';
import {
  products,
  coffeeDetails,
  categories,
  branches,
  faq,
  menuConfig,
  settings,
  aiConversationLogs,
} from '../../database/schema';
import type { ICacheService, IDataService, MenuSectionEntry } from '../types';
import { CACHE_KEYS, DEFAULT_TTL } from '../cache/keys';

export class DataService implements IDataService {
  private _products?: ProductRepository;
  private _categories?: CategoryRepository;
  private _branchesRepo?: BranchRepository;
  private _faq?: FaqRepository;
  private _settingsRepo?: SettingsRepository;
  private _aiLogs?: AiLogRepository;
  private _menuConfigRepo?: MenuConfigRepository;
  private _messages?: MessageRepository;
  private db: ReturnType<typeof getDb>;

  constructor(
    private d1Binding: D1Database,
    private cache?: ICacheService,
  ) {
    this.db = getDb(d1Binding);
  }

  // ---------------------------------------------------------------------------
  // Lazy repository getters (??= avoids re-creating on every access)
  // ---------------------------------------------------------------------------

  private get products(): ProductRepository {
    this._products ??= new ProductRepository(this.d1Binding);
    return this._products;
  }

  private get categories(): CategoryRepository {
    this._categories ??= new CategoryRepository(this.d1Binding);
    return this._categories;
  }

  private get branchesRepo(): BranchRepository {
    this._branchesRepo ??= new BranchRepository(this.d1Binding);
    return this._branchesRepo;
  }

  private get faq(): FaqRepository {
    this._faq ??= new FaqRepository(this.d1Binding);
    return this._faq;
  }

  private get settingsRepo(): SettingsRepository {
    this._settingsRepo ??= new SettingsRepository(this.d1Binding);
    return this._settingsRepo;
  }

  private get aiLogs(): AiLogRepository {
    this._aiLogs ??= new AiLogRepository(this.d1Binding);
    return this._aiLogs;
  }

  private get menuConfigRepo(): MenuConfigRepository {
    this._menuConfigRepo ??= new MenuConfigRepository(this.d1Binding);
    return this._menuConfigRepo;
  }

  private get messages(): MessageRepository {
    this._messages ??= new MessageRepository(this.d1Binding);
    return this._messages;
  }

  // ---------------------------------------------------------------------------
  // Private cache helpers
  // ---------------------------------------------------------------------------

  /**
   * Read-through cache: return the cached value if present, otherwise fetch
   * from the repository, store the result, and return it.
   */
  private async cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (!this.cache) return fetcher();

    const cached = await this.cache.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetcher();
    await this.cache.set(key, value, DEFAULT_TTL);
    return value;
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async getAllProducts() {
    return this.cached(CACHE_KEYS.products.all, () => this.products.getAllProducts());
  }

  async getAllProductsWithDetails() {
    return this.cached(CACHE_KEYS.products.withDetails, () =>
      this.products.getAllProductsWithDetails(),
    );
  }

  async getProductById(id: number) {
    // Single-product lookups are usually not worth caching (unique key, low
    // reuse across requests). Delegate directly.
    return this.products.getProductById(id);
  }

  async getProductsByCategory(categoryId: number) {
    return this.cached(CACHE_KEYS.products.byCategory(categoryId), () =>
      this.products.getProductsByCategory(categoryId),
    );
  }

  async getByFlag(flag: 'featured' | 'isSeasonal') {
    // Flag queries are low-volume and highly specific — skip caching.
    return this.products.getByFlag(flag);
  }

  async getBeansWithCoffeeDetails() {
    // The coffee-passport surface is read-heavy but small; cache with a
    // dedicated key so it can be invalidated independently.
    return this.cached('cache:products:beans-details', () =>
      this.products.getBeansWithCoffeeDetails(),
    );
  }

  // ---------------------------------------------------------------------------
  // Coffee Details
  // ---------------------------------------------------------------------------

  async getCoffeeDetails(productId: number) {
    return this.products.getCoffeeDetails(productId);
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async getAllCategories() {
    return this.cached(CACHE_KEYS.settings.key('categories'), () =>
      this.categories.getAllCategories(),
    );
  }

  // ---------------------------------------------------------------------------
  // Branches
  // ---------------------------------------------------------------------------

  async getActiveBranches() {
    return this.cached(CACHE_KEYS.branches.active, () => this.branchesRepo.getActiveBranches());
  }

  async getBranchById(id: number) {
    return this.branchesRepo.getBranchById(id);
  }

  async getAllBranches() {
    return this.branchesRepo.getAllBranches();
  }

  // ---------------------------------------------------------------------------
  // FAQs
  // ---------------------------------------------------------------------------

  async getAllFaqs() {
    return this.cached(CACHE_KEYS.faq.all, () => this.faq.getAll());
  }

  // ---------------------------------------------------------------------------
  // Menu Config
  // ---------------------------------------------------------------------------

  async getVisibleCategoryIds() {
    return this.cached(CACHE_KEYS.visibleCategories, () =>
      this.menuConfigRepo.getVisibleCategoryIds(),
    );
  }

  async getBySection(section: string): Promise<MenuSectionEntry[]> {
    return this.cached(CACHE_KEYS.menu.bySection(section), () =>
      this.menuConfigRepo.getBySection(section),
    );
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async getSetting(key: string): Promise<string | null> {
    // Individual setting lookups are cheap; skip per-key caching to avoid
    // stale reads when the admin edits a setting. The menu-config and
    // visible-categories caches cover the hot paths.
    return this.settingsRepo.getValue(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.settingsRepo.setValue(key, value);
    // Invalidate the settings namespace so any bulk-cached reads pick up
    // the new value on next access.
    if (this.cache) {
      await this.cache.deleteByPrefix('cache:settings:');
    }
  }

  // ---------------------------------------------------------------------------
  // AI Logs
  // ---------------------------------------------------------------------------

  async getRecentLogs(userId: string, limit: number = 5) {
    // AI logs are per-user and time-sensitive — never cache.
    const logs = await this.aiLogs.getRecentLogs(userId, limit);
    return logs.map((l) => ({
      question: l.question,
      response: l.response,
      timestamp: l.timestamp,
    }));
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  async createMessage(data: {
    telegramId: string;
    content: string;
    senderName?: string;
    rating?: number;
    isAnonymous?: boolean;
  }) {
    return this.messages.create(data);
  }

  // ---------------------------------------------------------------------------
  // Batch operations (D1 batch API — single round-trip)
  // ---------------------------------------------------------------------------

  /**
   * Fetch all data needed for AI context building in a single D1 batch
   * round-trip instead of 7 parallel queries. Returns raw batch results
   * that need light transformation before passing to `buildMinimalContext`.
   */
  async buildAIContextBatch(userId: string) {
    const batch = await this.db.batch([
      // [0] Products with details (joined)
      this.db
        .select()
        .from(products)
        .leftJoin(coffeeDetails, eq(products.id, coffeeDetails.productId))
        .leftJoin(categories, eq(products.categoryId, categories.id)),

      // [1] Active branches
      this.db.select().from(branches).where(eq(branches.isActive, true)),

      // [2] FAQs
      this.db.select().from(faq),

      // [3] Visible menu config
      this.db.select().from(menuConfig).where(eq(menuConfig.isVisible, true)),

      // [4] About setting
      this.db.select().from(settings).where(eq(settings.key, 'about')),

      // [5] Recent AI logs for this user
      this.db
        .select()
        .from(aiConversationLogs)
        .where(eq(aiConversationLogs.userId, userId))
        .orderBy(desc(aiConversationLogs.timestamp))
        .limit(5),
    ]);

    return {
      products: batch[0],
      branches: batch[1],
      faqs: batch[2],
      menuConfig: batch[3],
      about: (batch[4] as Array<{ value?: string }>)[0]?.value,
      recentLogs: batch[5],
    };
  }

  // ---------------------------------------------------------------------------
  // Cache invalidation (called by admin write operations)
  // ---------------------------------------------------------------------------

  async invalidateProducts(): Promise<void> {
    if (this.cache) {
      await this.cache.deleteByPrefix('cache:products:');
    }
  }

  async invalidateBranches(): Promise<void> {
    if (this.cache) {
      await this.cache.deleteByPrefix('cache:branches:');
    }
  }

  async invalidateFaqs(): Promise<void> {
    if (this.cache) {
      await this.cache.delete(CACHE_KEYS.faq.all);
    }
  }

  async invalidateMenuConfig(): Promise<void> {
    if (this.cache) {
      await this.cache.deleteByPrefix('cache:menu:');
      await this.cache.delete(CACHE_KEYS.visibleCategories);
    }
  }

  async invalidateSettings(): Promise<void> {
    if (this.cache) {
      await this.cache.deleteByPrefix('cache:settings:');
    }
  }
}
