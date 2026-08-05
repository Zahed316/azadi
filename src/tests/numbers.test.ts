import { expect, test } from 'vitest';
import { toPersianDigits, formatPersianPrice, LRI, PDI } from '../utils/numbers';

test('toPersianDigits converts Latin to Persian digits', () => {
  expect(toPersianDigits('0123456789')).toBe('۰۱۲۳۴۵۶۷۸۹');
  expect(toPersianDigits('قیمت 35000')).toBe('قیمت ۳۵۰۰۰');
  expect(toPersianDigits('')).toBe('');
});

test('toPersianDigits leaves non-digits untouched', () => {
  expect(toPersianDigits('abc')).toBe('abc');
  expect(toPersianDigits('۱۲۳')).toBe('۱۲۳'); // already Persian
});

test('formatPersianPrice adds thousands separator and unit', () => {
  expect(formatPersianPrice(35000, 'تومان')).toBe(`${LRI}۳۵٬۰۰۰ تومان${PDI}`);
  expect(formatPersianPrice(500, 'تومان')).toBe(`${LRI}۵۰۰ تومان${PDI}`);
  expect(formatPersianPrice(1234567, 'ریال')).toBe(`${LRI}۱٬۲۳۴٬۵۶۷ ریال${PDI}`);
});

test('formatPersianPrice wraps the whole run in bidi isolates', () => {
  const out = formatPersianPrice(35000, 'تومان');
  expect(out.startsWith(LRI)).toBe(true);
  expect(out.endsWith(PDI)).toBe(true);
});
