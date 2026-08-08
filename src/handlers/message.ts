import { Bot, InlineKeyboard } from 'grammy';
import { AiService } from '../services/aiService';
import { MyContext } from '../types/context';
import { Env } from '../bot';
import type { D1Database } from '@cloudflare/workers-types';
import {
  ProductRepository,
  BranchRepository,
  FaqRepository,
  AiLogRepository,
  MenuConfigRepository,
  SettingsRepository,
  FavoritesRepository,
} from '../repositories';
import { buildMinimalContext } from '../utils/menuContext';

/**
 * Run an AI query against the Azadi context without bot-specific plumbing.
 * Used by the admin AI Test Panel endpoint (POST /api/ai-test).
 */
export async function runAiQuery(
  db: D1Database,
  query: string,
  userId: string = 'admin-test',
  apiKey: string = '',
): Promise<string> {
  const productRepo = new ProductRepository(db);
  const branchRepo = new BranchRepository(db);
  const faqRepo = new FaqRepository(db);
  const menuConfigRepo = new MenuConfigRepository(db);
  const settingsRepo = new SettingsRepository(db);

  const [productsWithDetails, branches, faqs, visibleCategoryIds, aboutSetting, popularProducts] =
    await Promise.all([
      productRepo.getAllProductsWithDetails(),
      branchRepo.getActiveBranches(),
      faqRepo.getAll(),
      menuConfigRepo.getVisibleCategoryIds(),
      settingsRepo.getValue('about'),
      productRepo.getPopularProducts(5),
    ]);

  const menuContext = buildMinimalContext({
    query,
    productsWithDetails,
    branches,
    faqs,
    visibleCategoryIds,
    settings: aboutSetting ? { about: aboutSetting } : undefined,
    popularProducts,
  });

  const aiService = new AiService(apiKey, menuContext);
  return aiService.processQuery(query, userId, [], []);
}

