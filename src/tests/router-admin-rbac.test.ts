/**
 * RBAC (role-based access control) tests for src/api/router.ts.
 * Covers admins, settings, categories, menu-config, faqs, and branches routes.
 */
import { expect, test, beforeEach } from 'vitest';
import { callRouter, setAdminRole, resetAuthDefaults, clearStore } from './_helpers/routerHarness';

beforeEach(() => {
  resetAuthDefaults();
  clearStore();
});

const superAdmin = { telegramId: 1, role: 'super_admin', categoryId: null };
const categoryAdmin = { telegramId: 2, role: 'category_admin', categoryId: 5 };

// ---------------------------------------------------------------------------
// GET /admins
// ---------------------------------------------------------------------------

test('super_admin can list admins', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({ method: 'GET', path: 'admins' });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.admins)).toBe(true);
});

test('category_admin is blocked from listing admins', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({ method: 'GET', path: 'admins' });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

// ---------------------------------------------------------------------------
// POST /admins
// ---------------------------------------------------------------------------

test('super_admin can add an admin', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'admins',
    body: { telegramId: '99999', role: 'category_admin', categoryId: '3' },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

// ---------------------------------------------------------------------------
// POST /settings
// ---------------------------------------------------------------------------

test('category_admin is blocked from posting settings', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'settings',
    body: { settings: [{ key: 'about', value: 'Hello' }] },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

// ---------------------------------------------------------------------------
// DELETE /settings/:key
// ---------------------------------------------------------------------------

test('category_admin is blocked from deleting settings', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({ method: 'DELETE', path: 'settings/about' });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

// ---------------------------------------------------------------------------
// POST /categories
// ---------------------------------------------------------------------------

test('category_admin is blocked from creating categories', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'categories',
    body: { name: 'New', emoji: 'NEW' },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

// ---------------------------------------------------------------------------
// PUT /categories/:id
// ---------------------------------------------------------------------------

test('category_admin is blocked from updating categories', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({
    method: 'PUT',
    path: 'categories/1',
    body: { name: 'Updated' },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

// ---------------------------------------------------------------------------
// POST /menu-config
// ---------------------------------------------------------------------------

test('category_admin is blocked from creating menu config', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'menu-config',
    body: { categoryId: '5', menuSection: 'drinks' },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

// ---------------------------------------------------------------------------
// POST /menu-config/reorder
// ---------------------------------------------------------------------------

test('category_admin is blocked from reordering menu config', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'menu-config/reorder',
    body: { items: [{ id: 1, displayOrder: 0 }] },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

// ---------------------------------------------------------------------------
// POST /faqs
// ---------------------------------------------------------------------------

test('category_admin is blocked from creating FAQs', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'faqs',
    body: { question: 'Q?', answer: 'A.' },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

test('super_admin posting FAQ without question or answer returns 400', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'faqs',
    body: { question: '', answer: '' },
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/question and answer required/i);
});

test('super_admin posting FAQ with both fields returns 200', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'faqs',
    body: { question: 'What is coffee?', answer: 'A drink.' },
  });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

// ---------------------------------------------------------------------------
// POST /branches
// ---------------------------------------------------------------------------

test('category_admin is blocked from creating branches', async () => {
  setAdminRole(categoryAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'branches',
    body: { name: 'Branch', address: '123 St' },
  });
  expect(res.status).toBe(403);
  expect(res.body.error).toBe('Forbidden');
});

test('super_admin posting branch without name or address returns 400', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({
    method: 'POST',
    path: 'branches',
    body: { name: '', address: '' },
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/name and address required/i);
});

// ---------------------------------------------------------------------------
// DELETE /branches/:id
// ---------------------------------------------------------------------------

test('super_admin can delete a branch', async () => {
  setAdminRole(superAdmin);
  const res = await callRouter({ method: 'DELETE', path: 'branches/1' });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});
