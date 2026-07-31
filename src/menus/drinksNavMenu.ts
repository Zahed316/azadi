import { Menu, MenuRange } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository, CategoryRepository } from '../repositories';
import { MyContext } from '../types/context';

const VAT_NOTE = '\n\n<i>All prices include 10% VAT.</i>';

export const drinksNavMenu = new Menu<MyContext>('drinks-nav-menu')
  .dynamic(async (ctx, range) => {
    try {
      const catRepo = new CategoryRepository(ctx.env.DB);
      const categories = await catRepo.getAllCategories();
      
      // Exclude Cakes & Cookies (8), Beans (9), and Equipment (10)
      const drinkCategories = categories.filter((c: any) => ![8, 9, 10].includes(c.id));

      for (const cat of drinkCategories) {
        range.text(`${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}`, async (ctx) => {
          try {
            const pRepo = new ProductRepository(ctx.env.DB);
            const items = await pRepo.getProductsByCategory(cat.id);

            if (items.length === 0) {
              if (cat.id === 7) {
                await ctx.reply('☕ <b>Specialty Brew</b>\n\nAsk our barista for today\'s specialty brew selection.' + VAT_NOTE, { parse_mode: 'HTML' });
              } else {
                await ctx.reply(`No ${cat.name} currently available.`);
              }
              return;
            }

            const kb = new InlineKeyboard();
            for (const p of items) {
              const priceLabel = p.priceOnRequest ? '(Ask in store)' : `${p.price} T`;
              const seasonal = p.isSeasonal ? ' 🌿' : '';
              kb.text(`${p.name}${seasonal} — ${priceLabel}`, `product:${p.id}`).row();
            }

            await ctx.reply(`<b>${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}</b>${VAT_NOTE}`, { parse_mode: 'HTML', reply_markup: kb });
          } catch (e) {
            console.error(e);
            await ctx.answerCallbackQuery({ text: '❌ Failed to load products.' }).catch(() => {});
          }
        }).row();
      }
    } catch (e) {
      console.error(e);
      range.text('❌ Error loading categories').row();
    }
  })
  .back('↩️ Back');
