import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { FaqRepository, ProductRepository, SettingsRepository } from '../repositories';
import { formatFaq, formatProduct, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { MyContext } from '../types/context';

const PRICE_UNIT_FALLBACK = DEFAULT_PRICE_UNIT;

async function loadPriceUnit(env: any): Promise<string> {
  return (await new SettingsRepository(env.DB).getValue('price_unit')) || PRICE_UNIT_FALLBACK;
}

export const mainMenu = new Menu<MyContext>('main-menu')
  // --- Phase 3 marquee surfaces (4 new buttons) ---
  .text('⭐ پیشنهاد ویژه', async (ctx: any) => {
    try {
      const items = await new ProductRepository(ctx.env.DB).getByFlag('featured');
      if (items.length === 0) {
        await ctx.reply('📭 در حال حاضر محصول ویژه‌ای نداریم.', { reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main') });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const page = buildListPage(items, 0, 5);
      const list = page.items.map((p: any) => ({
        label: p.name,
        callbackData: `product:${p.id}`,
      }));
      const kb = new InlineKeyboard();
      for (const item of list) kb.text(item.label, item.callbackData).row();
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `featured:page:0`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `featured:page:1`);
      const body = `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری پیشنهاد ویژه ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .text('🌿 مخصوص فصل', async (ctx: any) => {
    try {
      const items = await new ProductRepository(ctx.env.DB).getByFlag('isSeasonal');
      if (items.length === 0) {
        await ctx.reply('📭 در حال حاضر محصول فصلی موجود نیست.', { reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main') });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const page = buildListPage(items, 0, 5);
      const list = page.items.map((p: any) => ({
        label: p.name,
        callbackData: `product:${p.id}`,
      }));
      const kb = new InlineKeyboard();
      for (const item of list) kb.text(item.label, item.callbackData).row();
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `seasonal:page:0`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `seasonal:page:1`);
      const body = `<b>🌿 مخصوص فصل</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری محصولات فصلی ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .text('📖 پاسپورت قهوه', async (ctx: any) => {
    try {
      const rows = await new ProductRepository(ctx.env.DB).getBeansWithCoffeeDetails();
      if (rows.length === 0) {
        await ctx.reply('📭 هنوز دانه قهوه‌ای با جزئیات کشت ثبت نشده است.', { reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main') });
        return;
      }
      const priceUnit = await loadPriceUnit(ctx.env);
      const page = buildListPage(rows, 0, 5);
      // Distinct-origin summary above the list (Phase 5 will turn this into a per-user counter).
      const origins = Array.from(new Set(page.items.map((r: any) => r.details?.origin).filter(Boolean)));
      const originsLine = origins.length > 0 ? `\n\n🗺 <b>${origins.length} کشور مبدا در این صفحه:</b> ${origins.join(' · ')}` : '';
      const list = page.items.map((r: any) => {
        const p = r.product;
        const origin = r.details?.origin ? ` — ${r.details.origin}` : '';
        return { label: `${p.name}${origin}`, callbackData: `product:${p.id}` };
      });
      const kb = new InlineKeyboard();
      for (const item of list) kb.text(item.label, item.callbackData).row();
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `passport:page:0`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `passport:page:1`);
      const body = `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})${originsLine}\n\n${page.items.map((r: any) => formatProduct(r.product, priceUnit)).join('\n\n')}`;
      await ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری پاسپورت قهوه ناموفق بود.' }).catch(() => {});
    }
  })
  .text('🔍 جستجو', async (ctx: any) => {
    try {
      // Just nudge the user to type their question. The actual AI handler
      // in src/handlers/message.ts will pick up the next text message.
      await ctx.replyWithChatAction('typing');
      await ctx.reply(
        'سؤال خود را بنویسید — دستیار هوشمند پاسخ می‌دهد 🤖',
        { parse_mode: 'HTML' },
      );
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  })
  .row()
  // --- Existing surfaces (unchanged) ---
  .text('🏠 درباره ما', async (ctx: any) => {
    try {
      const repo = new SettingsRepository(ctx.env.DB);
      const aboutText = await repo.getValue('about') || 'به روستری قهوه آزادی خوش آمدید — قهوه تازه‌بوشده از ایرانشهر. ☕';
      await ctx.reply(aboutText, { parse_mode: 'HTML' });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود. لطفاً دوباره امتحان کنید.' }).catch(() => {});
    }
  })
  .submenu('☕ نوشیدنی‌ها', 'drinks-nav-menu')
  .submenu('🌱 دانه‌های قهوه', 'products-menu-beans')
  .row()
  .submenu('🍰 کیک و کوکی', 'products-menu-cakes')
  .row()
  .submenu('📍 شعب', 'branches-menu')
  .text('❓ سوالات متداول', async (ctx: any) => {
    try {
      const repo = new FaqRepository(ctx.env.DB);
      const faqs = await repo.getAll();
      if (faqs.length === 0) {
        await ctx.reply('📭 هنوز سوالی ثبت نشده است.');
        return;
      }
      const page = buildListPage(faqs, 0, 5);
      const text = page.items.map((f: any) => formatFaq(f)).join('\n\n');
      const kb = new InlineKeyboard();
      if (page.hasNext) kb.text('◀️ صفحه بعد', 'faq:page:1');
      await ctx.reply(`<b>سوالات متداول</b> (${page.pageLabel})\n\n${text}`, { parse_mode: 'HTML', reply_markup: kb });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود. لطفاً دوباره امتحان کنید.' }).catch(() => {});
    }
  })
  .row()
  .text('🤖 دستیار هوشمند قهوه', async (ctx: any) => {
    try {
      const repo = new SettingsRepository(ctx.env.DB);
      const greeting = await repo.getValue('ai_greeting') || 'من دستیار هوشمند قهوه شما هستم! 🤖☕\n\nهر سوالی درباره قهوه، روش‌های دم‌آوری، شعب یا هر چیز دیگری دارید از من بپرسید.';
      await ctx.reply(greeting, { parse_mode: 'HTML' });
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  });
