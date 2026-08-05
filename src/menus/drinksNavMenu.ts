import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository, MenuConfigRepository, SettingsRepository } from '../repositories';
import { VAT_NOTE, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { formatPersianPrice } from '../utils/numbers';
import { buildListPage } from '../utils/faqPagination';
import { MyContext } from '../types/context';

/**
 * Pagination callback prefix for drinks categories:
 *   `drinks:cat:{categoryId}:page:{pageIndex}`
 * The categoryId is needed because each category has its own product list.
 */
const DRINKS_PAGE_PREFIX = 'drinks:cat:';
const DRINKS_PAGE_SIZE = 5;

/**
 * Build the paginated view for a single drinks category. Shared by the inline
 * `range.text` handler (first page) and the `drinks:cat:*:page:*` callback
 * handler in src/handlers/callbackQuery.ts (pages 1+). Caller is responsible
 * for the empty-state `specialMessage` / "موجود نیست" reply when `items` is
 * empty before calling this for the first page.
 */
export async function buildCategoryPage(
  ctx: MyContext,
  config: {
    categoryId: number;
    categoryName: string | null;
    categoryEmoji: string | null;
    specialMessage: string | null;
  },
  items: any[],
  idx: number,
  priceUnit: string,
): Promise<void> {
  const page = buildListPage(items, idx, DRINKS_PAGE_SIZE);
  const kb = new InlineKeyboard();
  for (const p of page.items) {
    const priceLabel =
      p.priceOnRequest || p.price == null
        ? '(سوال در کافه)'
        : formatPersianPrice(p.price, priceUnit);
    const seasonal = p.isSeasonal ? ' 🌿' : '';
    kb.text(`${p.name}${seasonal} — ${priceLabel}`, `product:${p.id}`).row();
  }
  if (page.hasPrev)
    kb.text('صفحه قبل ▶️', `${DRINKS_PAGE_PREFIX}${config.categoryId}:page:${idx - 1}`);
  if (page.hasNext)
    kb.text('◀️ صفحه بعد', `${DRINKS_PAGE_PREFIX}${config.categoryId}:page:${idx + 1}`);

  const name = config.categoryName ?? 'بدون نام';
  const header = `<b>${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${name}</b> (${page.pageLabel})`;
  const text = `${header}${VAT_NOTE}`;
  await ctx
    .editMessageText(text, { parse_mode: 'HTML', reply_markup: kb })
    .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb }));
}

export const drinksNavMenu = new Menu<MyContext>('drinks-nav-menu')
  .dynamic(async (ctx, range) => {
    try {
      const menuRepo = new MenuConfigRepository(ctx.env.DB);
      const configs = await menuRepo.getBySection('drinks');

      for (const config of configs) {
        const label =
          config.buttonLabel ??
          `${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${config.categoryName}`;
        range
          .text(label, async (ctx) => {
            try {
              const pRepo = new ProductRepository(ctx.env.DB);
              const items = await pRepo.getProductsByCategory(config.categoryId);

              if (items.length === 0) {
                if (config.specialMessage) {
                  await ctx.reply(config.specialMessage, { parse_mode: 'HTML' });
                } else {
                  await ctx.reply(`📭 در حال حاضر ${config.categoryName} موجود نیست.`);
                }
                return;
              }

              const priceUnit =
                (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) ||
                DEFAULT_PRICE_UNIT;
              await buildCategoryPage(ctx, config, items, 0, priceUnit);
            } catch (e) {
              console.error(e);
              await ctx
                .answerCallbackQuery({ text: '❌ بارگذاری محصولات ناموفق بود.' })
                .catch(() => {});
            }
          })
          .row();
      }
    } catch (e) {
      console.error(e);
      range.text('❌ خطا در بارگذاری دسته‌بندی‌ها').row();
    }
  })
  .back('↩️ بازگشت');
