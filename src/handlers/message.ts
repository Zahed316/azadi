import { Bot } from 'grammy';
import { AiService } from '../services/aiService';
import { MyContext } from '../types/context';
import { Env } from '../bot';
import { ProductRepository, BranchRepository, FaqRepository, AiLogRepository, MenuConfigRepository } from '../repositories';
import { buildMinimalContext } from '../utils/menuContext';

export function setupMessageHandlers(bot: Bot<MyContext>, env: Env) {
  bot.on('message:text', async (ctx) => {
    // If an admin conversation was active before this message was processed,
    // do NOT run the AI handler. This prevents the final message of a completed 
    // conversation from leaking into the AI handler.
    if (ctx.hasActiveConversation) return;

    if (!ctx.message.text.startsWith('/')) {
      if (!ctx.env.AI) {
        return ctx.reply("دستیار هوشمند در حال حاضر غیرفعال است.");
      }
      
      try {
        const requestStartedAt = performance.now();
        await ctx.replyWithChatAction("typing").catch(() => {});
        const userId = String(ctx.from?.id);
        const db = ctx.env.DB;
        const productRepo = new ProductRepository(db);
        const branchRepo = new BranchRepository(db);
        const faqRepo = new FaqRepository(db);
        const aiLogRepo = new AiLogRepository(db);
        const menuConfigRepo = new MenuConfigRepository(db);

        const catalogStartedAt = performance.now();
        const [productsWithDetails, branches, faqs, recentLogs, visibleCategoryIds] = await Promise.all([
          productRepo.getAllProductsWithDetails(),
          branchRepo.getAllBranches(),
          faqRepo.getAll(),
          aiLogRepo.getRecentLogs(userId, 5),
          menuConfigRepo.getVisibleCategoryIds()
        ]);
        const catalogDuration = performance.now() - catalogStartedAt;

        const contextStartedAt = performance.now();
        const menuContext = buildMinimalContext(ctx.message.text, productsWithDetails, branches, faqs, visibleCategoryIds);
        const contextDuration = performance.now() - contextStartedAt;
        
        const aiService = new AiService(ctx.env.AI, menuContext);
        
        const AI_TIMEOUT_MS = 20_000;
        const aiStartedAt = performance.now();
        const aiPromise = aiService.processQuery(ctx.message.text, userId, recentLogs);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS)
        );
        const answer = await Promise.race([aiPromise, timeoutPromise]);
        const aiDuration = performance.now() - aiStartedAt;
        
        await ctx.reply(answer, { parse_mode: 'HTML' }).catch(() => {});

        if (ctx.execCtx) {
          ctx.execCtx.waitUntil(aiLogRepo.logConversation(userId, ctx.message.text, answer));
        } else {
          await aiLogRepo.logConversation(userId, ctx.message.text, answer);
        }

        if ((ctx.env as Env & { PERF_LOG?: string }).PERF_LOG === 'true') {
          console.log(JSON.stringify({ operation: 'ai-request-timing', catalogMs: Math.round(catalogDuration), contextMs: Math.round(contextDuration), aiMs: Math.round(aiDuration), totalMs: Math.round(performance.now() - requestStartedAt) }));
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
