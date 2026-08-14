import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { buildListPage } from '../utils/faqPagination';
import { mainMenu, getWelcomeText } from './mainMenu';
import { MyContext } from '../types/context';
import { editOrSend } from '../utils/editOrSend';

/**
 * Pagination callback prefixes (page-size 5):
 *   `cakes:page:{pageIndex}`  — cakes list (one category, derived at handler time)
 *   `beans:page:{pageIndex}`  — beans list (one category, derived at handler time)
 * The handlers in src/handlers/callbackQuery.ts re-derive the single
 * config/category via `MenuConfigRepository.getBySection('<section>')`.
 */
const CAKES_PAGE_PREFIX = 'cakes:page:';
const BEANS_PAGE_PREFIX = 'beans:page:';
const PRODUCTS_PAGE_SIZE = 5;

export const cakesMenu = new Menu<MyContext>('products-menu-cakes')
  .text('🍰 کیک و کوکی', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'cakes'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const configs = await ctx.dataService.getBySection('cakes');
      const products =
        configs.length > 0
          ? await ctx.dataService.getProductsByCategory(configs[0].categoryId)
          : [];

      if (products.length === 0) {
        await ctx.reply('📭 در حال حاضر کیک یا کوکی موجود نیست.');
        return;
      }

      const page = buildListPage(products, 0, PRODUCTS_PAGE_SIZE);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `${CAKES_PAGE_PREFIX}${0 - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `${CAKES_PAGE_PREFIX}${0 + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');

      const body = `<b>کیک و کوکی</b> (${page.pageLabel})\n\nیک کیک یا کوکی انتخاب کنید:`;
      await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: kb }, 'cakes');
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری کیک‌ها ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = await getWelcomeText(ctx.dataService);
    await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: mainMenu }, 'main');
  });

export const beansMenu = new Menu<MyContext>('products-menu-beans')
  .text('🌱 دانه‌های قهوه', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'beans'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const configs = await ctx.dataService.getBySection('beans');
      const products =
        configs.length > 0
          ? await ctx.dataService.getProductsByCategory(configs[0].categoryId)
          : [];

      if (products.length === 0) {
        await ctx.reply('📭 در حال حاضر دانه قهوه موجود نیست.');
        return;
      }

      const page = buildListPage(products, 0, PRODUCTS_PAGE_SIZE);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `${BEANS_PAGE_PREFIX}${0 - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `${BEANS_PAGE_PREFIX}${0 + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');

      const body = `<b>دانه‌های قهوه</b> (${page.pageLabel})\n\nدانه قهوه مورد نظر را انتخاب کنید:`;
      await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: kb }, 'beans');
    } catch (e) {
      console.error(e);
      await ctx
        .answerCallbackQuery({ text: '❌ بارگذاری دانه‌های قهوه ناموفق بود.' })
        .catch(() => {});
    }
  })
  .row()
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = await getWelcomeText(ctx.dataService);
    await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: mainMenu }, 'main');
  });
