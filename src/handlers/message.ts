import { Bot } from 'grammy';
import { AiService } from '../services/aiService';
import { MyContext } from '../types/context';
import { Env } from '../bot';
import { ProductRepository, BranchRepository, FaqRepository, AiLogRepository } from '../repositories';
import { buildMinimalContext } from '../utils/menuContext';

export function setupMessageHandlers(bot: Bot<MyContext>, env: Env) {
  bot.on('message:text', async (ctx) => {
    // If any admin conversation is active (e.g. /toggle_product waiting for an ID),
    // do NOT run the AI handler — let the conversation plugin handle this message.
    const activeConversations = ctx.conversation.active();
    if (Object.values(activeConversations).some(count => count > 0)) return;

    if (!ctx.message.text.startsWith('/')) {
      if (!ctx.env.AI) {
        return ctx.reply("دستیار هوشمند در حال حاضر غیرفعال است.");
      }
      
      try {
        await ctx.replyWithChatAction("typing").catch(() => {});
        const userId = String(ctx.from?.id);
        const db = ctx.env.DB;

        const [productsWithDetails, branches, faqs, recentLogs] = await Promise.all([
          new ProductRepository(db).getAllProductsWithDetails(),
          new BranchRepository(db).getAllBranches(),
          new FaqRepository(db).getAll(),
          new AiLogRepository(db).getRecentLogs(userId, 5)
        ]);

        const menuContext = buildMinimalContext(ctx.message.text, productsWithDetails, branches, faqs);
        
        const aiService = new AiService(ctx.env.AI, menuContext);
        
        const AI_TIMEOUT_MS = 20_000;
        const aiPromise = aiService.processQuery(ctx.message.text, userId, recentLogs);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS)
        );
        const answer = await Promise.race([aiPromise, timeoutPromise]);
        
        await ctx.reply(answer, { parse_mode: 'HTML' }).catch(() => {});

        const logRepo = new AiLogRepository(db);
        if (ctx.execCtx) {
          ctx.execCtx.waitUntil(logRepo.logConversation(userId, ctx.message.text, answer));
        } else {
          await logRepo.logConversation(userId, ctx.message.text, answer);
        }

      } catch (e: any) {
        console.error(e);
        if (e?.message === 'AI_TIMEOUT') {
          await ctx.reply("⏳ پاسخگویی دستیار هوشمند طول کشید. لطفاً کمی بعد دوباره تلاش کنید.", { parse_mode: 'HTML' });
        } else {
          await ctx.reply("❌ متأسفانه در پردازش درخواست شما خطایی رخ داد.", { parse_mode: 'HTML' });
        }
      }
    }
  });
}
