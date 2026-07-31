import { expect, test } from 'vitest';
import { formatProduct, formatBranch, formatFaq } from '../utils/formatters';

test('formatProduct formats correctly', () => {
  const product = {
    name: 'Espresso',
    description: 'Strong coffee',
    price: 35000,
    stock: 10,
    unit: 'cup'
  };
  const result = formatProduct(product);
  expect(result).toContain('<b>Espresso</b>');
  expect(result).toContain('Strong coffee');
  expect(result).toContain('35000 Tomans');
  expect(result).toContain('10 cup');
});

test('formatBranch formats correctly', () => {
  const branch = {
    name: 'Main Branch',
    address: '123 Coffee St',
    phone: '555-1234',
    openingHours: '8am - 8pm'
  };
  const result = formatBranch(branch);
  expect(result).toContain('<b>Main Branch</b>');
  expect(result).toContain('123 Coffee St');
  expect(result).toContain('555-1234');
});

test('formatFaq formats correctly', () => {
  const faq = {
    question: 'What are your hours?',
    answer: 'We are open 8am to 8pm.'
  };
  const result = formatFaq(faq);
  expect(result).toContain('<b>What are your hours?</b>');
  expect(result).toContain('We are open 8am to 8pm.');
});
