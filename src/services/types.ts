/**
 * Service interfaces for the Azadi Coffee Bot modular monolith architecture.
 *
 * These interfaces define the contracts between service boundaries.
 * They have NO runtime dependencies — purely TypeScript type definitions.
 *
 * @module services/types
 */

import {
  products,
  coffeeDetails,
  categories,
  branches,
  faq,
  userState,
  messages,
} from '../database/schema';
export type { Env } from '../bot';

// Re-export schema types for convenience — consumers can import from here
// instead of reaching into the database layer directly.
export * from '../database/schema';

// ---------------------------------------------------------------------------
// AI Context
// ---------------------------------------------------------------------------

/**
 * Enriched context passed to the AI service for query processing.
 * Assembled from multiple data sources in the message handler.
 */
export interface AIContext {
  /** The user's query text */
  query: string;
  /** Telegram user ID (string) */
  userId: string;
  /** Products with coffee details and category info (joined data) */
  productsWithDetails: Array<{
    products: typeof products.$inferSelect;
    coffee_details: typeof coffeeDetails.$inferSelect | null;
    categories: typeof categories.$inferSelect | null;
  }>;
  /** Active branches */
  branches: (typeof branches.$inferSelect)[];
  /** FAQ entries */
  faqs: (typeof faq.$inferSelect)[];
  /** Set of category IDs visible in bot menus */
  visibleCategoryIds: Set<number>;
  /** Shop identity and settings */
  settings?: Record<string, string>;
  /** User's recent AI conversation logs (for context window) */
  recentLogs: Array<{
    question: string;
    response: string;
    timestamp: Date;
  }>;
  /** User's favorited product names (for personalization) */
  userFavorites: string[];
  /** Most-favorited products across all users */
  popularProducts?: Array<{
    name: string;
    category: string;
    favoritedCount: number;
  }>;
}

/**
 * Raw result from the D1 batch query in `buildAIContextBatch`.
 * Contains pre-joined data that needs light transformation before passing
 * to `buildMinimalContext` to produce an `AIContext`.
 */
export interface AIContextBatchResult {
  products: Array<{
    products: typeof products.$inferSelect;
    coffee_details: typeof coffeeDetails.$inferSelect | null;
    categories: typeof categories.$inferSelect | null;
  }>;
  branches: (typeof branches.$inferSelect)[];
  faqs: (typeof faq.$inferSelect)[];
  menuConfig: Array<{
    id: number;
    categoryId: number;
    menuSection: string;
    displayOrder: number;
    isVisible: boolean;
    buttonLabel: string | null;
    specialMessage: string | null;
  }>;
  about: string | undefined;
  recentLogs: Array<{
    question: string;
    response: string;
    timestamp: Date;
  }>;
  favorites: Array<{ name: string }>;
  popularProducts: Array<{
    name: string;
    category: string;
    favoritedCount: number;
  }>;
}

// ---------------------------------------------------------------------------
// Bot Service
// ---------------------------------------------------------------------------

/**
 * Interface for the Telegram bot service.
 * Handles webhook processing and bot lifecycle.
 */
export interface IBotService {
  /**
   * Process a Telegram update via webhook.
   * @param request - The incoming webhook request
   * @returns Response for Telegram
   */
  handleWebhook(request: Request): Promise<Response>;

  /**
   * Get the underlying grammY Bot instance.
   * Used for testing and advanced configuration.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bot<MyContext> avoids grammY import in interface
  getBot(): any;
}

// ---------------------------------------------------------------------------
// API Service
// ---------------------------------------------------------------------------

/**
 * Interface for the admin REST API service.
 * Handles authenticated admin operations.
 */
export interface IAPIService {
  /**
   * Handle an incoming API request.
   * Includes auth validation, CORS, and routing to resource handlers.
   * @param request - The incoming HTTP request
   * @returns Response for the client
   */
  handleRequest(request: Request): Promise<Response>;
}

// ---------------------------------------------------------------------------
// AI Service
// ---------------------------------------------------------------------------

/**
 * Interface for the AI fallback service.
 * Processes user queries via the OpenCode API with menu context.
 */
export interface IAIService {
  /**
   * Process a user query and return an AI-generated response.
   * @param query - User's message text
   * @param userId - Telegram user ID
   * @param recentLogs - Recent conversation history for context
   * @param userFavorites - User's favorited product names
   * @returns AI response text (Persian, HTML-formatted)
   */
  processQuery(
    query: string,
    userId: string,
    recentLogs: Array<{ question: string; response: string; timestamp: Date }>,
    userFavorites?: string[],
  ): Promise<string>;

  /**
   * Build the menu context string for the AI system prompt.
   * @param context - Enriched AI context
   * @returns Formatted context string
   */
  buildMenuContext(context: AIContext): string;
}

// ---------------------------------------------------------------------------
// Cache Service
// ---------------------------------------------------------------------------

/**
 * Interface for the KV caching service.
 * Provides read/write/invalidation for cached data.
 */
export interface ICacheService {
  /**
   * Get a cached value by key.
   * @param key - Cache key
   * @returns Cached value or null if missing/expired
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set a cached value with optional TTL.
   * @param key - Cache key
   * @param value - Value to cache (will be JSON-serialized)
   * @param ttlSeconds - Time-to-live in seconds (default: 300)
   */
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a cached value by key.
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Delete all keys matching a prefix.
   * Used for bulk invalidation (e.g., invalidate all "products:*" keys).
   * @param prefix - Key prefix to match
   */
  deleteByPrefix(prefix: string): Promise<void>;

