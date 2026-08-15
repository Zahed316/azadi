import { getDb } from '../database/client';
import { D1Database } from '@cloudflare/workers-types';
import {
  products,
  categories,
  branches,
  faq,
  settings,
  aiConversationLogs,
  coffeeDetails,
  menuConfig,
  userState,
  favorites,
  messages,
} from '../database/schema';
import { eq, and, desc, lt, sql, inArray } from 'drizzle-orm';

export class ProductRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllProducts(): Promise<(typeof products.$inferSelect)[]> {
    return await this.db.select().from(products);
  }

  async getAllProductsWithDetails(): Promise<
    Array<{
      products: typeof products.$inferSelect;
      coffee_details: typeof coffeeDetails.$inferSelect | null;
      categories: typeof categories.$inferSelect | null;
    }>
  > {
    return await this.db
      .select()
      .from(products)
      .leftJoin(coffeeDetails, eq(products.id, coffeeDetails.productId))
      .leftJoin(categories, eq(products.categoryId, categories.id));
  }

  async getProductById(id: number): Promise<typeof products.$inferSelect | undefined> {
    const result = await this.db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductsByIds(ids: number[]): Promise<(typeof products.$inferSelect)[]> {
    if (ids.length === 0) return [];
    return await this.db.select().from(products).where(inArray(products.id, ids));
  }

  async addProduct(
    product: typeof products.$inferInsert,
  ): Promise<(typeof products.$inferSelect)[]> {
    return await this.db.insert(products).values(product).returning();
  }

  async updateProduct(
    id: number,
    data: Partial<typeof products.$inferInsert>,
  ): Promise<(typeof products.$inferSelect)[]> {
    return await this.db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
  }

  async deleteProduct(id: number): Promise<(typeof products.$inferSelect)[]> {
    return await this.db.delete(products).where(eq(products.id, id)).returning();
  }

  async updateStock(id: number, newStock: number): Promise<(typeof products.$inferSelect)[]> {
    return await this.db
      .update(products)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
  }

  async getProductsByCategory(categoryId: number): Promise<(typeof products.$inferSelect)[]> {
    return await this.db
      .select()
      .from(products)
      .where(and(eq(products.categoryId, categoryId), eq(products.available, true)));
  }

  /**
   * Get all *available* products with a given boolean flag set to true.
   * Used by the bot's "⭐ پیشنهاد ویژه" and "🌿 مخصوص فصل" surfaces to
   * surface dormant product fields. Only `featured` and `isSeasonal` are
   * allowed — both are non-null boolean columns on `products` and are
   * the only flags exposed in the public menu (others like `priceOnRequest`
   * are per-product pricing concerns, not catalogue surface flags).
   */
  async getByFlag(flag: 'featured' | 'isSeasonal'): Promise<(typeof products.$inferSelect)[]> {
    const column = flag === 'featured' ? products.featured : products.isSeasonal;
    return await this.db
      .select()
      .from(products)
      .where(and(eq(column, true), eq(products.available, true)));
  }

  /**
   * Get all available beans (products in the 'beans' menu section) that
   * have a `coffeeDetails` row attached — the input set for the "📖 پاسپورت قهوه"
   * surface. Joins coffee_details so the caller can read origin/farm/etc. in
   * one query instead of N+1.
   */
  async getBeansWithCoffeeDetails(): Promise<
    Array<{
      product: typeof products.$inferSelect;
      details: typeof coffeeDetails.$inferSelect;
    }>
  > {
    return await this.db
      .select({
        product: products,
        details: coffeeDetails,
      })
      .from(products)
      .innerJoin(coffeeDetails, eq(coffeeDetails.productId, products.id))
      .where(eq(products.available, true));
  }

  async toggleAvailability(
    id: number,
    available: boolean,
  ): Promise<(typeof products.$inferSelect)[]> {
    return await this.db
      .update(products)
      .set({ available, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
  }

  async cloneProduct(
    sourceId: number,
    targetBranchId: number,
  ): Promise<typeof products.$inferSelect | null> {
    const source = await this.getProductById(sourceId);
    if (!source) return null;

    const now = new Date();
    const { id: _id, createdAt: _created, ...rest } = source;
    const newProduct = await this.db
      .insert(products)
      .values({
        ...rest,
        branchId: targetBranchId,
        stock: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (newProduct[0]) {
      const details = await this.getCoffeeDetails(sourceId);
      if (details) {
        const { productId: _pid, ...detailsRest } = details;
        await this.db.insert(coffeeDetails).values({
          productId: newProduct[0].id,
          ...detailsRest,
        });
      }
    }

    return newProduct[0] ?? null;
  }

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
  ): Promise<void> {
    // Delete existing details first
    await this.db.delete(coffeeDetails).where(eq(coffeeDetails.productId, productId));
    // Insert new details if provided
    if (details) {
      await this.db.insert(coffeeDetails).values({ productId, ...details });
    }
  }

  async getCoffeeDetails(productId: number): Promise<typeof coffeeDetails.$inferSelect | null> {
    const result = await this.db
      .select()
      .from(coffeeDetails)
      .where(eq(coffeeDetails.productId, productId));
    return result[0] || null;
  }

  /**
   * Return the most-favorited products across all users, with category name
   * and favorited count. Used by the AI context to surface popular items.
   */
  async getPopularProducts(limit: number = 5): Promise<
    Array<{
      name: string;
      category: string;
      favoritedCount: number;
    }>
  > {
    return await this.db
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
      .limit(limit);
  }
}

export class CategoryRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllCategories(): Promise<(typeof categories.$inferSelect)[]> {
    return await this.db.select().from(categories).orderBy(categories.sortOrder);
  }

  async getCategoryById(id: number): Promise<typeof categories.$inferSelect | undefined> {
    const result = await this.db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async addCategory(
    data: typeof categories.$inferInsert,
  ): Promise<(typeof categories.$inferSelect)[]> {
    return await this.db.insert(categories).values(data).returning();
  }

  async updateCategory(
    id: number,
    data: Partial<typeof categories.$inferInsert>,
  ): Promise<(typeof categories.$inferSelect)[]> {
    return await this.db.update(categories).set(data).where(eq(categories.id, id)).returning();
  }

  async deleteCategory(id: number): Promise<(typeof categories.$inferSelect)[]> {
    return await this.db.delete(categories).where(eq(categories.id, id)).returning();
  }
}

export class BranchRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllBranches(): Promise<(typeof branches.$inferSelect)[]> {
    return await this.db.select().from(branches);
  }

  async getActiveBranches(): Promise<(typeof branches.$inferSelect)[]> {
    return await this.db.select().from(branches).where(eq(branches.isActive, true));
  }

  async getBranchById(id: number): Promise<typeof branches.$inferSelect | undefined> {
    const result = await this.db.select().from(branches).where(eq(branches.id, id));
    return result[0];
  }

  async addBranch(data: typeof branches.$inferInsert): Promise<(typeof branches.$inferSelect)[]> {
    return await this.db.insert(branches).values(data).returning();
  }

  async updateBranch(
    id: number,
    data: Partial<typeof branches.$inferInsert>,
  ): Promise<(typeof branches.$inferSelect)[]> {
    return await this.db.update(branches).set(data).where(eq(branches.id, id)).returning();
  }

  async deleteBranch(id: number): Promise<(typeof branches.$inferSelect)[]> {
    return await this.db.delete(branches).where(eq(branches.id, id)).returning();
  }
}

export class FaqRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAll(): Promise<(typeof faq.$inferSelect)[]> {
    return await this.db.select().from(faq);
  }

  async getById(id: number): Promise<typeof faq.$inferSelect | undefined> {
    const result = await this.db.select().from(faq).where(eq(faq.id, id));
    return result[0];
  }

  async add(question: string, answer: string): Promise<(typeof faq.$inferSelect)[]> {
    return await this.db.insert(faq).values({ question, answer }).returning();
  }

  async delete(id: number): Promise<(typeof faq.$inferSelect)[]> {
    return await this.db.delete(faq).where(eq(faq.id, id)).returning();
  }

  async update(id: number, question: string, answer: string): Promise<(typeof faq.$inferSelect)[]> {
    return await this.db.update(faq).set({ question, answer }).where(eq(faq.id, id)).returning();
  }
}

export class SettingsRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllSettings(): Promise<(typeof settings.$inferSelect)[]> {
    return await this.db.select().from(settings);
  }

  async getValue(key: string): Promise<string | null> {
    const result = await this.db.select().from(settings).where(eq(settings.key, key));
    return result[0]?.value || null;
  }

  async setValue(key: string, value: string): Promise<(typeof settings.$inferSelect)[]> {
    return await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .returning();
  }

  async deleteSetting(key: string): Promise<(typeof settings.$inferSelect)[]> {
    return await this.db.delete(settings).where(eq(settings.key, key)).returning();
  }
}

