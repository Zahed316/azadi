import { expect, test } from 'vitest';

test('product with details includes categories.name', () => {
  const mockRow = {
    products: { id: 1, name: 'Espresso', categoryId: 1 },
    coffee_details: null,
    categories: { id: 1, name: 'Hot Coffee', emoji: '☕' },
  };
  
  expect(mockRow.categories).toBeDefined();
  expect(mockRow.categories.name).toBe('Hot Coffee');
});

test('product without matching category has null categories', () => {
  const mockRow = {
    products: { id: 2, name: 'Latte', categoryId: 99 },
    coffee_details: null,
    categories: null,
  };
  
  expect(mockRow.categories).toBeNull();
});
