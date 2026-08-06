import { expect, test } from 'vitest';

test('getVisibleCategoryIds returns a Set of numbers', () => {
  const mockRows = [{ categoryId: 1 }, { categoryId: 3 }, { categoryId: 5 }];
  const visibleIds = new Set(mockRows.map((r) => r.categoryId));

  expect(visibleIds).toBeInstanceOf(Set);
  expect(visibleIds.has(1)).toBe(true);
  expect(visibleIds.has(3)).toBe(true);
  expect(visibleIds.has(2)).toBe(false);
});

test('getVisibleCategoryIds handles empty result', () => {
  const mockRows: { categoryId: number }[] = [];
  const visibleIds = new Set(mockRows.map((r) => r.categoryId));

  expect(visibleIds.size).toBe(0);
});
