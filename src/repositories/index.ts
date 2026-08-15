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
  messages,
} from '../database/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

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
