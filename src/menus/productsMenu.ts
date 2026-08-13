import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository, MenuConfigRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { buildListPage } from '../utils/faqPagination';
import { mainMenu, getWelcomeText } from './mainMenu';
import { MyContext } from '../types/context';
import { pushMessage } from '../utils/menuLifecycle';

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
      const sent = await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
      if (sent && typeof sent === 'object' && 'message_id' in sent) {
        const evicted = pushMessage(
          ctx.session,
          ctx.chat!.id,
          (sent as { message_id: number }).message_id,
          'cakes',
        );
        if (evicted) {
          await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری کیک‌ها ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = await getWelcomeText(ctx.dataService);
    await ctx
      .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
      .catch(async () => {
        const sent = await ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu });
        const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'main');
        if (evicted) {
          await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
        }
      });
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
      const sent = await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
      if (sent && typeof sent === 'object' && 'message_id' in sent) {
        const evicted = pushMessage(
          ctx.session,
          ctx.chat!.id,
          (sent as { message_id: number }).message_id,
          'beans',
        );
        if (evicted) {
          await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
        }
      }
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
    await ctx
      .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
      .catch(async () => {
        const sent = await ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu });
        const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'main');
        if (evicted) {
          await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
        }
      });
  });
