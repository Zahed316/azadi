import { formatPersianPrice, toPersianDigits } from './numbers';
import { products, branches, faq } from '../database/schema';
import { SettingsRepository } from '../repositories';
import { escapeHtml } from './htmlEscape';
import type { Env } from '../bot';

export const DEFAULT_VAT_NOTE = '\n\n<i>تمامی قیمت‌ها شامل ۱۰٪ مالیات بر ارزش افزوده می‌باشند.</i>';

/** @deprecated Use getVatNote(env) instead. Kept for backward compatibility. */
export const VAT_NOTE = DEFAULT_VAT_NOTE;

export const DEFAULT_PRICE_UNIT = 'تومان';

/** Read VAT note from settings, falling back to the hardcoded default. */
export async function getVatNote(env: Env): Promise<string> {
  try {
    const repo = new SettingsRepository(env.DB);
    const value = await repo.getValue('vat_note');
    // Escape admin-supplied text so HTML tags in the note don't break parse_mode: 'HTML'.
    // The hardcoded default is trusted and does not need escaping.
    return value ? escapeHtml(value) : DEFAULT_VAT_NOTE;
  } catch {
    return DEFAULT_VAT_NOTE;
  }
}

const unitMap: Record<string, string> = {
  cup: 'فنجان',
  kg: 'کیلوگرم',
  g: 'گرم',
  piece: 'عدد',
  slice: 'برش',
  item: 'عدد',
};

export function formatProduct(
  p: typeof products.$inferSelect,
  priceUnit: string = DEFAULT_PRICE_UNIT,
  vatNote: string = DEFAULT_VAT_NOTE,
): string {
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
  // Nutritional info (only when present)
  if (p.calories != null) text += `\n🔥 ${toPersianDigits(p.calories)} کالری`;
  if (p.caffeineMg != null) text += `\n⚡ کافئین: ${toPersianDigits(p.caffeineMg)} میلی‌گرم`;
  if (p.allergens) text += `\n⚠️ آلرژن‌ها: ${p.allergens}`;
  text += vatNote;
  return text;
}

export function formatBranch(b: typeof branches.$inferSelect): string {
  let text = `📍 <b>${b.name}</b>\n`;
  text += `\n🏢 آدرس: ${b.address}`;
  if (b.phone) text += `\n📞 تلفن: ${b.phone}`;
  if (b.openingHours) text += `\n⏰ ساعت کاری: ${b.openingHours}`;
  return text;
}

export function formatFaq(f: typeof faq.$inferSelect): string {
  return `❓ <b>${f.question}</b>\n\n💬 ${f.answer}`;
}
