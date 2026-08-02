import { expect, test } from 'vitest';
import { buildFaqPage } from '../utils/faqPagination';

const faqs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, question: `Q${i + 1}`, answer: `A${i + 1}` }));

test('first page has 5 items and only a next button', () => {
  const page = buildFaqPage(faqs, 0, 5);
  expect(page.items).toHaveLength(5);
  expect(page.hasNext).toBe(true);
  expect(page.hasPrev).toBe(false);
  expect(page.pageLabel).toBe('صفحه ۱');
});

test('middle page has both buttons', () => {
  const page = buildFaqPage(faqs, 1, 5);
  expect(page.hasNext).toBe(true);
  expect(page.hasPrev).toBe(true);
  expect(page.pageLabel).toBe('صفحه ۲');
});

test('last page has only prev', () => {
  const page = buildFaqPage(faqs, 2, 5);
  expect(page.items).toHaveLength(2);
  expect(page.hasNext).toBe(false);
  expect(page.hasPrev).toBe(true);
  expect(page.pageLabel).toBe('صفحه ۳');
});

test('empty list yields one empty page', () => {
  const page = buildFaqPage([], 0, 5);
  expect(page.items).toHaveLength(0);
  expect(page.hasNext).toBe(false);
  expect(page.hasPrev).toBe(false);
});
