import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { FavoritesRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { toPersianDigits } from '../utils/numbers';
import { MyContext } from '../types/context';

export const mainMenu = new Menu<MyContext>('main-menu')
  .submenu('🔍 کاوش', 'discover-menu')
  .text('⭐ منوهای من', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'favorites'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      if (!ctx.from?.id) return;
      const items = await new FavoritesRepository(ctx.env.DB).list(String(ctx.from.id));
      if (items.length === 0) {
        await ctx.reply('📭 هنوز محصولی به علاقمندی‌ها اضافه نکرده‌اید.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const kb = new InlineKeyboard();
      for (let i = 0; i < items.length; i++) {
        kb.text(items[i].name, `product:${items[i].id}`);
        if (i % 2 === 1 || i === items.length - 1) kb.row();
      }
      await ctx.reply(
        `<b>⭐ منوهای من</b> (${toPersianDigits(items.length)} مورد)\n\nبرای دیدن جزئیات هر مورد، روی آن بزنید.`,
        { parse_mode: 'HTML', reply_markup: kb },
      );
    } catch (e) {
      console.error(e);
    }
  })
  .row()
  .submenu('☕ نوشیدنی‌ها', 'drinks-nav-menu')
  .submenu('🌱 دانه‌های قهوه', 'products-menu-beans')
  .row()
  .submenu('🍰 کیک و کوکی', 'products-menu-cakes')
  .row()
  .submenu('ℹ️ اطلاعات', 'info-menu')
  .text('✉️ پیام به ما', async (ctx: any) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'messages'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      ctx.session.messageFlow = { step: 'name' };
      await ctx.reply('نام شما چیست؟', {
        reply_markup: new InlineKeyboard()
          .text('⏭ ناشناس ارسال کن', 'rate:skip')
          .text('❌ انصراف', 'msg:cancel'),
      });
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  });
