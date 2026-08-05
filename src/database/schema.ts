import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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

export const products = sqliteTable('products', {
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

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

export const aiConversationLogs = sqliteTable('ai_conversation_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  question: text('question').notNull(),
  response: text('response').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

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
