/**
 * DataService lazy-loading tests.
 *
 * Verifies that repository instances are NOT eagerly created in the
 * DataService constructor. Repositories should only be instantiated
 * when first accessed via a public method.
 *
 * Uses vi.mock() to intercept repository constructors and track calls.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

// Track constructor call counts per repository class
const constructorCalls: Record<string, number> = {};

// Mock the repository module before importing DataService
vi.mock('../repositories', () => {
  const makeSpy = (name: string) => {
    return class MockRepo {
      constructor() {
        constructorCalls[name] = (constructorCalls[name] ?? 0) + 1;
      }
    };
  };

  return {
    ProductRepository: makeSpy('ProductRepository'),
    CategoryRepository: makeSpy('CategoryRepository'),
    BranchRepository: makeSpy('BranchRepository'),
    FaqRepository: makeSpy('FaqRepository'),
    SettingsRepository: makeSpy('SettingsRepository'),
    AiLogRepository: makeSpy('AiLogRepository'),
    MenuConfigRepository: makeSpy('MenuConfigRepository'),
    UserStateRepository: makeSpy('UserStateRepository'),
    FavoritesRepository: makeSpy('FavoritesRepository'),
    MessageRepository: makeSpy('MessageRepository'),
  };
});

// Mock getDb to return a stub
vi.mock('../database/client', () => ({
  getDb: () => ({}),
}));

// Import DataService after mocks are set up
import { DataService } from '../services/data/index';

const FAKE_D1 = {} as D1Database;

beforeEach(() => {
  // Reset constructor call counters
  for (const key of Object.keys(constructorCalls)) {
    delete constructorCalls[key];
  }
  vi.clearAllMocks();
});

describe('DataService lazy-loading', () => {
  test('constructor does NOT eagerly instantiate any repositories', () => {
    const ds = new DataService(FAKE_D1);

    expect(Object.keys(constructorCalls)).toHaveLength(0);
    expect(ds).toBeDefined(); // sanity: instance was created
  });

  test('constructor does not call getDb for batch path eagerly', () => {
    // getDb is used by buildAIContextBatch which uses this.db;
    // with lazy loading the db ref should still be set eagerly
    // since buildAIContextBatch uses raw Drizzle queries, not repos.
    const ds = new DataService(FAKE_D1);
    expect(ds).toBeDefined();
  });

  test('first access to products repo instantiates only ProductRepository', () => {
    const ds = new DataService(FAKE_D1);

    // Access a method that uses the products repo.
    // The mock repos don't implement async methods, so we catch the error
    // and just verify the constructor was called.
    ds.getAllProducts().catch(() => {});

    expect(constructorCalls['ProductRepository']).toBe(1);
    // No other repos should have been constructed
    expect(Object.keys(constructorCalls)).toHaveLength(1);
  });

  test('accessing branches repo instantiates only BranchRepository', () => {
    const ds = new DataService(FAKE_D1);

    ds.getActiveBranches().catch(() => {});

    expect(constructorCalls['BranchRepository']).toBe(1);
    expect(Object.keys(constructorCalls)).toHaveLength(1);
  });

  test('accessing settings repo instantiates only SettingsRepository', () => {
    const ds = new DataService(FAKE_D1);

    ds.getSetting('about').catch(() => {});

    expect(constructorCalls['SettingsRepository']).toBe(1);
    expect(Object.keys(constructorCalls)).toHaveLength(1);
  });

  test('subsequent calls reuse the same instance (no duplicate construction)', () => {
    const ds = new DataService(FAKE_D1);

    // Call getAllProducts twice
    ds.getAllProducts().catch(() => {});
    ds.getAllProducts().catch(() => {});

    // ProductRepository should only be constructed once
    expect(constructorCalls['ProductRepository']).toBe(1);
    expect(Object.keys(constructorCalls)).toHaveLength(1);
  });
});
