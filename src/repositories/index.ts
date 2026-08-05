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
} from '../database/schema';
import { eq, and, desc, lt, sql } from 'drizzle-orm';

export class ProductRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllProducts() {
    return await this.db.select().from(products);
  }

  async getAllProductsWithDetails() {
    return await this.db
      .select()
      .from(products)
      .leftJoin(coffeeDetails, eq(products.id, coffeeDetails.productId))
      .leftJoin(categories, eq(products.categoryId, categories.id));
  }

  async getProductById(id: number) {
    const result = await this.db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async addProduct(product: typeof products.$inferInsert) {
    return await this.db.insert(products).values(product).returning();
  }

  async updateProduct(id: number, data: Partial<typeof products.$inferInsert>) {
    return await this.db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
  }

  async deleteProduct(id: number) {
    return await this.db.delete(products).where(eq(products.id, id)).returning();
  }

  async updateStock(id: number, newStock: number) {
    return await this.db
      .update(products)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
  }

  async getProductsByCategory(categoryId: number) {
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
  async getByFlag(flag: 'featured' | 'isSeasonal') {
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
  async getBeansWithCoffeeDetails() {
    return await this.db
      .select({
        product: products,
        details: coffeeDetails,
      })
      .from(products)
      .innerJoin(coffeeDetails, eq(coffeeDetails.productId, products.id))
      .where(eq(products.available, true));
  }

  async toggleAvailability(id: number, available: boolean) {
    return await this.db
      .update(products)
      .set({ available, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
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
    } | null,
  ) {
    // Delete existing details first
    await this.db.delete(coffeeDetails).where(eq(coffeeDetails.productId, productId));
    // Insert new details if provided
    if (details) {
      await this.db.insert(coffeeDetails).values({ productId, ...details });
    }
  }
}

export class CategoryRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllCategories() {
    return await this.db.select().from(categories).orderBy(categories.sortOrder);
  }

  async getCategoryById(id: number) {
    const result = await this.db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async addCategory(data: typeof categories.$inferInsert) {
    return await this.db.insert(categories).values(data).returning();
  }

  async updateCategory(id: number, data: Partial<typeof categories.$inferInsert>) {
    return await this.db.update(categories).set(data).where(eq(categories.id, id)).returning();
  }

  async deleteCategory(id: number) {
    return await this.db.delete(categories).where(eq(categories.id, id)).returning();
  }
}

export class BranchRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllBranches() {
    return await this.db.select().from(branches);
  }

  async getBranchById(id: number) {
    const result = await this.db.select().from(branches).where(eq(branches.id, id));
    return result[0];
  }

  async addBranch(data: typeof branches.$inferInsert) {
    return await this.db.insert(branches).values(data).returning();
  }

  async updateBranch(id: number, data: Partial<typeof branches.$inferInsert>) {
    return await this.db.update(branches).set(data).where(eq(branches.id, id)).returning();
  }

  async deleteBranch(id: number) {
    return await this.db.delete(branches).where(eq(branches.id, id)).returning();
  }
}

export class FaqRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAll() {
    return await this.db.select().from(faq);
  }

  async getById(id: number) {
    const result = await this.db.select().from(faq).where(eq(faq.id, id));
    return result[0];
  }

  async add(question: string, answer: string) {
    return await this.db.insert(faq).values({ question, answer }).returning();
  }

  async delete(id: number) {
    return await this.db.delete(faq).where(eq(faq.id, id)).returning();
  }

  async update(id: number, question: string, answer: string) {
    return await this.db.update(faq).set({ question, answer }).where(eq(faq.id, id)).returning();
  }
}

export class SettingsRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async getAllSettings() {
    return await this.db.select().from(settings);
  }

  async getValue(key: string): Promise<string | null> {
    const result = await this.db.select().from(settings).where(eq(settings.key, key));
    return result[0]?.value || null;
  }

  async setValue(key: string, value: string) {
    return await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .returning();
  }

  async deleteSetting(key: string) {
    return await this.db.delete(settings).where(eq(settings.key, key)).returning();
  }
}

export class AiLogRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: D1Database) {
    this.db = getDb(d1Binding);
  }

  async logConversation(userId: string, question: string, response: string) {
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

  async getRecentLogs(userId: string, limit: number = 5) {
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
  async getBySection(section: string) {
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
  async getAll() {
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

  async add(data: typeof menuConfig.$inferInsert) {
    return await this.db.insert(menuConfig).values(data).returning();
  }

  async update(id: number, data: Partial<typeof menuConfig.$inferInsert>) {
    return await this.db
      .update(menuConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(menuConfig.id, id))
      .returning();
  }

  async delete(id: number) {
    return await this.db.delete(menuConfig).where(eq(menuConfig.id, id)).returning();
  }

  async reorder(items: { id: number; displayOrder: number }[]) {
    for (const item of items) {
      await this.db
        .update(menuConfig)
        .set({ displayOrder: item.displayOrder, updatedAt: new Date() })
        .where(eq(menuConfig.id, item.id));
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

  async getByTelegramId(telegramId: string) {
    const rows = await this.db.select().from(userState).where(eq(userState.telegramId, telegramId));
    return rows[0] ?? null;
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
