import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository } from '../repositories';
import { MyContext } from '../types/context';

export const cakesMenu = new Menu<MyContext>('products-menu-cakes')
  .text('🍰 مشاهده کیک و کوکی', async (ctx) => {
    try {
      const repo = new ProductRepository(ctx.env.DB);
      const products = await repo.getProductsByCategory(8); // 8 is Cakes
      
      const kb = new InlineKeyboard();
      for (const p of products) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      
      if (products.length === 0) {
        await ctx.reply('در حال حاضر کیک یا کوکی موجود نیست.');
      } else {
        await ctx.reply('یک کیک یا کوکی انتخاب کنید:', { reply_markup: kb });
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری کیک‌ها ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .back('↩️ بازگشت');

export const beansMenu = new Menu<MyContext>('products-menu-beans')
  .text('🌱 مشاهده دانه‌های قهوه', async (ctx) => {
    try {
      const repo = new ProductRepository(ctx.env.DB);
      const products = await repo.getProductsByCategory(9); // 9 is دانه‌های قهوه
      
      const kb = new InlineKeyboard();
      for (const p of products) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      
      if (products.length === 0) {
        await ctx.reply('در حال حاضر دانه قهوه موجود نیست.');
      } else {
        await ctx.reply('دانه قهوه مورد نظر را انتخاب کنید:', { reply_markup: kb });
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری دانه‌های قهوه ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .back('↩️ بازگشت');
