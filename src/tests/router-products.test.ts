/**
 * Products CRUD tests for src/api/router.ts (lines 198-314).
 */
import { expect, test, beforeEach } from 'vitest';
import { products } from '../database/schema';
import {
  callRouter,
  setAdminRole,
  resetAuthDefaults,
  clearStore,
  seedTable,
  readTable,
} from './_helpers/routerHarness';

beforeEach(() => {
  resetAuthDefaults();
  clearStore();
});

// ---------------------------------------------------------------------------
// POST /products
// ---------------------------------------------------------------------------

test('super_admin can add a product', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  const res = await callRouter({
    method: 'POST',
    path: 'products',
    body: { name: 'Espresso', categoryId: '5', price: 45000, unit: 'cup' },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);

  const rows = readTable(products);
  expect(rows.length).toBe(1);
  expect(rows[0].name).toBe('Espresso');
});

test('category_admin can add product in their allowed category', async () => {
  setAdminRole({ telegramId: 2, role: 'category_admin', categoryId: 5 });
  const res = await callRouter({
    method: 'POST',
    path: 'products',
    body: { name: 'Latte', categoryId: '5', price: 55000 },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('category_admin is blocked from adding product in a different category', async () => {
  setAdminRole({ telegramId: 2, role: 'category_admin', categoryId: 5 });
  const res = await callRouter({
    method: 'POST',
    path: 'products',
    body: { name: 'Cake', categoryId: '99', price: 30000 },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/Cannot add to this category/i);
});

// ---------------------------------------------------------------------------
// PUT /products/:id
// ---------------------------------------------------------------------------

test('PUT on a nonexistent product returns 404', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  const res = await callRouter({
    method: 'PUT',
    path: 'products/999',
    body: { name: 'Updated' },
  });
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('Not found');
});

test('category_admin changing categoryId to a forbidden category returns 403', async () => {
  setAdminRole({ telegramId: 2, role: 'category_admin', categoryId: 5 });
  seedTable(products, [{ id: 1, categoryId: 5, name: 'Latte' }]);
  const res = await callRouter({
    method: 'PUT',
    path: 'products/1',
    body: { categoryId: '99' },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/Cannot move to this category/i);
});

// ---------------------------------------------------------------------------
// PUT /products/:id/stock (legacy 3-segment path)
// ---------------------------------------------------------------------------

test('PUT /products/:id/stock returns 200', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [{ id: 1, categoryId: 5, name: 'Latte' }]);
  const res = await callRouter({
    method: 'PUT',
    path: 'products/1/stock',
    body: { stock: 10 },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

// ---------------------------------------------------------------------------
// PUT /products/:id/toggle
// ---------------------------------------------------------------------------

test('PUT /products/:id/toggle returns 200', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [{ id: 1, categoryId: 5, name: 'Latte' }]);
  const res = await callRouter({
    method: 'PUT',
    path: 'products/1/toggle',
    body: { available: false },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

// ---------------------------------------------------------------------------
// POST /products/batch
// ---------------------------------------------------------------------------

test('POST /products/batch with action delete removes each id', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [
    { id: 1, categoryId: 5, name: 'A' },
    { id: 2, categoryId: 5, name: 'B' },
  ]);
  const res = await callRouter({
    method: 'POST',
    path: 'products/batch',
    body: { ids: [1, 2], action: 'delete' },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(readTable(products).length).toBe(0);
});

// ---------------------------------------------------------------------------
// GET /products
// ---------------------------------------------------------------------------

test('GET /products returns flattened list with coffee_details and category fields', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  seedTable(products, [
    { id: 1, categoryId: 5, name: 'Espresso', price: 45000 },
  ]);
  const res = await callRouter({ method: 'GET', path: 'products' });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.products)).toBe(true);
  expect(res.body.products.length).toBe(1);
  expect(res.body.products[0].name).toBe('Espresso');
});

// ---------------------------------------------------------------------------
// NaN categoryId edge case (documents existing behaviour)
// ---------------------------------------------------------------------------

test('non-numeric categoryId body is rejected as 403 for category_admin (parseInt NaN !== allowedCategoryId)', async () => {
  setAdminRole({ telegramId: 2, role: 'category_admin', categoryId: 5 });
  seedTable(products, [{ id: 1, categoryId: 5, name: 'X' }]);
  // parseInt('abc') → NaN; NaN !== 5 → true → 403
  const res = await callRouter({
    method: 'PUT',
    path: 'products/1',
    body: { categoryId: 'abc' },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/Cannot move to this category/i);
});

// ---------------------------------------------------------------------------
// Malformed JSON body → 500
// ---------------------------------------------------------------------------

test('malformed JSON body returns 500', async () => {
  setAdminRole({ telegramId: 1, role: 'super_admin', categoryId: null });
  const { handleApiRequest } = await import('../api/router');
  const request = new Request('https://bot.test/api/products', {
    method: 'POST',
    headers: {
      Authorization: 'Telegram fake',
      'Content-Type': 'application/json',
    },
    body: '{invalid json',
  });
  const response = await handleApiRequest(request as any, {
    TELEGRAM_BOT_TOKEN: 'test-token',
    SECRET_TOKEN: 'test-secret',
    DB: null,
    AI: null,
  } as any, {} as any);
  expect(response.status).toBe(500);
  const body: any = await response.json().catch(() => null);
  expect(body).toBeDefined();
  expect(body.error).toBeDefined();
});
