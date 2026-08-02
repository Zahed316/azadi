import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { ProductRepository, MenuConfigRepository } from '../repositories';
import { MyContext } from '../types/context';

const VAT_NOTE = '\n\n<i>تمامی قیمت‌ها شامل ۱۰٪ مالیات بر ارزش افزوده می‌باشند.</i>';

export const drinksNavMenu = new Menu<MyContext>('drinks-nav-menu')
  .dynamic(async (ctx, range) => {
    try {
      const menuRepo = new MenuConfigRepository(ctx.env.DB);
      const configs = await menuRepo.getBySection('drinks');

      for (const config of configs) {
        const label = config.buttonLabel
          ?? `${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${config.categoryName}`;
        range.text(label, async (ctx) => {
          try {
            const pRepo = new ProductRepository(ctx.env.DB);
            const items = await pRepo.getProductsByCategory(config.categoryId);

            if (items.length === 0) {
              if (config.specialMessage) {
                await ctx.reply(config.specialMessage, { parse_mode: 'HTML' });
              } else {
                await ctx.reply(`در حال حاضر ${config.categoryName} موجود نیست.`);
              }
              return;
            }

            const kb = new InlineKeyboard();
            for (const p of items) {
              const priceLabel = p.priceOnRequest ? '(سوال در کافه)' : `${p.price} T`;
              const seasonal = p.isSeasonal ? ' 🌿' : '';
              kb.text(`${p.name}${seasonal} — ${priceLabel}`, `product:${p.id}`).row();
            }

            await ctx.reply(`<b>${config.categoryEmoji ? config.categoryEmoji + ' ' : ''}${config.categoryName}</b>${VAT_NOTE}`, { parse_mode: 'HTML', reply_markup: kb });
          } catch (e) {
            console.error(e);
            await ctx.answerCallbackQuery({ text: '❌ بارگذاری محصولات ناموفق بود.' }).catch(() => {});
          }
        }).row();
      }
    } catch (e) {
      console.error(e);
      range.text('❌ خطا در بارگذاری دسته‌بندی‌ها').row();
    }
  })
  .back('↩️ بازگشت');
