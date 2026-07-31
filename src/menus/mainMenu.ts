import { Menu } from '@grammyjs/menu';
import { branchesMenu } from './branchesMenu';
import { FaqRepository, SettingsRepository } from '../repositories';
import { formatFaq } from '../utils/formatters';

export const mainMenu = new Menu('main-menu')
  .text('🏠 About Us', async (ctx: any) => {
    try {
      const repo = new SettingsRepository(ctx.env.DB);
      const aboutText = await repo.getValue('about') || 'Welcome to Azadi Coffee! We are a local roastery with two branches.';
      await ctx.reply(aboutText, { parse_mode: 'HTML' });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ Failed to load. Please try again.' }).catch(() => {});
    }
  })
  .submenu('☕ Drinks', 'drinks-nav-menu')
  .submenu('🌱 Coffee Beans', 'products-menu-beans')
  .row()
  .submenu('🍰 Cakes & Cookies', 'products-menu-cakes')
  .row()
  .submenu('📍 Branches', 'branches-menu')
  .text('❓ FAQ', async (ctx: any) => {
    try {
      const repo = new FaqRepository(ctx.env.DB);
      const faqs = await repo.getAll();
      if (faqs.length === 0) {
        await ctx.reply('No FAQs available.');
        return;
      }
      const text = faqs.map((f: any) => formatFaq(f)).join('\n\n');
      await ctx.reply(`<b>Frequently Asked Questions</b>\n\n${text}`, { parse_mode: 'HTML' });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ Failed to load. Please try again.' }).catch(() => {});
    }
  })
  .row()
  .text('🤖 Coffee Assistant', (ctx) => ctx.reply('I am your AI Coffee Assistant! 🤖☕\n\nAsk me anything about our coffee, brewing methods, branches, or anything else.', { parse_mode: 'HTML' }));
