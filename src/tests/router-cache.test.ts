/**
 * Cache invalidation tests for admin mutation endpoints.
 *
 * Verifies that each mutation handler calls the correct cache
 * deletion method via CacheService (which wraps the KV binding).
 *
 * Strategy: spy on CacheService.prototype methods so we intercept
 * calls at the CacheService level (where handlers actually call them),
 * regardless of the KV mock's internal behavior.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { callRouter, seedTable, clearStore, resetAuthDefaults } from './_helpers/routerHarness';
import { faq, menuConfig, settings, categories } from '../database/schema';
import { CacheService } from '../services/cache';

// ---------------------------------------------------------------------------
// Spy on CacheService prototype — captures all calls from any instance
// ---------------------------------------------------------------------------

const spiedDelete = vi.spyOn(CacheService.prototype, 'delete');
const spiedDeleteByPrefix = vi.spyOn(CacheService.prototype, 'deleteByPrefix');

/** A minimal KV mock that satisfies the CacheService constructor. */
const stubKV = {
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
  getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
} as any;

function resetCacheTracking() {
  spiedDelete.mockClear();
  spiedDeleteByPrefix.mockClear();
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearStore();
  resetAuthDefaults();
  resetCacheTracking();
});

// ---------------------------------------------------------------------------
// FAQ mutations
// ---------------------------------------------------------------------------

describe('FAQ cache invalidation', () => {
  test('POST /faqs deletes cache:faq:all', async () => {
    const res = await callRouter({
      method: 'POST',
      path: 'faqs',
      body: { question: 'Test?', answer: 'Yes' },
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(201);
    expect(spiedDelete).toHaveBeenCalledWith('cache:faq:all');
  });

  test('PUT /faqs/:id deletes cache:faq:all', async () => {
    seedTable(faq, [{ id: 1, question: 'Old?', answer: 'No' }]);
    const res = await callRouter({
      method: 'PUT',
      path: 'faqs/1',
      body: { question: 'Updated?', answer: 'Yes' },
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(200);
    expect(spiedDelete).toHaveBeenCalledWith('cache:faq:all');
  });

  test('DELETE /faqs/:id deletes cache:faq:all', async () => {
    seedTable(faq, [{ id: 1, question: 'Q?', answer: 'A' }]);
    const res = await callRouter({
      method: 'DELETE',
      path: 'faqs/1',
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(204);
    expect(spiedDelete).toHaveBeenCalledWith('cache:faq:all');
  });
});

// ---------------------------------------------------------------------------
// Menu-config mutations
// ---------------------------------------------------------------------------

describe('Menu-config cache invalidation', () => {
  test('POST /menu-config deletes cache:menu: prefix and cache:visible-categories', async () => {
    seedTable(categories, [{ id: 1, name: 'Drinks', emoji: '☕', sortOrder: 0 }]);
    const res = await callRouter({
      method: 'POST',
      path: 'menu-config',
      body: { categoryId: 1, section: 'drinks', displayOrder: 0, isVisible: true },
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(201);
    expect(spiedDeleteByPrefix).toHaveBeenCalledWith('cache:menu:');
    expect(spiedDelete).toHaveBeenCalledWith('cache:visible-categories');
  });

  test('DELETE /menu-config/:id deletes cache:menu: prefix and cache:visible-categories', async () => {
    seedTable(menuConfig, [
      {
        id: 1,
        categoryId: 1,
        section: 'drinks',
        displayOrder: 0,
        isVisible: true,
        buttonLabel: null,
        categoryName: null,
        categoryEmoji: null,
        specialMessage: null,
      },
    ]);
    const res = await callRouter({
      method: 'DELETE',
      path: 'menu-config/1',
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(204);
    expect(spiedDeleteByPrefix).toHaveBeenCalledWith('cache:menu:');
    expect(spiedDelete).toHaveBeenCalledWith('cache:visible-categories');
  });
});

// ---------------------------------------------------------------------------
// Settings mutations
// ---------------------------------------------------------------------------

describe('Settings cache invalidation', () => {
  test('POST /settings (bulk) deletes cache:settings: prefix', async () => {
    const res = await callRouter({
      method: 'POST',
      path: 'settings',
      body: { settings: [{ key: 'about', value: 'Test' }] },
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(201);
    expect(spiedDeleteByPrefix).toHaveBeenCalledWith('cache:settings:');
  });

  test('PUT /settings/:key deletes cache:settings: prefix', async () => {
    seedTable(settings, [{ key: 'about', value: 'Old' }]);
    const res = await callRouter({
      method: 'PUT',
      path: 'settings/about',
      body: { value: 'New' },
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(200);
    expect(spiedDeleteByPrefix).toHaveBeenCalledWith('cache:settings:');
  });

  test('DELETE /settings/:key deletes cache:settings: prefix', async () => {
    seedTable(settings, [{ key: 'about', value: 'Test' }]);
    const res = await callRouter({
      method: 'DELETE',
      path: 'settings/about',
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(204);
    expect(spiedDeleteByPrefix).toHaveBeenCalledWith('cache:settings:');
  });
});

// ---------------------------------------------------------------------------
// Categories mutations — should also invalidate cache:settings:categories
// ---------------------------------------------------------------------------

describe('Categories cache invalidation', () => {
  test('POST /categories deletes cache:menu: prefix, cache:visible-categories, and cache:settings:categories', async () => {
    const res = await callRouter({
      method: 'POST',
      path: 'categories',
      body: { name: 'New', emoji: '☕' },
      env: { CACHE: stubKV },
    });
    expect(res.status).toBe(201);
    expect(spiedDeleteByPrefix).toHaveBeenCalledWith('cache:menu:');
    expect(spiedDelete).toHaveBeenCalledWith('cache:visible-categories');
    expect(spiedDelete).toHaveBeenCalledWith('cache:settings:categories');
  });
});
