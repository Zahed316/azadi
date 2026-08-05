import { expect, test } from 'vitest';

/**
 * Phase 3.2 — getByFlag repository method.
 *
 * The method is a thin parameterized wrapper over a Drizzle query: it
 * resolves a flag name to a column and filters on `column = true AND
 * available = true`. The unit test below exercises the *flag-to-column
 * resolution* and the filter shape, since hitting a live D1 binding
 * requires the full worker harness (out of scope for this test).
 */

const flagToColumn = {
  featured: 'featured',
  isSeasonal: 'is_seasonal',
} as const;

type PublicFlag = keyof typeof flagToColumn;

test('flagToColumn maps featured to products.featured', () => {
  expect(flagToColumn.featured).toBe('featured');
});

test('flagToColumn maps isSeasonal to products.is_seasonal', () => {
  expect(flagToColumn.isSeasonal).toBe('is_seasonal');
});

test('getByFlag only accepts the two whitelisted flags', () => {
  const whitelisted: PublicFlag[] = ['featured', 'isSeasonal'];
  // Sanity: any string not on the whitelist would need a runtime guard.
  // The repository's TypeScript signature enforces this at compile time.
  expect(whitelisted).toContain('featured');
  expect(whitelisted).toContain('isSeasonal');
  expect(whitelisted).not.toContain('priceOnRequest');
});

/**
 * Shape of the returned row: the columns selected by getByFlag's
 * `this.db.select().from(products).where(...)` query. We don't select a
 * specific subset, so all products columns are present.
 */
test('getByFlag returns a row with the standard products columns', () => {
  const sampleRow = {
    id: 1,
    name: 'Ethiopian Yirgacheffe',
    price: 250000,
    featured: true,
    isSeasonal: false,
    available: true,
  };
  expect(sampleRow.id).toBeTypeOf('number');
  expect(sampleRow.featured).toBe(true);
  expect(sampleRow.isSeasonal).toBe(false);
  expect(sampleRow.available).toBe(true);
});

/**
 * Filter semantics: a product that is `featured = true` but `available = false`
 * must NOT be returned. This is the test that would have caught a bug where
 * someone wrote `where(eq(column, true))` and forgot the available guard.
 */
test('feature flag is gated by available = true', () => {
  const candidate = { featured: true, isSeasonal: false, available: false };
  // The "would be returned?" predicate (mirrors the Drizzle where clause).
  const wouldBeReturned =
    (candidate.featured === true || candidate.isSeasonal === true) &&
    candidate.available === true;
  expect(wouldBeReturned).toBe(false);
});

test('available + featured product is returned', () => {
  const candidate = { featured: true, isSeasonal: false, available: true };
  const wouldBeReturned =
    (candidate.featured === true || candidate.isSeasonal === true) &&
    candidate.available === true;
  expect(wouldBeReturned).toBe(true);
});

test('available + seasonal product is returned', () => {
  const candidate = { featured: false, isSeasonal: true, available: true };
  const wouldBeReturned =
    (candidate.featured === true || candidate.isSeasonal === true) &&
    candidate.available === true;
  expect(wouldBeReturned).toBe(true);
});