export class AiLogRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async logConversation(
    userId: string,
    question: string,
    response: string,
  ): Promise<(typeof aiConversationLogs.$inferSelect)[]> {
    return await this.db
      .insert(aiConversationLogs)
      .values({
        userId,
        question,
        response,
        timestamp: new Date(),
      })
      .returning();
  }

  async getRecentLogs(
    userId: string,
    limit: number = 5,
  ): Promise<(typeof aiConversationLogs.$inferSelect)[]> {
    return await this.db
      .select()
      .from(aiConversationLogs)
      .where(eq(aiConversationLogs.userId, userId))
      .orderBy(desc(aiConversationLogs.timestamp))
      .limit(limit);
  }

  async getAllLogs(
    limit: number = 50,
    offset: number = 0,
  ): Promise<(typeof aiConversationLogs.$inferSelect)[]> {
    return await this.db
      .select()
      .from(aiConversationLogs)
      .orderBy(desc(aiConversationLogs.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getLogsByUser(
    userId: string,
    limit: number = 50,
  ): Promise<(typeof aiConversationLogs.$inferSelect)[]> {
    return await this.db
      .select()
      .from(aiConversationLogs)
      .where(eq(aiConversationLogs.userId, userId))
      .orderBy(desc(aiConversationLogs.timestamp))
      .limit(limit);
  }
}

export class MenuConfigRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  /** Get all visible entries for a section with joined category data */
  async getBySection(section: string): Promise<
    Array<{
      id: number;
      categoryId: number;
      menuSection: string;
      displayOrder: number;
      isVisible: boolean;
      buttonLabel: string | null;
      specialMessage: string | null;
      categoryName: string | null;
      categoryEmoji: string | null;
    }>
  > {
    return await this.db
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
      .orderBy(menuConfig.displayOrder);
  }

  /** Get all entries (admin UI — includes hidden) */
  async getAll(): Promise<
    Array<{
      id: number;
      categoryId: number;
      menuSection: string;
      displayOrder: number;
      isVisible: boolean;
      buttonLabel: string | null;
      specialMessage: string | null;
      categoryName: string | null;
      categoryEmoji: string | null;
    }>
  > {
    return await this.db
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
      .orderBy(menuConfig.menuSection, menuConfig.displayOrder);
  }

  async add(data: typeof menuConfig.$inferInsert): Promise<(typeof menuConfig.$inferSelect)[]> {
    return await this.db.insert(menuConfig).values(data).returning();
  }

  async update(
    id: number,
    data: Partial<typeof menuConfig.$inferInsert>,
  ): Promise<(typeof menuConfig.$inferSelect)[]> {
    return await this.db
      .update(menuConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(menuConfig.id, id))
      .returning();
  }

  async delete(id: number): Promise<(typeof menuConfig.$inferSelect)[]> {
    return await this.db.delete(menuConfig).where(eq(menuConfig.id, id)).returning();
  }

  async reorder(items: { id: number; displayOrder: number }[]): Promise<void> {
    if (items.length === 0) return;
    const results = await Promise.allSettled(
      items.map((item) =>
        this.db
          .update(menuConfig)
          .set({ displayOrder: item.displayOrder, updatedAt: new Date() })
          .where(eq(menuConfig.id, item.id)),
      ),
    );
    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      throw new Error(`Menu reorder failed: ${failures}/${items.length} updates failed`);
    }
  }

  /** Returns the Set of category IDs that are visible in any menu section. */
  async getVisibleCategoryIds(): Promise<Set<number>> {
    const rows = await this.db
      .select({ categoryId: menuConfig.categoryId })
      .from(menuConfig)
      .where(eq(menuConfig.isVisible, true));
    return new Set(rows.map((r) => r.categoryId));
  }
}

