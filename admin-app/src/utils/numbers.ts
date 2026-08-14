/**
 * Convert every Latin digit in the input to a Persian digit.
 * Canonical implementation — keep in sync with src/utils/numbers.ts
 */
export function toPersianDigits(input: string | number): string {
  const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}
