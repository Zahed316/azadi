import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository } from '../repositories';
import { MyContext } from '../types/context';

export const cakesMenu = new Menu<MyContext>('products-menu-cakes')
  .text('🍰 View Cakes & Cookies', async (ctx) => {
    try {
      const repo = new ProductRepository(ctx.env.DB);
      const products = await repo.getProductsByCategory(8); // 8 is Cakes
      
      const kb = new InlineKeyboard();
      for (const p of products) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      
      if (products.length === 0) {
        await ctx.reply('No cakes currently available.');
      } else {
        await ctx.reply('Select a cake or cookie:', { reply_markup: kb });
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ Failed to load cakes.' }).catch(() => {});
    }
  })
  .row()
  .back('↩️ Back');

export const beansMenu = new Menu<MyContext>('products-menu-beans')
  .text('🌱 View Coffee Beans', async (ctx) => {
    try {
      const repo = new ProductRepository(ctx.env.DB);
      const products = await repo.getProductsByCategory(2); // Assuming 2 is Beans
      
      const kb = new InlineKeyboard();
      for (const p of products) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      
      if (products.length === 0) {
        await ctx.reply('No beans currently available.');
      } else {
        await ctx.reply('Select coffee beans:', { reply_markup: kb });
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ Failed to load beans.' }).catch(() => {});
    }
  })
  .row()
  .back('↩️ Back');
