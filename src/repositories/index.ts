import { getDb } from '../database/client';
import { products, categories, branches, faq, settings, aiConversationLogs, coffeeDetails, menuConfig } from '../database/schema';
import { eq, and, desc } from 'drizzle-orm';

export class ProductRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: any) {
    this.db = getDb(d1Binding);
  }

  async getAllProducts() {
    return await this.db.select().from(products);
  }

  async getAllProductsWithDetails() {
    return await this.db.select().from(products)
      .leftJoin(coffeeDetails, eq(products.id, coffeeDetails.productId));
  }

  async getProductById(id: number) {
    const result = await this.db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async addProduct(product: typeof products.$inferInsert) {
    return await this.db.insert(products).values(product).returning();
  }

  async updateProduct(id: number, data: Partial<typeof products.$inferInsert>) {
    return await this.db.update(products).set({ ...data, updatedAt: new Date() }).where(eq(products.id, id)).returning();
  }

  async deleteProduct(id: number) {
    return await this.db.delete(products).where(eq(products.id, id)).returning();
  }

  async updateStock(id: number, newStock: number) {
    return await this.db.update(products).set({ stock: newStock, updatedAt: new Date() }).where(eq(products.id, id)).returning();
  }

  async getProductsByCategory(categoryId: number) {
    return await this.db.select().from(products).where(and(eq(products.categoryId, categoryId), eq(products.available, true)));
  }

  async toggleAvailability(id: number, available: boolean) {
    return await this.db.update(products).set({ available, updatedAt: new Date() }).where(eq(products.id, id)).returning();
  }
}

export class CategoryRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: any) {
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

  constructor(d1Binding: any) {
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

  constructor(d1Binding: any) {
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
}

export class SettingsRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: any) {
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
    return await this.db.insert(settings)
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

  constructor(d1Binding: any) {
    this.db = getDb(d1Binding);
  }

  async logConversation(userId: string, question: string, response: string) {
    return await this.db.insert(aiConversationLogs).values({
      userId,
      question,
      response,
      timestamp: new Date()
    }).returning();
  }

  async getRecentLogs(userId: string, limit: number = 5) {
    return await this.db.select()
      .from(aiConversationLogs)
      .where(eq(aiConversationLogs.userId, userId))
      .orderBy(desc(aiConversationLogs.timestamp))
      .limit(limit);
  }
}

export class MenuConfigRepository {
  private db: ReturnType<typeof getDb>;

  constructor(d1Binding: any) {
    this.db = getDb(d1Binding);
  }

  /** Get all visible entries for a section with joined category data */
  async getBySection(section: string) {
    return await this.db
      .select({
        id:              menuConfig.id,
        categoryId:      menuConfig.categoryId,
        menuSection:     menuConfig.menuSection,
        displayOrder:    menuConfig.displayOrder,
        isVisible:       menuConfig.isVisible,
        buttonLabel:     menuConfig.buttonLabel,
        specialMessage:  menuConfig.specialMessage,
        categoryName:    categories.name,
        categoryEmoji:   categories.emoji,
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
        id:              menuConfig.id,
        categoryId:      menuConfig.categoryId,
        menuSection:     menuConfig.menuSection,
        displayOrder:    menuConfig.displayOrder,
        isVisible:       menuConfig.isVisible,
        buttonLabel:     menuConfig.buttonLabel,
        specialMessage:  menuConfig.specialMessage,
        categoryName:    categories.name,
        categoryEmoji:   categories.emoji,
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
}
