import { formatPersianPrice, toPersianDigits } from './numbers';

export const VAT_NOTE = '\n\n<i>تمامی قیمت‌ها شامل ۱۰٪ مالیات بر ارزش افزوده می‌باشند.</i>';

export const DEFAULT_PRICE_UNIT = 'تومان';

const unitMap: Record<string, string> = {
  cup: 'فنجان',
  kg: 'کیلوگرم',
  piece: 'عدد',
  slice: 'برش',
  item: 'عدد',
};

export function formatProduct(p: any, priceUnit: string = DEFAULT_PRICE_UNIT): string {
  let text = `📦 <b>${p.name}</b>\n`;
  if (p.description) text += `\n${p.description}\n`;
  if (p.priceOnRequest || p.price == null) {
    text += `\n💰 قیمت: سوال در کافه`;
  } else {
    text += `\n💰 قیمت: ${formatPersianPrice(p.price, priceUnit)}`;
  }
  if (p.isSeasonal) text += `\n🌿 <i>مخصوص این فصل</i>`;
  if (p.sizeOptions) text += `\n📐 اندازه‌ها: ${JSON.parse(p.sizeOptions).join(', ')}`;
  if (p.syrupOptions) text += `\n🍯 سیروپ‌ها: ${JSON.parse(p.syrupOptions).join(', ')}`;
  // Only show stock for physical goods (beans, equipment)
  if (p.unit !== 'cup') {
    const unitLabel = unitMap[p.unit] || p.unit;
    text += `\n📦 موجودی: ${p.stock > 0 ? `${toPersianDigits(p.stock)} ${unitLabel}` : 'ناموجود'}`;
  }
  text += VAT_NOTE;
  return text;
}

export function formatBranch(b: any): string {
  let text = `📍 <b>${b.name}</b>\n`;
  text += `\n🏢 آدرس: ${b.address}`;
  if (b.phone) text += `\n📞 تلفن: ${b.phone}`;
  if (b.openingHours) text += `\n⏰ ساعت کاری: ${b.openingHours}`;
  return text;
}

export function formatFaq(f: any): string {
  return `❓ <b>${f.question}</b>\n\n💬 ${f.answer}`;
}
