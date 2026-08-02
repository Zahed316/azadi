import { Bot, InlineKeyboard } from 'grammy';
import { BranchRepository, ProductRepository, SettingsRepository, FaqRepository } from '../repositories';
import { formatBranch, formatProduct, formatFaq, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { buildFaqPage } from '../utils/faqPagination';
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

  bot.callbackQuery(/^faq:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const faqs = await new FaqRepository(ctx.env.DB).getAll();
      const page = buildFaqPage(faqs, idx, 5);
      const text = page.items.map((f: any) => formatFaq(f)).join('\n\n');
      const kb = new InlineKeyboard();
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `faq:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `faq:page:${idx + 1}`);
      const body = `<b>سوالات متداول</b> (${page.pageLabel})\n\n${text}`;
      await ctx.editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
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
