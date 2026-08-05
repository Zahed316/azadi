import { expect, test } from 'vitest';
import { buildListPage } from '../utils/faqPagination';

const faqs = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, question: `Q${i + 1}`, answer: `A${i + 1}` }));

test('first page has 5 items and only a next button', () => {
  const page = buildListPage(faqs, 0, 5);
  expect(page.items).toHaveLength(5);
  expect(page.hasNext).toBe(true);
  expect(page.hasPrev).toBe(false);
  expect(page.pageLabel).toBe('صفحه ۱');
});

test('middle page has both buttons', () => {
  const page = buildListPage(faqs, 1, 5);
  expect(page.hasNext).toBe(true);
  expect(page.hasPrev).toBe(true);
  expect(page.pageLabel).toBe('صفحه ۲');
});

test('last page has only prev', () => {
  const page = buildListPage(faqs, 2, 5);
  expect(page.items).toHaveLength(2);
  expect(page.hasNext).toBe(false);
  expect(page.hasPrev).toBe(true);
  expect(page.pageLabel).toBe('صفحه ۳');
});

test('empty list yields one empty page', () => {
  const page = buildListPage<typeof faqs[0]>([], 0, 5);
  expect(page.items).toHaveLength(0);
  expect(page.hasNext).toBe(false);
  expect(page.hasPrev).toBe(false);
});

// Generalization check: a list of branches paginates with the same helper.
const branches = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, name: `شعبه ${i + 1}` }));

test('branches list paginates identically to faq list', () => {
  const page = buildListPage(branches, 0, 5);
  expect(page.items).toHaveLength(5);
  expect(page.hasNext).toBe(true);
  expect(page.pageLabel).toBe('صفحه ۱');
});

test('branches last page has 2 items, no next', () => {
  const page = buildListPage(branches, 1, 5);
  expect(page.items).toHaveLength(2);
  expect(page.hasNext).toBe(false);
  expect(page.hasPrev).toBe(true);
});
