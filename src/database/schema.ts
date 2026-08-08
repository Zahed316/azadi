import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

// TODO: Add CHECK constraints for data integrity (e.g. stock >= 0, price >= 0,
// rating BETWEEN 1 AND 5, unit IN ('cup','kg','piece','slice','item')).
// Requires a D1 migration — cannot be added without one.

export const branches = sqliteTable('branches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  address: text('address').notNull(),
  phone: text('phone'),
  location: text('location'), // e.g. maps URL or coordinates
  openingHours: text('opening_hours'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  emoji: text('emoji'),
  sortOrder: integer('sort_order').default(0),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    branchId: integer('branch_id').references(() => branches.id), // nullable if shared
    categoryId: integer('category_id')
      .references(() => categories.id)
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    price: real('price'),
    stock: integer('stock').notNull().default(0),
    unit: text('unit').notNull().default('item'), // item, kg, g
    imageUrl: text('image_url'),
    available: integer('available', { mode: 'boolean' }).default(true),
    featured: integer('featured', { mode: 'boolean' }).default(false),
    priceOnRequest: integer('price_on_request', { mode: 'boolean' }).default(false),
    isSeasonal: integer('is_seasonal', { mode: 'boolean' }).default(false),
    sizeOptions: text('size_options'),
    syrupOptions: text('syrup_options'),
    calories: integer('calories'),
    allergens: text('allergens'),
    caffeineMg: integer('caffeine_mg'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    idxCategory: index('idx_products_category').on(t.categoryId),
    idxAvailable: index('idx_products_available').on(t.available),
    idxFeatured: index('idx_products_featured').on(t.featured),
    idxSeasonal: index('idx_products_seasonal').on(t.isSeasonal),
    idxCategoryAvailable: index('idx_products_cat_avail').on(t.categoryId, t.available),
  }),
);

export const coffeeDetails = sqliteTable('coffee_details', {
  productId: integer('product_id')
    .primaryKey()
    .references(() => products.id),
  origin: text('origin'),
  farm: text('farm'),
  altitude: text('altitude'),
  processing: text('processing'),
  variety: text('variety'),
  roastLevel: text('roast_level'),
  flavorNotes: text('flavor_notes'),
  recommendedBrew: text('recommended_brew'),
  acidity: text('acidity'),
  body: text('body'),
  brewGuide: text('brew_guide'),
});

export const faq = sqliteTable('faq', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(), // about, instagram, etc
  value: text('value').notNull(),
});

export const aiConversationLogs = sqliteTable(
  'ai_conversation_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    question: text('question').notNull(),
    response: text('response').notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    idxUserTs: index('idx_ai_logs_user_ts').on(t.userId, t.timestamp),
  }),
);

export const sessions = sqliteTable('sessions', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const admins = sqliteTable('admins', {
  telegramId: integer('telegram_id').primaryKey(),
  role: text('role').notNull().default('super_admin'), // super_admin or category_admin
  categoryId: integer('category_id').references(() => categories.id), // Restricted category
});

export const menuConfig = sqliteTable('menu_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id')
    .references(() => categories.id)
    .notNull(),
  menuSection: text('menu_section').notNull(), // 'drinks'|'beans'|'cakes'|'extras'
  displayOrder: integer('display_order').default(0).notNull(),
  isVisible: integer('is_visible', { mode: 'boolean' }).default(true).notNull(),
  buttonLabel: text('button_label'),
  specialMessage: text('special_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Phase 5.1: per-user streak counter state. Implicit identity by Telegram
// user_id (cast to text); no signup. Drizzle's `mode: 'timestamp'` columns
// store integer epoch under the hood, matching the rest of the schema.
// last_quiz_at is reserved for a future quiz mechanic (Phase 5b/6).
export const userState = sqliteTable('user_state', {
  telegramId: text('telegram_id').primaryKey(),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  visitsTotal: integer('visits_total').notNull().default(0),
  streakDays: integer('streak_days').notNull().default(0),
  lastQuizAt: integer('last_quiz_at', { mode: 'timestamp' }),
});

// Phase 5.2: per-user product favorites. Composite PK prevents duplicates;
// the foreign key cascades on product delete so favorites don't outlive
// the products they reference. The "user" index supports the
// "⭐ منوهای من" list query (WHERE telegram_id = ? ORDER BY created_at DESC).
export const favorites = sqliteTable(
  'favorites',
  {
    telegramId: text('telegram_id').notNull(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.telegramId, t.productId] }),
  }),
);

// User-to-admin messaging: feedback, contact, and anonymous messages.
// Single reply per message (admin_reply column), not threaded chat.
export const messages = sqliteTable(
  'messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    telegramId: text('telegram_id').notNull(),
    senderName: text('sender_name'),
    senderEmail: text('sender_email'),
    content: text('content').notNull(),
    rating: integer('rating'), // 1-5 stars, null for non-feedback messages
    isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false),
    isRead: integer('is_read', { mode: 'boolean' }).default(false),
    replied: integer('replied', { mode: 'boolean' }).default(false),
    replyText: text('reply_text'),
    repliedAt: integer('replied_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    idxUnread: index('idx_messages_unread').on(t.isRead),
    idxCreated: index('idx_messages_created').on(t.createdAt),
    idxUser: index('idx_messages_user').on(t.telegramId),
  }),
);
