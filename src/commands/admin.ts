import { Bot, InlineKeyboard } from 'grammy';
import { adminAuth } from '../middlewares/auth';
import { MyContext } from '../types/context';
import { Env } from '../bot';

// Menu Website URL — public-facing, read-only menu for customers.
const MENU_WEB_APP_URL = 'https://azadi-menu.pages.dev';

export function setupAdminCommands(bot: Bot<MyContext>, _env: Env): void {
  bot.command('admin', adminAuth, async (ctx) => {
    const webAppUrl = 'https://azadi-admin.pages.dev';

    const keyboard = new InlineKeyboard().webApp('⚙️ پنل مدیریت', webAppUrl);

    await ctx.reply(
      'پنل مدیریت رستری قهوه آزادی:\nبرای مدیریت محصولات، موجودی و شعب، روی دکمه زیر کلیک کنید.',
      {
        reply_markup: keyboard,
      },
    );
  });

  // /menu — public command to open the menu website as a Telegram Web App.
  // No auth required — this is customer-facing.
  bot.command('menu', async (ctx) => {
    const keyboard = new InlineKeyboard().webApp('📋 منوی ازادی', MENU_WEB_APP_URL);

    await ctx.reply(
      'منوی کافه ازادی:\nبرای مشاهده منوی نوشیدنی‌ها، قهوه‌ها و کیک‌ها، روی دکمه زیر کلیک کنید.',
      {
        reply_markup: keyboard,
      },
    );
  });

  // /setup_bot — register all bot commands and set the menu button.
  // Only accessible to admins.
  bot.command('setup_bot', adminAuth, async (ctx) => {
    try {
      // Register the full command list — shows in Telegram's bot menu (/).
      await ctx.api.setMyCommands([
        { command: 'start', description: 'باز کردن منوی اصلی' },
        { command: 'menu', description: '📋 مشاهده منوی کافه' },
        { command: 'admin', description: 'پنل مدیریت (فقط ادمین)' },
      ]);

      // Set the chat menu button to show the bot command list.
      // The "/" button at the bottom of the chat opens a menu with all
      // registered commands (/start, /menu, /admin).
      await ctx.api.setChatMenuButton({
        menu_button: { type: 'commands' },
      });

      await ctx.reply(
        '✅ دستورات با موفقیت ثبت شدند.\n' +
        '📋 دکمه منوی پایین چت به وب‌اپ منو وصل شد.',
      );
    } catch (e: any) {
      await ctx.reply('❌ خطا در ثبت دستورات. لطفاً بعداً تلاش کنید.');
    }
  });
}
