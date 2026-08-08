import { Bot, InlineKeyboard } from 'grammy';
import { adminAuth } from '../middlewares/auth';
import { MyContext } from '../types/context';
import { Env } from '../bot';

export function setupAdminCommands(bot: Bot<MyContext>, _env: Env): void {
  bot.command('admin', adminAuth, async (ctx) => {
    // We use a placeholder URL for now.
    // This should be the deployed URL of the React admin app.
    const webAppUrl = 'https://azadi-admin.pages.dev';

    const keyboard = new InlineKeyboard().webApp('⚙️ Open Admin Panel', webAppUrl);

    await ctx.reply(
      'پنل مدیریت رستری قهوه آزادی:\nبرای مدیریت محصولات، موجودی و شعب، روی دکمه زیر کلیک کنید.',
      {
        reply_markup: keyboard,
      },
    );
  });

  bot.command('setup_bot', adminAuth, async (ctx) => {
    try {
      await ctx.api.setMyCommands([
        { command: 'start', description: 'باز کردن منوی اصلی' },
        { command: 'admin', description: 'پنل مدیریت (فقط ادمین)' },
      ]);
      await ctx.reply('✅ دستورات با موفقیت ثبت شدند.');
    } catch (e: any) {
      await ctx.reply('❌ خطا در ثبت دستورات. لطفاً بعداً تلاش کنید.');
    }
  });
}
