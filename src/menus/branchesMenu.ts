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
import { BranchRepository, SettingsRepository } from '../repositories';
import { isMenuVisible, HIDDEN_MESSAGE } from '../utils/menuVisibility';
import { buildListPage } from '../utils/faqPagination';
import { mainMenu } from './mainMenu';
import { MyContext } from '../types/context';

const BRANCHES_PAGE_PREFIX = 'branches:page:';
const BRANCHES_PAGE_SIZE = 5;

export const branchesMenu = new Menu<MyContext>('branches-menu')
  .text('🏠 درباره ما', async (ctx) => {
    try {
      if (!(await isMenuVisible(ctx.env, 'branches'))) {
        await ctx.reply(HIDDEN_MESSAGE, {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }

      // Fetch about text and branches in parallel
      const [aboutText, branches] = await Promise.all([
        new SettingsRepository(ctx.env.DB).getValue('about'),
        new BranchRepository(ctx.env.DB).getAllBranches(),
      ]);

      // Build the about text section
      const aboutSection = aboutText
        ? `<b>🏠 درباره ما</b>\n\n${aboutText}`
        : '<b>🏠 درباره ما</b>';

      // Build keyboard: branch buttons (if any) + back button
      const kb = new InlineKeyboard();
      if (branches.length > 0) {
        // Show branches as buttons below the about text
        const activeBranches = branches.filter((b: any) => b.isActive !== false);
        for (const b of activeBranches) {
          kb.text(`📍 ${b.name}`, `branch:${b.id}`).row();
        }
      }

      const body = aboutText
        ? `<b>🏠 درباره ما</b>\n\n${aboutText}`
        : '<b>🏠 درباره ما</b>\n\nاطلاعاتی ثبت نشده است.';

      await ctx
        .editMessageText(body, { reply_markup: kb })
        .catch(() => ctx.reply(body, { reply_markup: kb }));
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
      .editMessageText(body, { reply_markup: mainMenu })
      .catch(() => ctx.reply(body, { reply_markup: mainMenu }));
  });
