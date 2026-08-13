/**
 * Public API filter tests.
 *
 * Verifies that /api/public/* endpoints return correctly filtered data
 * (available products only, active branches only, whitelisted settings, etc.).
 *
 * Strategy: mock DataService (the abstraction used by public.ts) instead of
 * raw Drizzle — avoids duplicating the harness's in-memory DB.
 */
import { describe, test, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DataService — the public API handler delegates all data access here
// ---------------------------------------------------------------------------

const mockProducts = [
  {
    products: { id: 1, name: 'Espresso', price: 50000, categoryId: 1, available: true, unit: 'cup', featured: true, isSeasonal: false, priceOnRequest: false, stock: 0, description: null, imageUrl: null, sizeOptions: null, syrupOptions: null, calories: null, allergens: null, caffeineMg: null },
    coffee_details: null,
    categories: { id: 1, name: 'Drinks', emoji: '☕', description: null, sortOrder: 0 },
  },
  {
    products: { id: 2, name: 'Latte', price: 55000, categoryId: 1, available: false, unit: 'cup', featured: false, isSeasonal: false, priceOnRequest: false, stock: 0, description: null, imageUrl: null, sizeOptions: null, syrupOptions: null, calories: null, allergens: null, caffeineMg: null },
    coffee_details: null,
    categories: { id: 1, name: 'Drinks', emoji: '☕', description: null, sortOrder: 0 },
  },
  {
    products: { id: 3, name: 'Muffin', price: 25000, categoryId: 2, available: true, unit: 'item', featured: false, isSeasonal: true, priceOnRequest: false, stock: 10, description: null, imageUrl: null, sizeOptions: null, syrupOptions: null, calories: null, allergens: null, caffeineMg: null },
    coffee_details: null,
    categories: { id: 2, name: 'Bakery', emoji: '🧁', description: null, sortOrder: 1 },
  },
];

const mockBranches = [
  { id: 1, name: 'Main', address: '123 St', phone: '0912', openingHours: '8-22', location: null, isActive: true },
  { id: 2, name: 'Closed', address: '456 St', phone: '0935', openingHours: '9-18', location: null, isActive: false },
];

const mockCategories = [
  { id: 1, name: 'Drinks', emoji: '☕', description: null, sortOrder: 0 },
  { id: 2, name: 'Bakery', emoji: '🧁', description: null, sortOrder: 1 },
];

const mockFaqs = [
  { id: 1, question: 'Hours?', answer: '8-22' },
  { id: 2, question: 'Delivery?', answer: 'No' },
];

class MockDataService {
  getAllProductsWithDetails() { return mockProducts; }
  getActiveBranches() { return mockBranches.filter((b) => b.isActive); }
  getAllCategories() { return mockCategories; }
  getAllFaqs() { return mockFaqs; }
  getBySection(_section: string) { return []; }
  getProductById(id: number) { return mockProducts.find((p) => p.products.id === id)?.products ?? null; }
  getCoffeeDetails(_id: number) { return null; }
}

vi.mock('../services/data', () => ({
  DataService: MockDataService,
}));

// ---------------------------------------------------------------------------
// Mock CacheService (not used by tests, just needs to exist)
// ---------------------------------------------------------------------------

vi.mock('../services/cache', () => ({
  CacheService: class MockCacheService {},
}));

// ---------------------------------------------------------------------------
// Mock getDb (used by the settings endpoint directly)
// ---------------------------------------------------------------------------

const mockSettingsRows = [
  { key: 'about', value: 'We roast coffee' },
  { key: 'price_unit', value: 'تومان' },
  { key: 'instagram', value: 'https://ig.me/azadi' },
  { key: 'secret_admin', value: 'hidden' },
  { key: 'welcome_message', value: 'Welcome!' },
  { key: 'vat_note', value: 'Includes VAT' },
];

const mockDb = {
  select: () => ({
    from: (_table: unknown) => Promise.resolve(mockSettingsRows),
  }),
};

vi.mock('../database/client', () => ({
  getDb: vi.fn(() => mockDb),
}));

// ---------------------------------------------------------------------------
// Helper to call the public API
// ---------------------------------------------------------------------------

async function callPublic(path: string): Promise<{ status: number; body: any }> {
  const { handlePublicApiRequest } = await import('../api/public');
  const url = `https://bot.test/api/public/${path}`;
  const request = new Request(url, { method: 'GET' });
  const env = {
    TELEGRAM_BOT_TOKEN: 'test',
    SECRET_TOKEN: 'test',
    DB: {} as any,
    CACHE: undefined as any,
    OPENCODE_API_KEY: 'test',
  };
  const ctx = {} as ExecutionContext;
  const response = await handlePublicApiRequest(request, env, ctx);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/public/products', () => {
  test('returns only available products', async () => {
    const res = await callPublic('products');
    expect(res.status).toBe(200);
    // mockProducts has 3 items, 2 are available (id 1 and 3)
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products.every((p: any) => p.available)).toBe(true);
  });

  test('filters by categoryId when provided', async () => {
    const res = await callPublic('products?categoryId=1');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Espresso');
  });
});