  /**
   * Check if a key exists in the cache.
   * @param key - Cache key
   */
  has(key: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Menu Config (section query result)
// ---------------------------------------------------------------------------

/**
 * Shape returned by `IDataService.getBySection()` — a menu-config row
 * joined with the category name and emoji.
 */
export interface MenuSectionEntry {
  id: number;
  categoryId: number;
  menuSection: string;
  displayOrder: number;
  isVisible: boolean;
  buttonLabel: string | null;
  specialMessage: string | null;
  categoryName: string | null;
  categoryEmoji: string | null;
}

// ---------------------------------------------------------------------------
// Data Service
// ---------------------------------------------------------------------------

/**
 * Interface for the data access layer.
 * Abstracts repository operations behind a unified service interface.
 *
 * In the modular monolith, this replaces direct repository instantiation
 * in handlers and provides a single entry point for all data operations.
 */
export interface IDataService {
  // -- Products --
  getAllProducts(): Promise<(typeof products.$inferSelect)[]>;
  getAllProductsWithDetails(): Promise<
    Array<{
      products: typeof products.$inferSelect;
      coffee_details: typeof coffeeDetails.$inferSelect | null;
      categories: typeof categories.$inferSelect | null;
    }>
  >;
  getProductById(id: number): Promise<typeof products.$inferSelect | undefined>;
  getProductsByCategory(categoryId: number): Promise<(typeof products.$inferSelect)[]>;
  getPopularProducts(limit?: number): Promise<
    Array<{
      name: string;
      category: string;
      favoritedCount: number;
    }>
  >;

  /**
   * Get all available products with a given boolean flag set to true.
   * Used by the bot's "featured" and "seasonal" menu surfaces.
   * @param flag - The boolean column to filter on
   */
  getByFlag(flag: 'featured' | 'isSeasonal'): Promise<(typeof products.$inferSelect)[]>;

  /**
   * Get all available beans with their coffee details joined.
   * Used by the "coffee passport" menu surface.
   */
  getBeansWithCoffeeDetails(): Promise<
    Array<{
      product: typeof products.$inferSelect;
      details: typeof coffeeDetails.$inferSelect;
    }>
  >;

  // -- Coffee Details --
  getCoffeeDetails(productId: number): Promise<typeof coffeeDetails.$inferSelect | null>;

  // -- Categories --
  getAllCategories(): Promise<(typeof categories.$inferSelect)[]>;

  // -- Branches --
  getActiveBranches(): Promise<(typeof branches.$inferSelect)[]>;

  // -- FAQs --
  getAllFaqs(): Promise<(typeof faq.$inferSelect)[]>;

  // -- Menu Config --
  getVisibleCategoryIds(): Promise<Set<number>>;

  /**
   * Get all visible menu-config entries for a section, joined with category
   * data. Used by the bot to render menu buttons per section.
   * @param section - Menu section key (e.g. 'drinks', 'beans', 'cakes', 'extras')
   */
  getBySection(section: string): Promise<MenuSectionEntry[]>;

  // -- Settings --
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // -- AI Logs --
  getRecentLogs(
    userId: string,
    limit?: number,
  ): Promise<
    Array<{
      question: string;
      response: string;
      timestamp: Date;
    }>
  >;

  // -- Favorites --
  getUserFavorites(telegramId: string): Promise<string[]>;
  toggleFavorite(telegramId: string, productId: number): Promise<boolean>;

  /**
   * Check whether a single product is favorited by the user.
   * Used to render the right toggle button on the product-detail page.
   */
  isFavorited(telegramId: string, productId: number): Promise<boolean>;

  /**
   * List all products the user has favorited, ordered newest first.
   * Returns the full product shape plus a `favoritedAt` timestamp.
   */
  list(telegramId: string): Promise<Array<typeof products.$inferSelect & { favoritedAt: Date }>>;

  // -- User State --
  getUserState(telegramId: string): Promise<typeof userState.$inferSelect | null>;
  upsertVisit(telegramId: string): Promise<{
    streakDays: number;
    isNewStreak: boolean;
  }>;

  // -- Messages --
  createMessage(data: {
    telegramId: string;
    content: string;
    senderName?: string;
    rating?: number;
    isAnonymous?: boolean;
  }): Promise<(typeof messages.$inferSelect)[]>;

  // -- AI Batch --
  buildAIContextBatch(userId: string): Promise<AIContextBatchResult>;

  // -- Branches (single) --
  getBranchById(id: number): Promise<typeof branches.$inferSelect | undefined>;
  getAllBranches(): Promise<(typeof branches.$inferSelect)[]>;
}
