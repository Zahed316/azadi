/**
 * Shared TypeScript types for the Azadi admin app.
 *
 * These match the JSON shapes returned by the Worker REST API.
 * Dates are ISO strings (JSON serialization of D1 timestamps).
 */

// ---------------------------------------------------------------------------
// Core resource types (match src/database/schema.ts)
// ---------------------------------------------------------------------------

export interface Product {
  id: number;
  branchId: number | null;
  categoryId: number;
  name: string;
  description: string | null;
  price: number | null;
  stock: number;
  unit: string;
  imageUrl: string | null;
  available: boolean | null;
  featured: boolean | null;
  priceOnRequest: boolean | null;
  isSeasonal: boolean | null;
  sizeOptions: string | null;
  syrupOptions: string | null;
  calories: number | null;
  allergens: string | null;
  caffeineMg: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Product as returned by GET /products (joined with coffee_details + category). */
export interface ProductRow extends Product {
  coffee_details: CoffeeDetails | null;
  category_name: string | null;
  category_emoji: string | null;
}

export interface CoffeeDetails {
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
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  emoji: string | null;
  sortOrder: number | null;
}

export interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  location: string | null;
  openingHours: string | null;
  isActive: boolean | null;
}

export interface Faq {
  id: number;
  question: string;
  answer: string;
}

export interface MenuConfig {
  id: number;
  categoryId: number;
  menuSection: string;
  displayOrder: number;
  isVisible: boolean | null;
  buttonLabel: string | null;
  specialMessage: string | null;
}

export interface Admin {
  telegramId: number;
  role: string;
  categoryId: number | null;
}

/** Setting row as returned by GET /settings. */
export interface Setting {
  key: string;
  value: string;
}

export interface AiLog {
  id: number;
  userId: string;
  question: string;
  response: string;
  timestamp: string;
}

export interface UserState {
  telegramId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  visitsTotal: number;
  streakDays: number;
}

export interface Message {
  id: number;
  telegramId: string;
  senderName: string | null;
  senderEmail: string | null;
  content: string;
  rating: number | null;
  isAnonymous: boolean | null;
  isRead: boolean | null;
  replied: boolean | null;
  replyText: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export interface Favorite {
  telegramId: string;
  productId: number;
  productName: string | null;
  favoritedAt: number | string;
}

// ---------------------------------------------------------------------------
// API response envelopes (keys match backend JSON)
// ---------------------------------------------------------------------------

export interface ProductsResponse {
  products: ProductRow[];
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface BranchesResponse {
  branches: Branch[];
}

export interface FaqsResponse {
  faqs: Faq[];
}

export interface MenuConfigsResponse {
  menuConfigs: MenuConfig[];
}

export interface AdminsResponse {
  admins: Admin[];
}

/** GET /settings returns { settings: Setting[] } — an array of key-value pairs. */
export interface SettingsResponse {
  settings: Setting[];
}

export interface AiLogsResponse {
  logs: AiLog[];
}

export interface StreaksResponse {
  users: UserState[];
}

export interface StreakConfig {
  streakMessages: boolean;
  streakCronEnabled: boolean;
}

export interface FavoritesResponse {
  favorites: Favorite[];
}

export interface MessagesResponse {
  messages: Message[];
}

export interface CurrentUserResponse {
  user: Admin;
}

export interface HealthResponse {
  status: string;
  db: boolean;
  timestamp: string;
}
