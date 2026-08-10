export function toPersianDigits(input: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (d) => persianDigits[parseInt(d)]);
}

export function formatPersianPrice(amount: number, unit: string = 'تومان'): string {
  const formatted = amount.toLocaleString('fa-IR');
  return `${formatted} ${unit}`;
}