// Phase 5.1: per-user streak state. Identified by Telegram user_id (cast to
// text). Streak math uses UTC day boundaries so the daily cron sweep (21:00
// UTC, declared in wrangler.toml) lines up with the day-rollover decision.
export interface UpsertVisitResult {
  /** Current streak length (0 for first-ever visit, 1 for first-visit-today). */
  streakDays: number;
  /** True iff this call incremented streakDays above its previous value. */
  isNewStreak: boolean;
  /** True iff this was the first time we've seen this telegram_id. */
  isFirstVisit: boolean;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_GAP_MS = 48 * 60 * 60 * 1000; // 48h

function utcDayKey(d: Date): number {
  // Days since epoch in UTC. D1 stores integer epoch for timestamp columns;
  // we compare in days so clock skew within a day doesn't reset the streak.
  return Math.floor(d.getTime() / ONE_DAY_MS);
}

export class UserStateRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getByTelegramId(telegramId: string): Promise<typeof userState.$inferSelect | null> {
    const rows = await this.db.select().from(userState).where(eq(userState.telegramId, telegramId));
    return rows[0] ?? null;
  }

  /**
   * Admin read: return every user_state row, ordered by streak length then
   * most-recent activity. No WHERE clause — the admin surface sees every
   * tracked user. No pagination (the table is small in practice).
   */
  async listAll(): Promise<(typeof userState.$inferSelect)[]> {
    return await this.db
      .select()
      .from(userState)
      .orderBy(desc(userState.streakDays), desc(userState.lastSeenAt));
  }

