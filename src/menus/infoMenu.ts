import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { BranchRepository, FaqRepository, SettingsRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { formatFaq } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { mainMenu } from './mainMenu';
import { MyContext } from '../types/context';

export const infoMenu = new Menu<MyContext>('info-menu')
  .text('🏠 درباره ما', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'branches'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const [aboutText, branches] = await Promise.all([
        new SettingsRepository(ctx.env.DB).getValue('about'),
        new BranchRepository(ctx.env.DB).getAllBranches(),
      ]);
      const kb = new InlineKeyboard();
      const activeBranches = branches.filter((b: any) => b.isActive !== false);
      for (const b of activeBranches) {
        kb.text(`📍 ${b.name}`, `branch:${b.id}`).row();
      }
      const body = aboutText
        ? `<b>🏠 درباره ما</b>\n\n${aboutText}`
        : '<b>🏠 درباره ما</b>\n\nاطلاعاتی ثبت نشده است.';
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود.' }).catch(() => {});
    }
  })
  .text('❓ سوالات متداول', async (ctx: MyContext) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'faq'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const repo = new FaqRepository(ctx.env.DB);
      const faqs = await repo.getAll();
      if (faqs.length === 0) {
        await ctx.reply('📭 هنوز سوالی ثبت نشده است.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const page = buildListPage(faqs, 0, 5);
      const text = page.items.map((f: any) => formatFaq(f)).join('\n\n');
      const kb = new InlineKeyboard();
      if (page.hasNext) kb.text('◀️ صفحه بعد', `faq:page:1`);
      const body = `<b>سوالات متداول</b> (${page.pageLabel})\n\n${text}`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .text('↩️ بازگشت', async (ctx) => {
    await ctx.answerCallbackQuery();
    const body = 'منوی اصلی:';
    await ctx
      .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu }));
  });
