import { Bot } from 'grammy';
import { BranchRepository, ProductRepository } from '../repositories';
import { formatBranch, formatProduct } from '../utils/formatters';
import { MyContext } from '../types/context';

export function setupCallbackHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery(/^branch:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const id = parseInt(ctx.match[1]);
      const repo = new BranchRepository(ctx.env.DB);
      const branch = await repo.getBranchById(id);
      if (branch) {
        await ctx.reply(formatBranch(branch), { parse_mode: 'HTML' });
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
      await ctx.answerCallbackQuery();
      const id = parseInt(ctx.match[1]);
      const repo = new ProductRepository(ctx.env.DB);
      const product = await repo.getProductById(id);
      if (product) {
        await ctx.reply(formatProduct(product), { parse_mode: 'HTML' });
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