  /**
   * Record a user visit and return the resulting streak state. Idempotent
   * within a UTC day: re-calling on the same day returns isNewStreak=false.
   *
   * Streak rules:
   * - First-ever visit: streakDays=1, isFirstVisit=true.
   * - Visited yesterday (UTC): streakDays = previous + 1.
   * - Visited 2+ days ago: streakDays resets to 1.
   * - Visited earlier today: no change, isNewStreak=false.
   */
  async upsertVisit(telegramId: string, now: Date = new Date()): Promise<UpsertVisitResult> {
    const existing = await this.getByTelegramId(telegramId);
    const nowDay = utcDayKey(now);

    if (!existing) {
      await this.db.insert(userState).values({
        telegramId,
        firstSeenAt: now,
        lastSeenAt: now,
        visitsTotal: 1,
        streakDays: 1,
      });
      return { streakDays: 1, isNewStreak: true, isFirstVisit: true };
    }

    const lastDay = utcDayKey(existing.lastSeenAt);
    if (lastDay === nowDay) {
      // Same UTC day — bump visits_total, leave streak alone.
      await this.db
        .update(userState)
        .set({ visitsTotal: existing.visitsTotal + 1, lastSeenAt: now })
        .where(eq(userState.telegramId, telegramId));
      return {
        streakDays: existing.streakDays,
        isNewStreak: false,
        isFirstVisit: false,
      };
    }

    const gap = now.getTime() - existing.lastSeenAt.getTime();
    const newStreak = gap < STREAK_GAP_MS ? existing.streakDays + 1 : 1;
    await this.db
      .update(userState)
      .set({
        lastSeenAt: now,
        visitsTotal: existing.visitsTotal + 1,
        streakDays: newStreak,
      })
      .where(eq(userState.telegramId, telegramId));
    return {
      streakDays: newStreak,
      isNewStreak: newStreak > existing.streakDays,
      isFirstVisit: false,
    };
  }

  /**
   * Reset streakDays to 0 for a specific user. Used by the admin streak
   * reset endpoint. Returns true if the user existed (row was updated),
   * false if no matching telegramId was found.
   */
  async resetStreak(telegramId: string): Promise<boolean> {
    const rows = await this.db
      .update(userState)
      .set({ streakDays: 0 })
      .where(eq(userState.telegramId, telegramId))
      .returning({ telegramId: userState.telegramId });
    return rows.length > 0;
  }

  /**
   * Reset streakDays to 0 for users who haven't been seen in 48h. Idempotent:
   * a re-run after the reset is a no-op (the WHERE clause filters them out).
   * Returns the number of rows reset, for cron logging. Uses SQLite's
   * RETURNING clause so the count is accurate in a single round-trip.
   */
  async sweepStaleStreaks(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - STREAK_GAP_MS);
    const rows = await this.db
      .update(userState)
      .set({ streakDays: 0 })
      .where(and(lt(userState.lastSeenAt, cutoff), sql`${userState.streakDays} > 0`))
      .returning({ telegramId: userState.telegramId });
    return rows.length;
  }
}

