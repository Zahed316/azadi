import { expect, test } from 'vitest';
import { toPersianDigits, formatPersianPrice, LRI, PDI } from '../utils/numbers';

test('toPersianDigits converts Latin digits to Persian', () => {
  expect(toPersianDigits('123')).toBe('۱۲۳');
  expect(toPersianDigits('0')).toBe('۰');
  expect(toPersianDigits('9')).toBe('۹');
  expect(toPersianDigits('abc')).toBe('abc');
  expect(toPersianDigits('a1b2c3')).toBe('a۱b۲c۳');
});

test('toPersianDigits accepts numbers', () => {
  expect(toPersianDigits(456)).toBe('۴۵۶');
  expect(toPersianDigits(0)).toBe('۰');
});

test('toPersianDigits handles empty string', () => {
  expect(toPersianDigits('')).toBe('');
});

test('formatPersianPrice wraps in bidi isolates', () => {
  const result = formatPersianPrice(10000, 'تومان');
  expect(result).toContain('۱۰٬۰۰۰');
  expect(result).toContain('تومان');
  expect(result).toContain(LRI);
  expect(result).toContain(PDI);
});

test('formatPersianPrice with default unit', () => {
  const result = formatPersianPrice(5000);
  expect(result).toContain('تومان');
});
