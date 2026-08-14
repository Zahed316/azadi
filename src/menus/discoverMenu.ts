import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { products, coffeeDetails } from '../database/schema';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { formatProduct, DEFAULT_PRICE_UNIT, DEFAULT_VAT_NOTE } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { escapeHtml } from '../utils/htmlEscape';
import { mainMenu, getWelcomeText } from './mainMenu';
import { MyContext } from '../types/context';
import type { IDataService } from '../services/types';
import { getActiveMessage, handleEditFailure } from '../utils/menuLifecycle';
import { editOrSend } from '../utils/editOrSend';

async function loadPriceUnit(dataService: IDataService): Promise<string> {
  return (await dataService.getSetting('price_unit')) || DEFAULT_PRICE_UNIT;
}

export const discoverMenu = new Menu<MyContext>('discover-menu')
  .text('⭐ پیشنهاد ویژه', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'featured'))) {
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, HIDDEN_MESSAGE, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'hidden:featured';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              HIDDEN_MESSAGE,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(HIDDEN_MESSAGE, { reply_markup: backKb });
        return;
      }
      const items = await ctx.dataService.getByFlag('featured');
      if (items.length === 0) {
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const emptyText = '📭 در حال حاضر محصول ویژه‌ای نداریم.';
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, emptyText, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'empty:featured';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              emptyText,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(emptyText, { reply_markup: backKb });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.dataService);
      const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(items, 0, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasNext) kb.text('◀️ صفحه بعد', `featured:page:1`);
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body = `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})\n\n${page.items.map((p: typeof products.$inferSelect) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;

      await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: kb }, 'featured');
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
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, HIDDEN_MESSAGE, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'hidden:seasonal';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              HIDDEN_MESSAGE,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(HIDDEN_MESSAGE, { reply_markup: backKb });
        return;
      }
      const items = await ctx.dataService.getByFlag('isSeasonal');
      if (items.length === 0) {
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const emptyText = '📭 در حال حاضر محصول فصلی موجود نیست.';
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, emptyText, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'empty:seasonal';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              emptyText,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(emptyText, { reply_markup: backKb });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.dataService);
      const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(items, 0, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasNext) kb.text('◀️ صفحه بعد', `seasonal:page:1`);
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body = `<b>🌿 مخصوص فصل</b> (${page.pageLabel})\n\n${page.items.map((p: typeof products.$inferSelect) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;

      await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: kb }, 'seasonal');
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
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, HIDDEN_MESSAGE, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'hidden:passport';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              HIDDEN_MESSAGE,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(HIDDEN_MESSAGE, { reply_markup: backKb });
        return;
      }
      const rows = await ctx.dataService.getBeansWithCoffeeDetails();
      if (rows.length === 0) {
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const emptyText = '📭 هنوز دانه قهوه‌ای با جزئیات کشت ثبت نشده است.';
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, emptyText, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'empty:passport';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              emptyText,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(emptyText, { reply_markup: backKb });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.dataService);
      const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
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
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body = `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})${originsLine}\n\n${page.items.map((r: { product: typeof products.$inferSelect; details: typeof coffeeDetails.$inferSelect }) => formatProduct(r.product, priceUnit, vatNote)).join('\n\n')}`;

      await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: kb }, 'passport');
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
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, HIDDEN_MESSAGE, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'hidden:search';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              HIDDEN_MESSAGE,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(HIDDEN_MESSAGE, { reply_markup: backKb });
        return;
      }
      await ctx.replyWithChatAction('typing');
      const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const body = 'سؤال خود را بنویسید — دستیار هوشمند پاسخ می‌دهد 🤖';
      await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: backKb }, 'search');
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  })
  .row()
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = await getWelcomeText(ctx.dataService);
    await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: mainMenu }, 'main');
  });
