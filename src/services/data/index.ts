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
  UserStateRepository,
  FavoritesRepository,
  MessageRepository,
} from '../../repositories';
import type { ICacheService, IDataService, MenuSectionEntry } from '../types';
import { CACHE_KEYS, DEFAULT_TTL } from '../cache/keys';

export class DataService implements IDataService {
  private products: ProductRepository;
  private categories: CategoryRepository;
  private branches: BranchRepository;
  private faq: FaqRepository;
  private settings: SettingsRepository;
  private aiLogs: AiLogRepository;
  private menuConfig: MenuConfigRepository;
  private userState: UserStateRepository;
  private favorites: FavoritesRepository;
  private messages: MessageRepository;

  constructor(d1Binding: any, private cache?: ICacheService) {
    this.products = new ProductRepository(d1Binding);
    this.categories = new CategoryRepository(d1Binding);
    this.branches = new BranchRepository(d1Binding);
    this.faq = new FaqRepository(d1Binding);
    this.settings = new SettingsRepository(d1Binding);
    this.aiLogs = new AiLogRepository(d1Binding);
    this.menuConfig = new MenuConfigRepository(d1Binding);
    this.userState = new UserStateRepository(d1Binding);
    this.favorites = new FavoritesRepository(d1Binding);
    this.messages = new MessageRepository(d1Binding);
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

  async getPopularProducts(limit: number = 5) {
    return this.cached(CACHE_KEYS.products.popular, () =>
      this.products.getPopularProducts(limit),
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
    return this.cached(CACHE_KEYS.branches.active, () =>
      this.branches.getActiveBranches(),
    );
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
      this.menuConfig.getVisibleCategoryIds(),
    );
  }

  async getBySection(section: string): Promise<MenuSectionEntry[]> {
    return this.cached(CACHE_KEYS.menu.bySection(section), () =>
      this.menuConfig.getBySection(section),
    );
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async getSetting(key: string): Promise<string | null> {
    // Individual setting lookups are cheap; skip per-key caching to avoid
    // stale reads when the admin edits a setting. The menu-config and
    // visible-categories caches cover the hot paths.
    return this.settings.getValue(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.settings.setValue(key, value);
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
  // Favorites
  // ---------------------------------------------------------------------------

  /**
   * Return the user's favorited product *names* (as strings) for the AI
   * context personalization section.
   */
  async getUserFavorites(telegramId: string): Promise<string[]> {
    const list = await this.favorites.list(telegramId);
    return list.map((f) => f.name);
  }

  async toggleFavorite(telegramId: string, productId: number): Promise<boolean> {
    const isFav = await this.favorites.isFavorited(telegramId, productId);
    if (isFav) {
      await this.favorites.remove(telegramId, productId);
    } else {
      await this.favorites.add(telegramId, productId);
    }
    // Bust the user's favorites cache
    if (this.cache) {
      await this.cache.delete(CACHE_KEYS.favorites.byUser(telegramId));
    }
    return !isFav; // returns new state: true = now favorited
  }

  async isFavorited(telegramId: string, productId: number): Promise<boolean> {
    return this.favorites.isFavorited(telegramId, productId);
  }

  async list(telegramId: string) {
    return this.favorites.list(telegramId);
  }

  // ---------------------------------------------------------------------------
  // User State
  // ---------------------------------------------------------------------------

  async getUserState(telegramId: string) {
    return this.userState.getByTelegramId(telegramId);
  }

  async upsertVisit(telegramId: string) {
    const result = await this.userState.upsertVisit(telegramId);
    return {
      streakDays: result.streakDays,
      isNewStreak: result.isNewStreak,
    };
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

  async invalidateFavorites(telegramId: string): Promise<void> {
    if (this.cache) {
      await this.cache.delete(CACHE_KEYS.favorites.byUser(telegramId));
    }
  }
}
