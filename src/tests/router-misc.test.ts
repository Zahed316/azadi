/**
 * Miscellaneous router edge-case tests for src/api/router.ts.
 * Covers currentUser, decodeURIComponent, 404, CORS preflight, and GET routes.
 */
import { expect, test, beforeEach } from 'vitest';
import {
  callRouter,
  setAdminRole,
  resetAuthDefaults,
  clearStore,
  seedTable,
} from './_helpers/routerHarness';
import { categories } from '../database/schema';

beforeEach(() => {
  resetAuthDefaults();
  clearStore();
});

const superAdmin = { telegramId: 1, role: 'super_admin', categoryId: null };

// ---------------------------------------------------------------------------
// GET /currentUser
// ---------------------------------------------------------------------------

test('GET /currentUser returns the admin role object', async () => {
  setAdminRole({ telegramId: 42, role: 'category_admin', categoryId: 7 });
  const res = await callRouter({ method: 'GET', path: 'currentUser' });
  expect(res.status).toBe(200);
  expect(res.body.user).toBeDefined();
  expect(res.body.user.telegramId).toBe(42);
  expect(res.body.user.role).toBe('category_admin');
  expect(res.body.user.categoryId).toBe(7);
});

// ---------------------------------------------------------------------------
// DELETE /settings/:key with URL-encoded keys
// ---------------------------------------------------------------------------

test('DELETE /settings/with%20space%20in%20key decodes the key via decodeURIComponent', async () => {
  setAdminRole(superAdmin);
  // The router does decodeURIComponent(path.split("/")[1])
  // "with%20space%20in%20key" → "with space in key"
  const res = await callRouter({
    method: 'DELETE',
    path: 'settings/with%20space%20in%20key',
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test('DELETE /settings with malformed percent-encoding returns 500', async () => {
  setAdminRole(superAdmin);
  // "%E0%A4%A" is an incomplete percent-encoded sequence
  // decodeURIComponent will throw URIError
  const res = await callRouter({
    method: 'DELETE',
    path: 'settings/%E0%A4%A',
  });
  expect(res.status).toBe(500);
  expect(res.body.error).toBeDefined();
});

// ---------------------------------------------------------------------------
// 404 for unknown routes
// ---------------------------------------------------------------------------

test('GET /nonexistent returns 404', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({ method: 'GET', path: 'nonexistent' });
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('Not found');
});

// ---------------------------------------------------------------------------
// OPTIONS preflight
// ---------------------------------------------------------------------------

test('OPTIONS /anything returns 200 with CORS headers but no Content-Type', async () => {
  // Note: new Response(null) defaults to 200, not 204. The router does not
  // explicitly set status: 204 on the OPTIONS response. This is existing behaviour.
  const { handleApiRequest } = await import('../api/router');
  const request = new Request('https://bot.test/api/anything', { method: 'OPTIONS' });
  const response = await handleApiRequest(
    request,
    {
      TELEGRAM_BOT_TOKEN: 'test',
      SECRET_TOKEN: 'test',
      DB: null as unknown as import('@cloudflare/workers-types').D1Database,
      AI: null,
      PRODUCT_IMAGES: null as unknown as import('@cloudflare/workers-types').R2Bucket,
    },
    {} as ExecutionContext,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(response.headers.get('Content-Type')).toBeNull();
});

// ---------------------------------------------------------------------------
// super_admin can GET all resource lists
// ---------------------------------------------------------------------------

test('super_admin GET /categories returns 200', async () => {
  setAdminRole(superAdmin);
  seedTable(categories, [{ id: 1, name: 'Beans', emoji: 'COF' }]);
  const res = await callRouter({ method: 'GET', path: 'categories' });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.categories)).toBe(true);
});

test('super_admin GET /faqs returns 200', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({ method: 'GET', path: 'faqs' });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.faqs)).toBe(true);
});

test('super_admin GET /branches returns 200', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({ method: 'GET', path: 'branches' });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.branches)).toBe(true);
});

test('super_admin GET /settings returns 200', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({ method: 'GET', path: 'settings' });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.settings)).toBe(true);
});

test('super_admin GET /menu-config returns 200', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({ method: 'GET', path: 'menu-config' });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.menuConfigs)).toBe(true);
});

// ---------------------------------------------------------------------------
// POST /menu-config with valid body returns 200 + menuConfig in response
// ---------------------------------------------------------------------------

test('super_admin POST /menu-config with valid body returns 200 and includes menuConfig', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'menu-config',
    body: {
      categoryId: '5',
      menuSection: 'drinks',
      displayOrder: 1,
      isVisible: true,
      buttonLabel: 'Coffee',
    },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.menuConfig).toBeDefined();
  expect(res.body.menuConfig.menuSection).toBe('drinks');
});
