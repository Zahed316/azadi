import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { BranchRepository } from '../repositories';
import { MyContext } from '../types/context';

export const branchesMenu = new Menu<MyContext>('branches-menu')
  .text('📍 مشاهده شعب', async (ctx) => {
    try {
      const repo = new BranchRepository(ctx.env.DB);
      const branches = await repo.getAllBranches();
      
      const kb = new InlineKeyboard();
      for (const b of branches) {
        kb.text(b.name, `branch:${b.id}`).row();
      }
      
      if (branches.length === 0) {
        await ctx.reply('در حال حاضر شعبه‌ای موجود نیست.');
      } else {
        await ctx.reply('یک شعبه انتخاب کنید:', { reply_markup: kb });
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ بارگذاری شعب ناموفق بود.' }).catch(() => {});
    }
  })
  .row()
  .back('↩️ بازگشت');
