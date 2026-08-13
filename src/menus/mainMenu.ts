import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { FavoritesRepository, SettingsRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { toPersianDigits } from '../utils/numbers';
import { escapeHtml } from '../utils/htmlEscape';
import { MyContext } from '../types/context';
import type { Env } from '../bot';

const DEFAULT_WELCOME_TEXT =
  'به روستری قهوه آزادی خوش آمدید! ☕\n\n' +
  'از منوی زیر می‌توانید نوشیدنی‌ها، دانه‌های قهوه، کیک و کوکی، شعب و سوالات متداول را ببینید.\n\n' +
  '💬 <b>هر سوالی دارید همین‌جا بنویسید</b> — دستیار هوشمند قهوه درباره منو، قیمت‌ها، روش‌های دم‌آوری و هر چیز دیگری به شما پاسخ می‌دهد!';

/** Read welcome text from settings, falling back to the hardcoded default. */
export async function getWelcomeText(env: Env): Promise<string> {
  try {
    const repo = new SettingsRepository(env.DB);
    const value = await repo.getValue('welcome_message');
    // Escape admin-supplied text so HTML tags in the message don't break parse_mode: 'HTML'.
    // The hardcoded default is trusted and does not need escaping.
    return value ? escapeHtml(value) : DEFAULT_WELCOME_TEXT;
  } catch {
    return DEFAULT_WELCOME_TEXT;
  }
}

/** @deprecated Use getWelcomeText(env) instead. Kept for backward compatibility. */
export const MAIN_MENU_TEXT = DEFAULT_WELCOME_TEXT;

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
