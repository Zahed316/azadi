import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository, SettingsRepository } from '../repositories';
import { products, coffeeDetails } from '../database/schema';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { formatProduct, DEFAULT_PRICE_UNIT, DEFAULT_VAT_NOTE } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { escapeHtml } from '../utils/htmlEscape';
import { mainMenu, getWelcomeText } from './mainMenu';
import { MyContext } from '../types/context';
import type { Env } from '../bot';

async function loadPriceUnit(env: Env): Promise<string> {
  return (await new SettingsRepository(env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
}

export const discoverMenu = new Menu<MyContext>('discover-menu')
  .text('⭐ پیشنهاد ویژه', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'featured'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const items = await new ProductRepository(ctx.env.DB).getByFlag('featured');
      if (items.length === 0) {
        await ctx.reply('📭 در حال حاضر محصول ویژه‌ای نداریم.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const vatNoteRaw = await new SettingsRepository(ctx.env.DB).getValue('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(items, 0, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasNext) kb.text('◀️ صفحه بعد', `featured:page:1`);
      const body = `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})\n\n${page.items.map((p: typeof products.$inferSelect) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;

      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx
        .answerCallbackQuery({ text: '❌ بارگذاری پیشنهاد ویژه ناموفق بود.' })
        .catch(() => {});
    }
  })
  .text('🌿 محصول فصلی', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'seasonal'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const items = await new ProductRepository(ctx.env.DB).getByFlag('isSeasonal');
      if (items.length === 0) {
        await ctx.reply('📭 در حال حاضر محصول فصلی موجود نیست.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const vatNoteRaw = await new SettingsRepository(ctx.env.DB).getValue('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(items, 0, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasNext) kb.text('◀️ صفحه بعد', `seasonal:page:1`);
      const body = `<b>🌿 مخصوص فصل</b> (${page.pageLabel})\n\n${page.items.map((p: typeof products.$inferSelect) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx
        .answerCallbackQuery({ text: '❌ بارگذاری محصولات فصلی ناموفق بود.' })
        .catch(() => {});
    }
  })
  .text('📖 پاسپورت', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'passport'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const rows = await new ProductRepository(ctx.env.DB).getBeansWithCoffeeDetails();
      if (rows.length === 0) {
        await ctx.reply('📭 هنوز دانه قهوه‌ای با جزئیات کشت ثبت نشده است.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const vatNoteRaw = await new SettingsRepository(ctx.env.DB).getValue('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(rows, 0, 5);
      const origins = Array.from(
        new Set(
          page.items
            .map(
              (r: {
                product: typeof products.$inferSelect;
                details: typeof coffeeDetails.$inferSelect;
              }) => r.details?.origin,
            )
            .filter(Boolean),
        ),
      );
      const originsLine =
        origins.length > 0
          ? `\n\n🗺 <b>${origins.length} کشور مبدا در این صفحه:</b> ${origins.join(' · ')}`
          : '';
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        const p = page.items[i].product;
        const origin = page.items[i].details?.origin ? ` — ${page.items[i].details.origin}` : '';
        kb.text(`${p.name}${origin}`, `product:${p.id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasNext) kb.text('◀️ صفحه بعد', `passport:page:1`);
      const body = `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})${originsLine}\n\n${page.items.map((r: { product: typeof products.$inferSelect; details: typeof coffeeDetails.$inferSelect }) => formatProduct(r.product, priceUnit, vatNote)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx
        .answerCallbackQuery({ text: '❌ بارگذاری پاسپورت قهوه ناموفق بود.' })
        .catch(() => {});
    }
  })
  .row()
  .text('🔍 جستجو', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'search'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      await ctx.replyWithChatAction('typing');
      await ctx.reply('سؤال خود را بنویسید — دستیار هوشمند پاسخ می‌دهد 🤖', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  })
  .row()
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = await getWelcomeText(ctx.env);
    await ctx
      .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu }));
  });
