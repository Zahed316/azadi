import { expect, test } from 'vitest';
import { buildMinimalContext } from '../utils/menuContext';

test('ranking remains deterministic for equal scores', () => {
  const rows = [
    { products: { name: 'Alpha', description: 'coffee', categoryId: 1, price: 1, stock: 1 }, coffee_details: null, categories: null },
    { products: { name: 'Beta', description: 'coffee', categoryId: 1, price: 1, stock: 1 }, coffee_details: null, categories: null },
  ];
  const first = buildMinimalContext('coffee', rows, [], []);
  expect(first).toBe(buildMinimalContext('coffee', rows, [], []));
  expect(first.indexOf('Alpha')).toBeLessThan(first.indexOf('Beta'));
});

test('large catalogs produce a bounded product section', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ products: { name: `Coffee ${i}`, description: 'coffee', categoryId: 1, price: i, stock: 1 }, coffee_details: null, categories: null }));
  expect((buildMinimalContext('coffee', rows, [], []).match(/^- Coffee /gm) || []).length).toBe(5);
});