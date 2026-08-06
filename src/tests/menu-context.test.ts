import { expect, test } from 'vitest';
import { buildMinimalContext } from '../utils/menuContext';

const mockProducts = [
  {
    products: {
      id: 1,
      name: 'Espresso',
      categoryId: 1,
      price: 50000,
      description: 'Strong',
      stock: 10,
    },
    coffee_details: null,
    categories: { name: 'Hot Coffee' },
  },
  {
    products: { id: 2, name: 'Latte', categoryId: 2, price: 60000, description: 'Mild', stock: 5 },
    coffee_details: null,
    categories: { name: 'Cold Coffee' },
  },
];

test('excludes products from hidden categories', () => {
  const visibleCategoryIds = new Set([1]);
  const ctx = buildMinimalContext('coffee', mockProducts, [], [], visibleCategoryIds);
  expect(ctx).toContain('Espresso');
  expect(ctx).not.toContain('Latte');
});

test('includes all products when no filter provided', () => {
  const ctx = buildMinimalContext('coffee', mockProducts, [], []);
  expect(ctx).toContain('Espresso');
  expect(ctx).toContain('Latte');
});

test('uses category name instead of category ID', () => {
  const ctx = buildMinimalContext('coffee', mockProducts, [], []);
  expect(ctx).toContain('Hot Coffee');
  expect(ctx).not.toMatch(/Cat: \d/);
});

test('handles null categories gracefully', () => {
  const productsWithNullCat = [
    {
      products: {
        id: 3,
        name: 'Mocha',
        categoryId: 1,
        price: 55000,
        description: 'Sweet',
        stock: 3,
      },
      coffee_details: null,
      categories: null,
    },
  ];
  const ctx = buildMinimalContext('mocha', productsWithNullCat, [], []);
  expect(ctx).toContain('Mocha');
  expect(ctx).toContain('Cat#1');
});
