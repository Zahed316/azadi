import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository, MenuConfigRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { buildListPage } from '../utils/faqPagination';
import { mainMenu } from './mainMenu';
import { MyContext } from '../types/context';

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
      if (!(await isMenuVisible(ctx.env, 'cakes'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const repo = new ProductRepository(ctx.env.DB);
      const menuRepo = new MenuConfigRepository(ctx.env.DB);
      const configs = await menuRepo.getBySection('cakes');
      const products =
        configs.length > 0 ? await repo.getProductsByCategory(configs[0].categoryId) : [];

      if (products.length === 0) {
        await ctx.reply('📭 در حال حاضر کیک یا کوکی موجود نیست.');
        return;
      }

      const page = buildListPage(products, 0, PRODUCTS_PAGE_SIZE);
      const kb = new InlineKeyboard();
      for (const p of page.items) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `${CAKES_PAGE_PREFIX}${0 - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `${CAKES_PAGE_PREFIX}${0 + 1}`);

      const body = `<b>کیک و کوکی</b> (${page.pageLabel})\n\nیک کیک یا کوکی انتخاب کنید:`;
      await ctx
        .editMessageText(body, { reply_markup: kb })
        .catch(() => ctx.reply(body, { reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری کیک‌ها ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = 'منوی اصلی:';
    await ctx
      .editMessageText(body, { reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { reply_markup: mainMenu }));
  });

export const beansMenu = new Menu<MyContext>('products-menu-beans')
  .text('🌱 دانه‌های قهوه', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'beans'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const repo = new ProductRepository(ctx.env.DB);
      const menuRepo = new MenuConfigRepository(ctx.env.DB);
      const configs = await menuRepo.getBySection('beans');
      const products =
        configs.length > 0 ? await repo.getProductsByCategory(configs[0].categoryId) : [];

      if (products.length === 0) {
        await ctx.reply('📭 در حال حاضر دانه قهوه موجود نیست.');
        return;
      }

      const page = buildListPage(products, 0, PRODUCTS_PAGE_SIZE);
      const kb = new InlineKeyboard();
      for (const p of page.items) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `${BEANS_PAGE_PREFIX}${0 - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `${BEANS_PAGE_PREFIX}${0 + 1}`);

      const body = `<b>دانه‌های قهوه</b> (${page.pageLabel})\n\nدانه قهوه مورد نظر را انتخاب کنید:`;
      await ctx
        .editMessageText(body, { reply_markup: kb })
        .catch(() => ctx.reply(body, { reply_markup: kb }));
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
    const body = 'منوی اصلی:';
    await ctx
      .editMessageText(body, { reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { reply_markup: mainMenu }));
  });
