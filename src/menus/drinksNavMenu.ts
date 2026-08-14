import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { products as productsTable } from '../database/schema';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { DEFAULT_VAT_NOTE, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { formatPersianPrice } from '../utils/numbers';
import { buildListPage } from '../utils/faqPagination';
import { escapeHtml } from '../utils/htmlEscape';
import { mainMenu, getWelcomeText } from './mainMenu';
import { MyContext } from '../types/context';
import { editOrSend } from '../utils/editOrSend';

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
  items: (typeof productsTable.$inferSelect)[],
  idx: number,
  priceUnit: string,
  vatNote: string = DEFAULT_VAT_NOTE,
): Promise<void> {
  const page = buildListPage(items, idx, DRINKS_PAGE_SIZE);
  const kb = new InlineKeyboard();
  for (let i = 0; i < page.items.length; i++) {
    const p = page.items[i];
    const priceLabel =
      p.priceOnRequest || p.price == null
        ? '(سوال در کافه)'
        : formatPersianPrice(p.price, priceUnit);
    const seasonal = p.isSeasonal ? ' 🌿' : '';
    kb.text(`${p.name}${seasonal} — ${priceLabel}`, `product:${p.id}`);
    if (i % 2 === 1 || i === page.items.length - 1) kb.row();
  }
  if (page.hasPrev)
    kb.text('صفحه قبل ▶️', `${DRINKS_PAGE_PREFIX}${config.categoryId}:page:${idx - 1}`);
  if (page.hasNext)
    kb.text('◀️ صفحه بعد', `${DRINKS_PAGE_PREFIX}${config.categoryId}:page:${idx + 1}`);
  if (page.hasPrev || page.hasNext) kb.row();
  kb.row();
  kb.text('🔙 بازگشت به منو', 'back:main');

  const name = config.categoryName ?? 'بدون نام';
  const header = `<b>${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${name}</b> (${page.pageLabel})`;
  const text = `${header}${vatNote}`;
  const newState = `drinks:cat:${config.categoryId}`;
  const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };

  // Pattern A: edit the existing message in-place when possible
  await editOrSend(ctx, text, msgOpts, newState);
}

export const drinksNavMenu = new Menu<MyContext>('drinks-nav-menu')
  .dynamic(async (ctx, range) => {
    try {
      // Check drinks section visibility before rendering any category buttons
      if (!(await isMenuVisible(ctx.dataService, 'drinks'))) {
        range
          .text(HIDDEN_MESSAGE, async (ctx) => {
            const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
            await editOrSend(
              ctx,
              HIDDEN_MESSAGE,
              { parse_mode: 'HTML', reply_markup: backKb },
              'hidden:drinks',
            );
          })
          .row();
        return;
      }

      const configs = await ctx.dataService.getBySection('drinks');

      for (const config of configs) {
        const label =
          config.buttonLabel ??
          `${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${config.categoryName}`;
        range
          .text(label, async (ctx) => {
            try {
              const items = await ctx.dataService.getProductsByCategory(config.categoryId);

              if (items.length === 0) {
                const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
                const emptyText = config.specialMessage
                  ? config.specialMessage
                  : `📭 در حال حاضر ${config.categoryName ?? 'بدون نام'} موجود نیست.`;
                await editOrSend(
                  ctx,
                  emptyText,
                  { parse_mode: 'HTML', reply_markup: backKb },
                  'empty:drinks',
                );
                return;
              }

              const priceUnit =
                (await ctx.dataService.getSetting('price_unit')) || DEFAULT_PRICE_UNIT;
              const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
              const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
              await buildCategoryPage(ctx, config, items, 0, priceUnit, vatNote);
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
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = await getWelcomeText(ctx.dataService);
    await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: mainMenu }, 'main');
  });
