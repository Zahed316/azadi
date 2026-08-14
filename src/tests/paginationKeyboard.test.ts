import { expect, test } from 'vitest';
import { buildPaginationKeyboard } from '../utils/paginationKeyboard';

test('returns only page indicator when totalPages is 1', () => {
  const kb = buildPaginationKeyboard({ callbackPrefix: 'cat', page: 1, totalPages: 1 });
  expect(kb.inline_keyboard).toEqual([[{ text: '1/1', callback_data: 'noop' }]]);
});

test('returns forward button when on first page', () => {
  const kb = buildPaginationKeyboard({ callbackPrefix: 'cat', page: 1, totalPages: 3 });
  expect(kb.inline_keyboard).toEqual([
    [
      { text: '1/3', callback_data: 'noop' },
      { text: '▶️', callback_data: 'cat:page:2' },
    ],
  ]);
});

test('returns back button when on last page', () => {
  const kb = buildPaginationKeyboard({ callbackPrefix: 'cat', page: 3, totalPages: 3 });
  expect(kb.inline_keyboard).toEqual([
    [
      { text: '◀️', callback_data: 'cat:page:2' },
      { text: '3/3', callback_data: 'noop' },
    ],
  ]);
});

test('returns both buttons when in middle', () => {
  const kb = buildPaginationKeyboard({ callbackPrefix: 'cat', page: 2, totalPages: 5 });
  expect(kb.inline_keyboard).toEqual([
    [
      { text: '◀️', callback_data: 'cat:page:1' },
      { text: '2/5', callback_data: 'noop' },
      { text: '▶️', callback_data: 'cat:page:3' },
    ],
  ]);
});

test('uses correct callback prefix', () => {
  const kb = buildPaginationKeyboard({ callbackPrefix: 'fav', page: 1, totalPages: 3 });
  expect(kb.inline_keyboard).toEqual([
    [
      { text: '1/3', callback_data: 'noop' },
      { text: '▶️', callback_data: 'fav:page:2' },
    ],
  ]);
});
