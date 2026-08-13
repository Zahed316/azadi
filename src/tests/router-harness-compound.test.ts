/**
 * Tests for compound predicate support in the router harness.
 *
 * The harness's extractEq() currently only handles eq() and inArray.
 * These tests verify that and/or/gt/lt/gte/lte predicates work correctly
 * by going through the FakeDb's where() method.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { eq, and, or, gt, lt, gte, lte } from 'drizzle-orm';
import { seedTable, readTable, clearStore } from './_helpers/routerHarness';

// We need a fake table to test with. The harness uses tableNameOf() to get
// the table name, so we need a table-like object with the drizzle symbol.
const fakeTable = {
  [Symbol.for('drizzle:Name')]: 'products',
  id: { name: 'id' },
  name: { name: 'name' },
  stock: { name: 'stock' },
  price: { name: 'price' },
};

// Import the harness's FakeDb via the mocked getDb to test where() end-to-end
let fakeDb: any;
beforeEach(async () => {
  clearStore();
  // Import fresh so vi.mock from routerHarness is applied
  const mod = await import('../database/client');
  fakeDb = (mod as any).getDb();
});

describe('extractEq compound predicate support', () => {
  test('single eq() via where() still works', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
    ]);

    const rows = await fakeDb.select().from(fakeTable).where(eq(fakeTable.name, 'Espresso'));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
  });

  test('and(eq, eq) via where() extracts both conditions', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
      { id: 3, name: 'Mocha', stock: 10, price: 70000 },
    ]);

    const rows = await fakeDb
      .select()
      .from(fakeTable)
      .where(and(eq(fakeTable.name, 'Espresso'), eq(fakeTable.stock, 10)));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
  });

  test('or(eq, eq) via where() extracts both conditions', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
      { id: 3, name: 'Mocha', stock: 3, price: 70000 },
    ]);

    const rows = await fakeDb
      .select()
      .from(fakeTable)
      .where(or(eq(fakeTable.name, 'Espresso'), eq(fakeTable.name, 'Latte')));

    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.id)).toEqual([1, 2]);
  });

  test('gt(column, value) via where() extracts comparison', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
      { id: 3, name: 'Mocha', stock: 3, price: 70000 },
    ]);

    const rows = await fakeDb.select().from(fakeTable).where(gt(fakeTable.stock, 4));

    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.id)).toEqual([1, 2]);
  });

  test('lt(column, value) via where() extracts comparison', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
      { id: 3, name: 'Mocha', stock: 3, price: 70000 },
    ]);

    const rows = await fakeDb.select().from(fakeTable).where(lt(fakeTable.stock, 5));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(3);
  });

  test('gte(column, value) via where() extracts comparison', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
      { id: 3, name: 'Mocha', stock: 3, price: 70000 },
    ]);

    const rows = await fakeDb.select().from(fakeTable).where(gte(fakeTable.stock, 5));

    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.id)).toEqual([1, 2]);
  });

  test('lte(column, value) via where() extracts comparison', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
      { id: 3, name: 'Mocha', stock: 3, price: 70000 },
    ]);

    const rows = await fakeDb.select().from(fakeTable).where(lte(fakeTable.stock, 5));

    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.id)).toEqual([2, 3]);
  });

  test('and(eq, gt) via where() combines equality and comparison', async () => {
    seedTable(fakeTable, [
      { id: 1, name: 'Espresso', stock: 10, price: 50000 },
      { id: 2, name: 'Latte', stock: 5, price: 60000 },
      { id: 3, name: 'Mocha', stock: 10, price: 70000 },
    ]);

    // name === 'Espresso' AND stock > 8
    const rows = await fakeDb
      .select()
      .from(fakeTable)
      .where(and(eq(fakeTable.name, 'Espresso'), gt(fakeTable.stock, 8)));

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
  });
});
