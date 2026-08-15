import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { escapeHtml } from '../utils/htmlEscape';
import { MyContext } from '../types/context';
import type { IDataService } from '../services/types';
import { pushMessage, popMessage, getActiveMessage } from '../utils/menuLifecycle';

const DEFAULT_WELCOME_TEXT =
  'به روستری قهوه آزادی خوش آمدید! ☕\n\n' +
  'از منوی زیر می‌توانید نوشیدنی‌ها، دانه‌های قهوه، کیک و کوکی، شعب و سوالات متداول را ببینید.\n\n' +
  '💬 <b>هر سوالی دارید همین‌جا بنویسید</b> — دستیار هوشمند قهوه درباره منو، قیمت‌ها، روش‌های دم‌آوری و هر چیز دیگری به شما پاسخ می‌دهد!';

/** Read welcome text from settings, falling back to the hardcoded default. */
export async function getWelcomeText(dataService: IDataService): Promise<string> {
  try {
    const value = await dataService.getSetting('welcome_message');
    // Escape admin-supplied text so HTML tags in the message don't break parse_mode: 'HTML'.
    // The hardcoded default is trusted and does not need escaping.
    return value ? escapeHtml(value) : DEFAULT_WELCOME_TEXT;
  } catch {
    return DEFAULT_WELCOME_TEXT;
  }
}

/** @deprecated Use getWelcomeText(dataService) instead. Kept for backward compatibility. */
export const MAIN_MENU_TEXT = DEFAULT_WELCOME_TEXT;

export const mainMenu = new Menu<MyContext>('main-menu')
  .submenu('🔍 کاوش', 'discover-menu')
  .row()
  .submenu('☕ نوشیدنی‌ها', 'drinks-nav-menu')
  .submenu('🌱 دانه‌های قهوه', 'products-menu-beans')
  .row()
  .submenu('🍰 کیک و کوکی', 'products-menu-cakes')
  .row()
  .submenu('ℹ️ اطلاعات', 'info-menu')
  .text('✉️ پیام به ما', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'messages'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      // Pop and delete the current menu message from Telegram before
      // sending the contact prompt — prevents the orphaned-menu-below bug.
      const active = getActiveMessage(ctx.session);
      if (active) {
        popMessage(ctx.session);
        await ctx.api.deleteMessage(active.chatId, active.messageId).catch(() => {});
      }

      ctx.session.messageFlow = { step: 'name' };
      const sent = await ctx.reply('نام شما چیست؟', {
        reply_markup: new InlineKeyboard()
          .text('⏭ ناشناس ارسال کن', 'rate:skip')
          .text('❌ انصراف', 'msg:cancel'),
      });
      const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'contact');
      if (evicted) {
        await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      await ctx.reply('خطا در ارتباط با سرور.');
    }
  });
