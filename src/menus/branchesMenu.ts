/**
 * Branches menu — paginated list of all branches.
 *
 * Callback namespace decision: the single-branch detail handler lives at
 * `branch:{id}` (singular). To avoid any chance of a small id colliding with
 * the pagination prefix, the paginated "list" callback uses the **plural**
 * prefix `branches:page:{N}`. So:
 *   `branch:42`     → show branch detail (existing handler in callbackQuery.ts)
 *   `branches:page:0`  → show first page of branch list
 *   `branches:page:1`  → show second page
 */
import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { BranchRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { buildListPage } from '../utils/faqPagination';
import { MyContext } from '../types/context';

const BRANCHES_PAGE_PREFIX = 'branches:page:';
const BRANCHES_PAGE_SIZE = 5;

export const branchesMenu = new Menu<MyContext>('branches-menu')
  .text('📍 مشاهده شعب', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'branches'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }
      const repo = new BranchRepository(ctx.env.DB);
      const branches = await repo.getActiveBranches();

      if (branches.length === 0) {
        await ctx.reply('📭 در حال حاضر شعبه‌ای موجود نیست.');
        return;
      }

      const page = buildListPage(branches, 0, BRANCHES_PAGE_SIZE);
      const kb = new InlineKeyboard();
      for (const b of page.items) {
        kb.text(b.name, `branch:${b.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `${BRANCHES_PAGE_PREFIX}${0 - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `${BRANCHES_PAGE_PREFIX}${0 + 1}`);

      const body = `<b>شعب</b> (${page.pageLabel})\n\nیک شعبه انتخاب کنید:`;
      await ctx
        .editMessageText(body, { reply_markup: kb })
        .catch(() => ctx.reply(body, { reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری شعب ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .back('↩️ بازگشت');
