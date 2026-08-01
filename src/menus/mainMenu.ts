import { Menu } from '@grammyjs/menu';
import { branchesMenu } from './branchesMenu';
import { FaqRepository, SettingsRepository } from '../repositories';
import { formatFaq } from '../utils/formatters';
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
        await ctx.reply('سوال متداولی وجود ندارد.');
        return;
      }
      const text = faqs.map((f: any) => formatFaq(f)).join('\n\n');
      await ctx.reply(`<b>سوالات متداول</b>\n\n${text}`, { parse_mode: 'HTML' });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود. لطفاً دوباره امتحان کنید.' }).catch(() => {});
    }
  })
  .row()
  .text('🤖 دستیار هوشمند قهوه', (ctx) => ctx.reply('من دستیار هوشمند قهوه شما هستم! 🤖☕\n\nهر سوالی درباره قهوه، روش‌های دم‌آوری، شعب یا هر چیز دیگری دارید از من بپرسید.', { parse_mode: 'HTML' }));
