import { Bot, InlineKeyboard } from 'grammy';
import { BranchRepository, ProductRepository, SettingsRepository } from '../repositories';
import { formatBranch, formatProduct, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { mainMenu } from '../menus/mainMenu';
import { MyContext } from '../types/context';

const backKeyboard = () => new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');

export function setupCallbackHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery('back:main', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.reply('منوی اصلی:', { reply_markup: mainMenu });
    } catch (e) {
      console.error(e);
    }
  });

  bot.callbackQuery(/^branch:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: '⏳ در حال بارگذاری...' });
      const id = parseInt(ctx.match[1]);
      const repo = new BranchRepository(ctx.env.DB);
      const branch = await repo.getBranchById(id);
      if (branch) {
        await ctx.reply(formatBranch(branch), { parse_mode: 'HTML', reply_markup: backKeyboard() });
      } else {
        await ctx.reply("شعبه مورد نظر یافت نشد.");
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
      await ctx.reply("❌ خطایی در دریافت اطلاعات شعبه رخ داد.");
    }
  });

  bot.callbackQuery(/^product:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: '⏳ در حال بارگذاری...' });
      const id = parseInt(ctx.match[1]);
      const repo = new ProductRepository(ctx.env.DB);
      const product = await repo.getProductById(id);
      if (product) {
        const priceUnit = (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
        await ctx.reply(formatProduct(product, priceUnit), { parse_mode: 'HTML', reply_markup: backKeyboard() });
      } else {
        await ctx.reply("محصول مورد نظر یافت نشد.");
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
      await ctx.reply("❌ خطایی در دریافت اطلاعات محصول رخ داد.");
    }
  });
}
