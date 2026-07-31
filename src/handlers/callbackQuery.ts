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
        await ctx.reply("Branch not found.");
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ An error occurred' }).catch(() => {});
      await ctx.reply("❌ An error occurred while fetching branch details.");
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
        await ctx.reply("Product not found.");
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ An error occurred' }).catch(() => {});
      await ctx.reply("❌ An error occurred while fetching product details.");
    }
  });
}
