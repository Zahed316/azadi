import { expect, test } from 'vitest';
import { buildMinimalContext, type ProductWithDetails } from '../utils/menuContext';

const mockProducts: ProductWithDetails[] = [
  {
    products: {
      id: 1,
      name: 'Espresso',
      categoryId: 1,
      price: 50000,
      description: 'Strong',
      stock: 10,
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
    },
    coffee_details: null,
    categories: { id: 1, name: 'Hot Coffee', description: null, emoji: null, sortOrder: 0 },
  },
  {
    products: {
      id: 2,
      name: 'Latte',
      categoryId: 2,
      price: 60000,
      description: 'Mild',
      stock: 5,
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
    },
    coffee_details: null,
    categories: { id: 2, name: 'Cold Coffee', description: null, emoji: null, sortOrder: 0 },
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
  const productsWithNullCat: ProductWithDetails[] = [
    {
      products: {
        id: 3,
        name: 'Mocha',
        categoryId: 1,
        price: 55000,
        description: 'Sweet',
        stock: 3,
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
      },
      coffee_details: null,
      categories: null,
    },
  ];
  const ctx = buildMinimalContext('mocha', productsWithNullCat, [], []);
  expect(ctx).toContain('Mocha');
  expect(ctx).toContain('Cat#1');
});

test('includes about section when settings provided', () => {
  const ctx = buildMinimalContext({
    query: 'espresso',
    productsWithDetails: mockProducts,
    branches: [],
    faqs: [],
    settings: { about: 'We roast our own beans daily in Iranshahr.' },
  });
  expect(ctx).toContain('ABOUT AZADI COFFEE ROASTERY');
  expect(ctx).toContain('We roast our own beans daily');
});

test('omits about section when settings not provided', () => {
  const ctx = buildMinimalContext('espresso', mockProducts, [], []);
  expect(ctx).not.toContain('ABOUT AZADI COFFEE ROASTERY');
});

test('includes popular products section', () => {
  const ctx = buildMinimalContext({
    query: 'coffee',
    productsWithDetails: mockProducts,
    branches: [],
    faqs: [],
    popularProducts: [
      { name: 'Espresso', category: 'Hot Coffee', favoritedCount: 12 },
      { name: 'Latte', category: 'Cold Coffee', favoritedCount: 8 },
    ],
  });
  expect(ctx).toContain('POPULAR ITEMS');
  expect(ctx).toContain('Espresso');
  expect(ctx).toContain('12 favorites');
});

test('omits popular products when array is empty', () => {
  const ctx = buildMinimalContext({
    query: 'coffee',
    productsWithDetails: mockProducts,
    branches: [],
    faqs: [],
    popularProducts: [],
  });
  expect(ctx).not.toContain('POPULAR ITEMS');
});

test('includes coffee details when present', () => {
  const productsWithDetails: ProductWithDetails[] = [
    {
      products: {
        id: 1,
        name: 'Ethiopian Yirgacheffe',
        categoryId: 1,
        price: 80000,
        description: 'Floral',
        stock: 5,
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
      },
      coffee_details: {
        productId: 1,
        origin: 'Ethiopia',
        farm: 'Kochere',
        altitude: '1,800m',
        processing: 'Washed',
        variety: 'Heirloom',
        roastLevel: 'Light',
        flavorNotes: 'Jasmine, citrus',
        recommendedBrew: null,
        acidity: null,
        body: null,
        brewGuide: null,
      },
      categories: { id: 1, name: 'Beans', description: null, emoji: null, sortOrder: 0 },
    },
  ];
  const ctx = buildMinimalContext('ethiopian', productsWithDetails, [], []);
  expect(ctx).toContain('Origin: Ethiopia');
  expect(ctx).toContain('Farm: Kochere');
  expect(ctx).toContain('Altitude: 1,800m');
  expect(ctx).toContain('Notes: Jasmine, citrus');
});

test('includes nutritional info when present', () => {
  const productsWithNutrition: ProductWithDetails[] = [
    {
      products: {
        id: 1,
        name: 'Latte',
        categoryId: 1,
        price: 55000,
        description: '',
        stock: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        branchId: null,
        unit: 'cup',
        available: true,
        featured: false,
        isSeasonal: false,
        imageUrl: null,
        priceOnRequest: false,
        calories: 120,
        caffeineMg: 63,
        allergens: 'milk',
        sizeOptions: null,
        syrupOptions: null,
      },
      coffee_details: null,
      categories: { id: 1, name: 'Drinks', description: null, emoji: null, sortOrder: 0 },
    },
  ];
  const ctx = buildMinimalContext('latte', productsWithNutrition, [], []);
  expect(ctx).toContain('Cal: 120');
  expect(ctx).toContain('Caffeine: 63mg');
  expect(ctx).toContain('Allergens: milk');
});
