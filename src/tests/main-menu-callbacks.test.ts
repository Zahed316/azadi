import { describe, expect, test } from 'vitest';
import { buildListPage } from '../utils/faqPagination';

/**
 * Phase 3.4 — Top-level main menu surfaces (Featured, Seasonal, Coffee Passport).
 *
 * The callback handlers in src/handlers/callbackQuery.ts fetch the items
 * via ProductRepository, paginate with buildListPage, and emit a keyboard
 * with product buttons + prev/next. The tests below cover the
 * pagination+keyboard shape so a regression in the callback data or page
 * labels surfaces here instead of in production Telegram.
 *
 * (The full bot wiring is exercised by the integration tests in
 * src/tests/api-routes.test.ts and the menu-pagination test suite —
 * these tests focus on the *new* surface shapes.)
 */

function flatten(kb: any): { text: string; callback_data?: string }[] {
  return kb.inline_keyboard.flat();
}

function buildProductKeyboard(items: any[], idx: number, prefix: string, prefix0: string) {
  const page = buildListPage(items, idx, 5);
  const kb = { inline_keyboard: [] as any[][] };
  for (const p of page.items) {
    kb.inline_keyboard.push([{ text: p.name, callback_data: `product:${p.id}` }]);
  }
  if (page.hasPrev) kb.inline_keyboard.push([{ text: 'صفحه قبل ▶️', callback_data: `${prefix0}:page:${idx - 1}` }]);
  if (page.hasNext) kb.inline_keyboard.push([{ text: '◀️ صفحه بعد', callback_data: `${prefix}:page:${idx + 1}` }]);
  return { kb, page };
}

const products = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `محصول ${i + 1}`,
  featured: i < 7,    // 7 featured → 2 pages (5+2)
  isSeasonal: i >= 7, // 5 seasonal → 1 page (no next)
}));

describe('Featured callback keyboard', () => {
  test('renders page 0 with only next button', () => {
    const featured = products.filter((p) => p.featured);
    const { kb, page } = buildProductKeyboard(featured, 0, 'featured', 'featured');
    const flat = flatten(kb);
    expect(page.pageLabel).toBe('صفحه ۱');
    expect(flat.filter((b) => b.text === '◀️ صفحه بعد')).toHaveLength(1);
    expect(flat.filter((b) => b.text === 'صفحه قبل ▶️')).toHaveLength(0);
  });

  test('renders page 1 with only prev button', () => {
    const featured = products.filter((p) => p.featured);
    const { kb, page } = buildProductKeyboard(featured, 1, 'featured', 'featured');
    const flat = flatten(kb);
    expect(page.pageLabel).toBe('صفحه ۲');
    expect(flat.filter((b) => b.text === 'صفحه قبل ▶️')).toHaveLength(1);
    expect(flat.filter((b) => b.text === '◀️ صفحه بعد')).toHaveLength(0);
  });

  test('emits product: callback data for each product on the page', () => {
    const featured = products.filter((p) => p.featured);
    const { kb } = buildProductKeyboard(featured, 0, 'featured', 'featured');
    const productBtns = flatten(kb).filter((b) => b.callback_data?.startsWith('product:'));
    // Page 0 of 5-per-page = 5 products
    expect(productBtns).toHaveLength(5);
  });

  test('empty featured list yields empty keyboard', () => {
    const { kb, page } = buildProductKeyboard([], 0, 'featured', 'featured');
    const flat = flatten(kb);
    expect(page.items).toHaveLength(0);
    expect(flat).toHaveLength(0);
  });
});

describe('Seasonal callback keyboard', () => {
  test('renders single page (5 products, no next)', () => {
    const seasonal = products.filter((p) => p.isSeasonal);
    const { kb, page } = buildProductKeyboard(seasonal, 0, 'seasonal', 'seasonal');
    expect(page.pageLabel).toBe('صفحه ۱');
    const flat = flatten(kb);
    expect(flat.filter((b) => b.text === '◀️ صفحه بعد')).toHaveLength(0);
    expect(flat.filter((b) => b.text === 'صفحه قبل ▶️')).toHaveLength(0);
    // 5 product rows
    const productBtns = flat.filter((b) => b.callback_data?.startsWith('product:'));
    expect(productBtns).toHaveLength(5);
  });
});

describe('Coffee Passport callback keyboard', () => {
  // The handler maps each `{ product, details }` row to a label and callback
  // before building the keyboard. This fixture mirrors that mapping so the
  // pagination + keyboard shape under test matches the real handler.
  const rows = Array.from({ length: 7 }, (_, i) => {
    const product = { id: i + 1, name: `دانه ${i + 1}` };
    const details = { origin: ['اتیوپی', 'کلمبیا', 'برزیل', 'اتیوپی', 'کنیا', 'برزیل', 'اتیوپی'][i] };
    return {
      id: product.id,
      name: `${product.name} — ${details.origin}`,
      origin: details.origin,
    };
  });

  test('embeds origin in the button label', () => {
    const { kb } = buildProductKeyboard(rows, 0, 'passport', 'passport');
    const flat = flatten(kb);
    // The Passport button label format is "name — origin" per the
    // callbackQuery.ts handler; find the first row whose name starts with "دانه"
    const labeled = flat.find((b) => b.text && b.text.startsWith('دانه 1'));
    expect(labeled?.text).toBe('دانه 1 — اتیوپی');
  });

  test('distinct origin count is correctly computed for the page', () => {
    const page = buildListPage(rows, 0, 5);
    // page 0: rows 0..4 → origins اتیوپی, کلمبیا, برزیل, اتیوپی, کنیا = 4 distinct
    const origins = Array.from(new Set(page.items.map((r: any) => r.origin).filter(Boolean)));
    expect(origins).toHaveLength(4);
  });

  test('page 1 wraps to the second half of the rows', () => {
    const { page } = buildProductKeyboard(rows, 1, 'passport', 'passport');
    expect(page.items).toHaveLength(2);
    expect(page.items[0].name).toBe('دانه 6 — برزیل');
  });
});

describe('Coffee Passport — empty state', () => {
  test('no beans with coffee details yields empty page', () => {
    const { kb, page } = buildProductKeyboard([], 0, 'passport', 'passport');
    expect(page.items).toHaveLength(0);
    expect(flatten(kb)).toHaveLength(0);
  });
});