// Phase 5.2: per-user product favorites. Composite PK on (telegram_id,
// product_id) prevents duplicates; foreign key cascades on product delete.
export class FavoritesRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  /**
   * Add a product to the user's favorites. Idempotent: returns true on
   * insert, false on duplicate (composite PK collision). Uses SQLite's
   * RETURNING to detect the actual insert vs the no-op on conflict.
   */
  async add(telegramId: string, productId: number): Promise<boolean> {
    const rows = await this.db
      .insert(favorites)
      .values({ telegramId, productId, createdAt: new Date() })
      .onConflictDoNothing()
      .returning({ telegramId: favorites.telegramId });
    return rows.length > 0;
  }

  /**
   * Remove a product from the user's favorites. Returns true if a row was
   * actually deleted, false if the (telegramId, productId) pair didn't exist.
   */
  async remove(telegramId: string, productId: number): Promise<boolean> {
    const rows = await this.db
      .delete(favorites)
      .where(and(eq(favorites.telegramId, telegramId), eq(favorites.productId, productId)))
      .returning({ telegramId: favorites.telegramId });
    return rows.length > 0;
  }

  /**
   * List all products the user has favorited, joined with the product row
   * and ordered by favorite creation time (newest first). Returns the full
   * Product shape plus a `favoritedAt` timestamp for the menu surface.
   */
  async list(
    telegramId: string,
  ): Promise<Array<typeof products.$inferSelect & { favoritedAt: Date }>> {
    return await this.db
      .select({
        id: products.id,
        branchId: products.branchId,
        categoryId: products.categoryId,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        unit: products.unit,
        imageUrl: products.imageUrl,
        available: products.available,
        featured: products.featured,
        priceOnRequest: products.priceOnRequest,
        isSeasonal: products.isSeasonal,
        sizeOptions: products.sizeOptions,
        syrupOptions: products.syrupOptions,
        calories: products.calories,
        allergens: products.allergens,
        caffeineMg: products.caffeineMg,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        favoritedAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(products, eq(products.id, favorites.productId))
      .where(eq(favorites.telegramId, telegramId))
      .orderBy(desc(favorites.createdAt));
  }

  /**
   * Admin read: return every favorites row joined with the product name.
   * Uses LEFT JOIN so orphan favorites (product deleted by cascade — the
   * cascade normally removes them, but a stale row from before the cascade
   * was added would still appear with productName: null) still surface.
   * Returns a flat list; the client groups by telegramId or productId
   * depending on the page's "groupBy" toggle.
   */
  async listAllGrouped(): Promise<
    Array<{
      telegramId: string;
      productId: number;
      productName: string | null;
      favoritedAt: Date;
    }>
  > {
    return await this.db
      .select({
        telegramId: favorites.telegramId,
        productId: favorites.productId,
        productName: products.name,
        favoritedAt: favorites.createdAt,
      })
      .from(favorites)
      .leftJoin(products, eq(products.id, favorites.productId))
      .orderBy(desc(favorites.createdAt));
  }

  /**
   * Check whether a single product is favorited by the user. Used to render
   * the right toggle button on the product-detail page.
   */
  async isFavorited(telegramId: string, productId: number): Promise<boolean> {
    const rows = await this.db
      .select({ telegramId: favorites.telegramId })
      .from(favorites)
      .where(and(eq(favorites.telegramId, telegramId), eq(favorites.productId, productId)))
      .limit(1);
    return rows.length > 0;
  }
}

export class MessageRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async create(data: {
    telegramId: string;
    senderName?: string | null;
    senderEmail?: string | null;
    content: string;
    rating?: number | null;
    isAnonymous?: boolean;
  }): Promise<(typeof messages.$inferSelect)[]> {
    return await this.db
      .insert(messages)
      .values({
        telegramId: data.telegramId,
        senderName: data.senderName ?? null,
        senderEmail: data.senderEmail ?? null,
        content: data.content,
        rating: data.rating ?? null,
        isAnonymous: data.isAnonymous ?? false,
        createdAt: new Date(),
      })
      .returning();
  }

  async getAll(limit = 50, offset = 0): Promise<(typeof messages.$inferSelect)[]> {
    return await this.db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getById(id: number): Promise<typeof messages.$inferSelect | null> {
    const result = await this.db.select().from(messages).where(eq(messages.id, id));
    return result[0] || null;
  }

  async markRead(id: number): Promise<void> {
    await this.db.update(messages).set({ isRead: true }).where(eq(messages.id, id));
  }

  async markReplied(id: number, replyText: string): Promise<void> {
    await this.db
      .update(messages)
      .set({
        replied: true,
        replyText,
        repliedAt: new Date(),
        isRead: true,
      })
      .where(eq(messages.id, id));
  }

  async getUnreadCount(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.replied, false));
    return result[0]?.count ?? 0;
  }
}