describe('GET /api/public/products/featured', () => {
  test('returns only featured + available products', async () => {
    const res = await callPublic('products/featured');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Espresso');
  });
});

describe('GET /api/public/products/seasonal', () => {
  test('returns only seasonal + available products', async () => {
    const res = await callPublic('products/seasonal');
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].name).toBe('Muffin');
  });
});

describe('GET /api/public/products/:id', () => {
  test('returns product when available', async () => {
    const res = await callPublic('products/1');
    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe('Espresso');
  });

  test('returns 404 when product unavailable', async () => {
    // id 2 is available: false
    const res = await callPublic('products/2');
    expect(res.status).toBe(404);
  });

  test('returns 404 for nonexistent product', async () => {
    const res = await callPublic('products/999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/public/branches', () => {
  test('returns only active branches', async () => {
    const res = await callPublic('branches');
    expect(res.status).toBe(200);
    expect(res.body.branches).toHaveLength(1);
    expect(res.body.branches[0].name).toBe('Main');
  });
});

describe('GET /api/public/categories', () => {
  test('returns all categories', async () => {
    const res = await callPublic('categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(2);
  });
});

describe('GET /api/public/faq', () => {
  test('returns all FAQs', async () => {
    const res = await callPublic('faq');
    expect(res.status).toBe(200);
    expect(res.body.faqs).toHaveLength(2);
  });
});

describe('GET /api/public/settings', () => {
  test('returns only whitelisted settings keys', async () => {
    const res = await callPublic('settings');
    expect(res.status).toBe(200);
    const keys = Object.keys(res.body.settings as Record<string, unknown>);
    expect(keys).toContain('about');
    expect(keys).toContain('price_unit');
    expect(keys).toContain('instagram');
    expect(keys).toContain('welcome_message');
    expect(keys).toContain('vat_note');
    expect(keys).not.toContain('secret_admin');
  });
});

describe('GET /api/public (unknown path)', () => {
  test('returns 404 for unknown endpoints', async () => {
    const res = await callPublic('nonexistent');
    expect(res.status).toBe(404);
  });

  test('returns 405 for POST requests', async () => {
    const { handlePublicApiRequest } = await import('../api/public');
    const url = 'https://bot.test/api/public/products';
    const request = new Request(url, { method: 'POST' });
    const env = { TELEGRAM_BOT_TOKEN: 'test', SECRET_TOKEN: 'test', DB: {} as any, CACHE: undefined as any, OPENCODE_API_KEY: 'test' };
    const ctx = {} as ExecutionContext;
    const response = await handlePublicApiRequest(request, env, ctx);
    expect(response.status).toBe(405);
  });
});
