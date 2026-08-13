import { expect, test } from 'vitest';
import { formatProduct, formatBranch, formatFaq } from '../utils/formatters';
import { LRI, PDI } from '../utils/numbers';
import { products, branches, faq } from '../database/schema';

type ProductRow = typeof products.$inferSelect;
type BranchRow = typeof branches.$inferSelect;
type FaqRow = typeof faq.$inferSelect;

const NOW = new Date();

function makeProduct(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: 1,
    branchId: null,
    categoryId: 1,
    name: '',
    description: null,
    price: null,
    stock: 0,
    unit: 'item',
    imageUrl: null,
    available: true,
    featured: false,
    priceOnRequest: false,
    isSeasonal: false,
    sizeOptions: null,
    syrupOptions: null,
    calories: null,
    allergens: null,
    caffeineMg: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeBranch(overrides: Partial<BranchRow>): BranchRow {
  return {
    id: 1,
    name: '',
    address: '',
    phone: null,
    location: null,
    openingHours: null,
    isActive: true,
    ...overrides,
  };
}

function makeFaq(overrides: Partial<FaqRow>): FaqRow {
  return {
    id: 1,
    question: '',
    answer: '',
    ...overrides,
  };
}

test('formatProduct formats correctly', () => {
  const product = makeProduct({
    name: 'Espresso',
    description: 'Strong coffee',
    price: 35000,
    stock: 10,
    unit: 'cup',
  });
  const result = formatProduct(product);
  expect(result).toContain('<b>Espresso</b>');
  expect(result).toContain('Strong coffee');
  expect(result).toContain(`${LRI}۳۵٬۰۰۰ تومان${PDI}`);
  expect(result).not.toContain('10 فنجان');
});

test('formatProduct honors a custom price unit', () => {
  const product = makeProduct({ name: 'Latte', price: 90000, stock: 1, unit: 'cup' });
  expect(formatProduct(product, 'ریال')).toContain(`${LRI}۹۰٬۰۰۰ ریال${PDI}`);
});

test('formatProduct shows price-on-request label', () => {
  const product = makeProduct({
    name: 'Special',
    price: 0,
    priceOnRequest: true,
    stock: 1,
    unit: 'cup',
  });
  expect(formatProduct(product)).toContain('سوال در کافه');
});

test('formatProduct formats physical goods with stock', () => {
  const product = makeProduct({
    name: 'Coffee Beans',
    description: 'Arabica',
    price: 500000,
    stock: 2,
    unit: 'kg',
  });
  const result = formatProduct(product);
  expect(result).toContain('۲ کیلوگرم');
});

test('formatProduct localizes gram unit', () => {
  const product = makeProduct({
    name: 'Ground Coffee',
    price: 150000,
    stock: 300,
    unit: 'g',
  });
  const result = formatProduct(product);
  expect(result).toContain('۳۰۰ گرم');
});
test('formatBranch formats correctly', () => {
  const branch = makeBranch({
    name: 'Main Branch',
    address: '123 Coffee St',
    phone: '555-1234',
    openingHours: '8am - 8pm',
  });
  const result = formatBranch(branch);
  expect(result).toContain('<b>Main Branch</b>');
  expect(result).toContain('123 Coffee St');
  expect(result).toContain('555-1234');
});

test('formatProduct shows calories when present', () => {
  const product = makeProduct({
    name: 'Espresso',
    price: 35000,
    stock: 10,
    unit: 'cup',
    calories: 5,
  });
  const result = formatProduct(product);
  expect(result).toContain('۵ کالری');
});

test('formatProduct shows caffeine when present', () => {
  const product = makeProduct({
    name: 'Espresso',
    price: 35000,
    stock: 10,
    unit: 'cup',
    caffeineMg: 63,
  });
  const result = formatProduct(product);
  expect(result).toContain('۶۳ میلی‌گرم');
});

test('formatProduct shows allergens when present', () => {
  const product = makeProduct({
    name: 'Latte',
    price: 45000,
    stock: 10,
    unit: 'cup',
    allergens: 'milk',
  });
  const result = formatProduct(product);
  expect(result).toContain('milk');
});

test('formatProduct hides nutritional fields when null', () => {
  const product = makeProduct({ name: 'Espresso', price: 35000, stock: 10, unit: 'cup' });
  const result = formatProduct(product);
  expect(result).not.toContain('کالری');
  expect(result).not.toContain('کافئین');
  expect(result).not.toContain('آلرژن');
});

test('formatFaq formats correctly', () => {
  const faqRow = makeFaq({
    question: 'What are your hours?',
    answer: 'We are open 8am to 8pm.',
  });
  const result = formatFaq(faqRow);
  expect(result).toContain('<b>What are your hours?</b>');
  expect(result).toContain('We are open 8am to 8pm.');
});
