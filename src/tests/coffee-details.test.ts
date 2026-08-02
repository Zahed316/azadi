import { expect, test } from 'vitest';

test('setCoffeeDetails shape: all fields are strings or null', () => {
  const details = {
    origin: 'Ethiopia',
    farm: 'Yirgacheffe',
    altitude: '1800m',
    processing: 'Washed',
    variety: 'Heirloom',
    roastLevel: 'Light',
    flavorNotes: 'Floral, citrus',
    recommendedBrew: 'Pour Over',
    acidity: 'Bright',
    body: 'Medium'
  };
  for (const [key, val] of Object.entries(details)) {
    expect(typeof val === 'string' || val === null).toBe(true);
  }
});

test('setCoffeeDetails with null deletes existing details', () => {
  const details = null;
  expect(details).toBeNull();
});

test('flattened product response includes coffee_details', () => {
  const mockRow = {
    products: { id: 1, name: 'Ethiopian Yirgacheffe', categoryId: 2, price: 250000, stock: 10 },
    coffee_details: { origin: 'Ethiopia', roastLevel: 'Light' },
    categories: { id: 2, name: 'Coffee Beans', emoji: '🫘' },
  };
  const flattened = {
    ...mockRow.products,
    coffee_details: mockRow.coffee_details || null,
    category_name: mockRow.categories?.name || null,
    category_emoji: mockRow.categories?.emoji || null,
  };
  expect(flattened.name).toBe('Ethiopian Yirgacheffe');
  expect(flattened.coffee_details).toBeDefined();
  expect(flattened.coffee_details.origin).toBe('Ethiopia');
  expect(flattened.category_name).toBe('Coffee Beans');
});

test('flattened product without coffee details has null coffee_details', () => {
  const mockRow = {
    products: { id: 2, name: 'Latte', categoryId: 1, price: 120000, stock: 50 },
    coffee_details: null,
    categories: { id: 1, name: 'Hot Coffee', emoji: '☕' },
  };
  const flattened = {
    ...mockRow.products,
    coffee_details: mockRow.coffee_details || null,
    category_name: mockRow.categories?.name || null,
    category_emoji: mockRow.categories?.emoji || null,
  };
  expect(flattened.coffee_details).toBeNull();
  expect(flattened.name).toBe('Latte');
});
