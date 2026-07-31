import { Menu } from '@grammyjs/menu';
import { InlineKeyboard } from 'grammy';
import { BranchRepository } from '../repositories';
import { MyContext } from '../types/context';

export const branchesMenu = new Menu<MyContext>('branches-menu')
  .text('📍 View Branches', async (ctx) => {
    try {
      const repo = new BranchRepository(ctx.env.DB);
      const branches = await repo.getAllBranches();
      
      const kb = new InlineKeyboard();
      for (const b of branches) {
        kb.text(b.name, `branch:${b.id}`).row();
      }
      
      if (branches.length === 0) {
        await ctx.reply('No branches currently available.');
      } else {
        await ctx.reply('Select a branch:', { reply_markup: kb });
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ Failed to load branches.' }).catch(() => {});
    }
  })
  .row()
  .back('↩️ Back');