export function setupMessageHandlers(bot: Bot<MyContext>, _env: Env) {
  bot.on('message:text', async (ctx) => {
    // Handle multi-step message flow (feedback/contact/anonymous)
    if (ctx.session?.messageFlow) {
      const flow = ctx.session.messageFlow;
      const text = ctx.message.text;

      if (text === '/cancel') {
        ctx.session.messageFlow = undefined;
        await ctx.reply('❌ ارسال پیام لغو شد.', {
          reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
        });
        return;
      }

      if (flow.step === 'name') {
        if (text === '/skip') {
          flow.isAnonymous = true;
          flow.step = 'content';
          await ctx.reply('پیام خود را بنویسید:');
        } else {
          flow.name = text;
          flow.step = 'content';
          await ctx.reply(`متشکرم ${text}! حالا پیام خود را بنویسید:`);
        }
        return;
      }

      if (flow.step === 'content') {
        flow.content = text;
        flow.step = 'rating';
        await ctx.reply('آیا می‌خواهید امتیاز بدهید؟\n(عدد ۱ تا ۵ وارد کنید یا /skip برای رد کردن)', {
          reply_markup: new InlineKeyboard()
            .text('۱ ⭐', 'rate:1')
            .text('۲ ⭐', 'rate:2')
            .text('۳ ⭐', 'rate:3')
            .row()
            .text('۴ ⭐', 'rate:4')
            .text('۵ ⭐', 'rate:5')
            .row()
            .text('⏭ رد کردن', 'rate:skip'),
        });
        return;
      }

      if (flow.step === 'rating') {
        const num = parseInt(text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
        if (text === '/skip' || isNaN(num)) {
          flow.rating = undefined;
        } else if (num >= 1 && num <= 5) {
          flow.rating = num;
        } else {
          await ctx.reply('لطفاً عددی بین ۱ تا ۵ وارد کنید یا /skip بزنید.');
          return;
        }
        flow.step = 'confirm';
        const stars = flow.rating ? '⭐'.repeat(flow.rating) : 'بدون امتیاز';
        const nameLine = flow.isAnonymous ? 'ناشناس' : flow.name;
        await ctx.reply(
          `<b>پیش‌نمایش پیام:</b>\n\n👤 ${nameLine}\n⭐ ${stars}\n\n📝 ${flow.content}`,
          {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard()
              .text('✅ ارسال', 'msg:confirm')
              .text('❌ انصراف', 'msg:cancel'),
          },
        );
        return;
      }
    }

    if (!ctx.message.text.startsWith('/')) {
      if (!ctx.env.OPENCODE_API_KEY) {
        return ctx.reply('دستیار هوشمند در حال حاضر غیرفعال است.');
      }

      try {
        const requestStartedAt = performance.now();
        await ctx.replyWithChatAction('typing').catch(() => {});
        const userId = String(ctx.from?.id);
        const db = ctx.env.DB;
        const productRepo = new ProductRepository(db);
        const branchRepo = new BranchRepository(db);
        const faqRepo = new FaqRepository(db);
        const aiLogRepo = new AiLogRepository(db);
        const menuConfigRepo = new MenuConfigRepository(db);
        const settingsRepo = new SettingsRepository(db);
        const favoritesRepo = new FavoritesRepository(db);

        const catalogStartedAt = performance.now();
        const [productsWithDetails, branches, faqs, recentLogs, visibleCategoryIds, aboutSetting, userFavorites, popularProducts] =
          await Promise.all([
            productRepo.getAllProductsWithDetails(),
            branchRepo.getActiveBranches(),
            faqRepo.getAll(),
            aiLogRepo.getRecentLogs(userId, 5),
            menuConfigRepo.getVisibleCategoryIds(),
            settingsRepo.getValue('about'),
            favoritesRepo.list(userId).then((rows) => rows.map((r) => r.name)),
            productRepo.getPopularProducts(5),
          ]);
        const catalogDuration = performance.now() - catalogStartedAt;

        const contextStartedAt = performance.now();
        const menuContext = buildMinimalContext({
          query: ctx.message.text,
          productsWithDetails,
          branches,
          faqs,
          visibleCategoryIds,
          settings: aboutSetting ? { about: aboutSetting } : undefined,
          popularProducts,
        });
        const contextDuration = performance.now() - contextStartedAt;

        const aiService = new AiService(ctx.env.OPENCODE_API_KEY, menuContext);

        const AI_TIMEOUT_MS = 20_000;
        const aiStartedAt = performance.now();
        const aiPromise = aiService.processQuery(ctx.message.text, userId, recentLogs, userFavorites);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS),
        );
        const answer = await Promise.race([aiPromise, timeoutPromise]);
        const aiDuration = performance.now() - aiStartedAt;

        const MAX_TELEGRAM_MSG = 4096;
        let replyText = answer;
        if (replyText.length > MAX_TELEGRAM_MSG) {
          replyText = replyText.slice(0, MAX_TELEGRAM_MSG - 20) + '\n\n… (پاسخ خلاصه شد)';
        }
        await ctx.reply(replyText, { parse_mode: 'HTML' }).catch(() => {});

        if (ctx.execCtx) {
          ctx.execCtx.waitUntil(aiLogRepo.logConversation(userId, ctx.message.text, answer));
        } else {
          await aiLogRepo.logConversation(userId, ctx.message.text, answer);
        }

        if (ctx.env.PERF_LOG === 'true') {
          console.log(
            JSON.stringify({
              operation: 'ai-request-timing',
              catalogMs: Math.round(catalogDuration),
              contextMs: Math.round(contextDuration),
              aiMs: Math.round(aiDuration),
              totalMs: Math.round(performance.now() - requestStartedAt),
            }),
          );
        }
      } catch (e: any) {
        console.error(e);
        if (e?.message === 'AI_TIMEOUT') {
          await ctx.reply('⏳ پاسخگویی دستیار هوشمند طول کشید. لطفاً کمی بعد دوباره تلاش کنید.', {
            parse_mode: 'HTML',
          });
        } else {
          await ctx.reply('❌ متأسفانه در پردازش درخواست شما خطایی رخ داد.', {
            parse_mode: 'HTML',
          });
        }
      }
    }
  });
}
