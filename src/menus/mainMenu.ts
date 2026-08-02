import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { branchesMenu } from './branchesMenu';
import { FaqRepository, SettingsRepository } from '../repositories';
import { formatFaq } from '../utils/formatters';
import { buildFaqPage } from '../utils/faqPagination';
import { MyContext } from '../types/context';

export const mainMenu = new Menu<MyContext>('main-menu')
  .text('🏠 درباره ما', async (ctx: any) => {
    try {
      const repo = new SettingsRepository(ctx.env.DB);
      const aboutText = await repo.getValue('about') || 'Welcome to Azadi Coffee! We are a local roastery with two branches.';
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
      const page = buildFaqPage(faqs, 0, 5);
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
