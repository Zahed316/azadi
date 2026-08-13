import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { branches as branchesTable, faq as faqTable } from '../database/schema';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { formatFaq } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { escapeHtml } from '../utils/htmlEscape';
import { mainMenu, getWelcomeText } from './mainMenu';
import { MyContext } from '../types/context';

export const infoMenu = new Menu<MyContext>('info-menu')
  .text('🏠 درباره ما', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.dataService, 'branches'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const [aboutText, branches] = await Promise.all([
        ctx.dataService.getSetting('about'),
        ctx.dataService.getAllBranches(),
      ]);
      const kb = new InlineKeyboard();
      const activeBranches = branches.filter(
        (b: typeof branchesTable.$inferSelect) => b.isActive !== false,
      );
      for (let i = 0; i < activeBranches.length; i++) {
        kb.text(`📍 ${activeBranches[i].name}`, `branch:${activeBranches[i].id}`);
        if (i % 2 === 1 || i === activeBranches.length - 1) kb.row();
      }
      const body = aboutText
        ? `<b>🏠 درباره ما</b>\n\n${escapeHtml(aboutText)}`
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
      if (!(await isMenuVisible(ctx.dataService, 'faq'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const faqs = await ctx.dataService.getAllFaqs();
      if (faqs.length === 0) {
        await ctx.reply('📭 هنوز سوالی ثبت نشده است.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const page = buildListPage(faqs, 0, 5);
      const text = page.items.map((f: typeof faqTable.$inferSelect) => formatFaq(f)).join('\n\n');
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
    const body = await getWelcomeText(ctx.dataService);
    await ctx
      .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu }));
  });
