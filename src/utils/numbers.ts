// Unicode bidi controls — isolate an LTR run inside RTL text.
export const LRI = '⁦'; // U+2066 LEFT-TO-RIGHT ISOLATE
export const PDI = '⁩'; // U+2069 POP DIRECTIONAL ISOLATE

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Convert every Latin digit in the input to a Persian digit. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * Format a price as Persian digits with a Persian thousands separator (٬ U+066C),
 * wrapped in LRI/PDI so the "number + unit" run stays LTR inside RTL Persian text.
 */
export function formatPersianPrice(amount: number, unit: string): string {
  const grouped = amount
    .toLocaleString('en-US') // 1,234,567
    .replace(/,/g, '٬'); // 1٬234٬567 (Persian thousands sep)
  return `${LRI}${toPersianDigits(grouped)} ${unit}${PDI}`;
}
