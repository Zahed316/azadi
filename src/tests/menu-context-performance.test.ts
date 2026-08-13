import { expect, test } from 'vitest';
import { buildMinimalContext, type ProductWithDetails } from '../utils/menuContext';

const baseProduct = {
  createdAt: new Date(),
  updatedAt: new Date(),
  branchId: null,
  unit: 'item',
  available: true,
  featured: false,
  isSeasonal: false,
  imageUrl: null,
  priceOnRequest: false,
  calories: null,
  caffeineMg: null,
  allergens: null,
  sizeOptions: null,
  syrupOptions: null,
};

test('ranking remains deterministic for equal scores', () => {
  const rows: ProductWithDetails[] = [
    {
      products: {
        ...baseProduct,
        id: 1,
        name: 'Alpha',
        description: 'coffee',
        categoryId: 1,
        price: 1,
        stock: 1,
      },
      coffee_details: null,
      categories: null,
    },
    {
      products: {
        ...baseProduct,
        id: 2,
        name: 'Beta',
        description: 'coffee',
        categoryId: 1,
        price: 1,
        stock: 1,
      },
      coffee_details: null,
      categories: null,
    },
  ];
  const first = buildMinimalContext('coffee', rows, [], []);
  expect(first).toBe(buildMinimalContext('coffee', rows, [], []));
  expect(first.indexOf('Alpha')).toBeLessThan(first.indexOf('Beta'));
});

test('large catalogs produce a bounded product section', () => {
  const rows: ProductWithDetails[] = Array.from({ length: 1000 }, (_, i) => ({
    products: {
      ...baseProduct,
      id: i,
      name: `Coffee ${i}`,
      description: 'coffee',
      categoryId: 1,
      price: i,
      stock: 1,
    },
    coffee_details: null,
    categories: null,
  }));
  expect((buildMinimalContext('coffee', rows, [], []).match(/^- Coffee /gm) || []).length).toBe(8);
});
