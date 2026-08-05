import { describe, expect, test, vi } from 'vitest';
import { buildCategoryPage } from '../menus/drinksNavMenu';

/**
 * Mocked MyContext that captures the most recent editMessageText call so we
 * can assert the rendered body, page label, and prev/next callback data
 * without spinning up a real Telegram bot. `.catch(() => {})` keeps
 * `editMessageText` resolvable when test cases need it to reject.
 */
function makeMockCtx() {
  const last: { text?: string; opts?: any } = {};
  const ctx: any = {
    editMessageText: vi.fn((text: string, opts: any) => {
      last.text = text;
      last.opts = opts;
      return Promise.resolve({ message_id: 1 });
    }),
    reply: vi.fn(async () => {}),
  };
  return { ctx, last };
}

const config = {
  categoryId: 7,
  categoryName: 'هات چاکلت',
  categoryEmoji: '🍫',
  specialMessage: null,
};

const products = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `پ${i + 1}`,
  price: 10000 + i * 1000,
  priceOnRequest: false,
  isSeasonal: false,
}));

/** Flatten the InlineKeyboard rows to a single list of button objects. */
function flatten(kb: any): { text: string; callback_data?: string }[] {
  return kb.inline_keyboard.flat();
}

describe('buildCategoryPage (drinks paginated view)', () => {
  test('first page renders page label and only a next button', async () => {
    const { ctx, last } = makeMockCtx();
    await buildCategoryPage(ctx, config, products, 0, 'تومان');

    expect(last.text).toContain('(صفحه ۱)');
    const labels = flatten(last.opts.reply_markup).map((b) => b.text);
    expect(labels).toContain('◀️ صفحه بعد');
    expect(labels).not.toContain('صفحه قبل ▶️');
  });

  test('middle page has both prev and next callback data', async () => {
    const { ctx, last } = makeMockCtx();
    await buildCategoryPage(ctx, config, products, 1, 'تومان');

    expect(last.text).toContain('(صفحه ۲)');
    const callbackData = flatten(last.opts.reply_markup).map((b) => b.callback_data);
    expect(callbackData).toContain('drinks:cat:7:page:0');
    expect(callbackData).toContain('drinks:cat:7:page:2');
  });

  test('last page has only prev, no next', async () => {
    const { ctx, last } = makeMockCtx();
    await buildCategoryPage(ctx, config, products, 2, 'تومان');
    expect(last.text).toContain('(صفحه ۳)');
    const labels = flatten(last.opts.reply_markup).map((b) => b.text);
    expect(labels).not.toContain('◀️ صفحه بعد');
    expect(labels).toContain('صفحه قبل ▶️');
  });

  test('product buttons embed product: callback and price is Persian-formatted', async () => {
    const { ctx, last } = makeMockCtx();
    await buildCategoryPage(ctx, config, products.slice(0, 2), 0, 'تومان');
    const productButtons = flatten(last.opts.reply_markup)
      .filter((b) => b.callback_data?.startsWith('product:'));
    expect(productButtons).toHaveLength(2);
    expect(productButtons[0].callback_data).toBe('product:1');
    // formatPersianPrice wraps in LRI/PDI and uses Persian digits; the first
    // product is 10,000 تومان → "۱۰٬۰۰۰" with bidi isolates preserved.
    expect(productButtons[0].text).toContain('۱۰٬۰۰۰');
    expect(productButtons[0].text).toContain('تومان');
  });

  test('seasonal flag appends the 🌿 marker to the product button label', async () => {
    const { ctx, last } = makeMockCtx();
    const seasonalProducts = [{ id: 99, name: 'پای کدو', price: 25000, priceOnRequest: false, isSeasonal: true }];
    await buildCategoryPage(ctx, config, seasonalProducts, 0, 'تومان');
    const btn = flatten(last.opts.reply_markup)[0];
    expect(btn.text).toContain('پای کدو 🌿');
  });

  test('priceOnRequest renders the (سوال در کافه) fallback', async () => {
    const { ctx, last } = makeMockCtx();
    const onRequest = [{ id: 50, name: 'ویژه', price: null, priceOnRequest: true, isSeasonal: false }];
    await buildCategoryPage(ctx, config, onRequest, 0, 'تومان');
    const btn = flatten(last.opts.reply_markup)[0];
    expect(btn.text).toContain('(سوال در کافه)');
  });
});
