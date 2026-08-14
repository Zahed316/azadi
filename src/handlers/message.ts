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
} from '../repositories';
import { buildMinimalContext } from '../utils/menuContext';
import { checkAndSetCooldown } from '../utils/rateLimit';
import { getActiveMessage, handleEditFailure, pushMessage } from '../utils/menuLifecycle';

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

export function setupMessageHandlers(bot: Bot<MyContext>, _env: Env): void {
  // INJ-003: Sanitize AI HTML output to prevent phishing links or malformed HTML
  function sanitizeTelegramHtml(text: string): string {
    const ALLOWED_TAGS = ['b', 'i', 'u', 's', 'code', 'pre', 'a', 'tg-spoiler'];
    return text.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/gi, (match: string, tag: string) => {
      if (ALLOWED_TAGS.includes(tag.toLowerCase())) return match;
      return '';
    });
  }

  bot.on('message:text', async (ctx) => {
    // Handle multi-step message flow (feedback/contact/anonymous)
    if (ctx.session?.messageFlow) {
      const flow = ctx.session.messageFlow;
      const text = ctx.message.text;

      if (text === '/cancel') {
        ctx.session.messageFlow = undefined;
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const body = '❌ ارسال پیام لغو شد.';
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, body, {
              reply_markup: backKb,
            });
            active.state = 'cancelled';
            return;
          } catch (e) {
            await handleEditFailure(ctx, body, { reply_markup: backKb }, e);
            return;
          }
        }
        // No active message — create new
        const sent = await ctx.reply(body, { reply_markup: backKb });
        const evicted = pushMessage(ctx.session, ctx.chat.id, sent.message_id, 'cancelled');
        if (evicted) {
          await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
        }
        return;
      }

      if (flow.step === 'name') {
        const cancelKb = new InlineKeyboard().text('❌ انصراف', 'msg:cancel');
        let body: string;
        if (text === '/skip') {
          flow.isAnonymous = true;
          flow.step = 'content';
          body = 'پیام خود را بنویسید:';
        } else {
          flow.name = text;
          flow.step = 'content';
          body = `متشکرم ${text}! حالا پیام خود را بنویسید:`;
        }
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, body, {
              reply_markup: cancelKb,
            });
            return;
          } catch (e) {
            await handleEditFailure(ctx, body, { reply_markup: cancelKb }, e, 'name');
            return;
          }
        }
        await ctx.reply(body, { reply_markup: cancelKb });
        return;
      }

      if (flow.step === 'content') {
        flow.content = text;
        flow.step = 'rating';
        const ratingKb = new InlineKeyboard()
          .text('۱ ⭐', 'rate:1')
          .text('۲ ⭐', 'rate:2')
          .text('۳ ⭐', 'rate:3')
          .row()
          .text('۴ ⭐', 'rate:4')
          .text('۵ ⭐', 'rate:5')
          .row()
          .text('⏭ رد کردن', 'rate:skip');
        const body = 'آیا می‌خواهید امتیاز بدهید؟';
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, body, {
              reply_markup: ratingKb,
            });
            return;
          } catch (e) {
            await handleEditFailure(ctx, body, { reply_markup: ratingKb }, e, 'content');
            return;
          }
        }
        await ctx.reply(body, { reply_markup: ratingKb });
        return;
      }

      if (flow.step === 'rating') {
        const num = parseInt(text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
        if (text === '/skip' || isNaN(num)) {
          flow.rating = undefined;
        } else if (num >= 1 && num <= 5) {
          flow.rating = num;
        } else {
          // Invalid rating — re-prompt in-place
          const retryKb = new InlineKeyboard()
            .text('۱ ⭐', 'rate:1')
            .text('۲ ⭐', 'rate:2')
            .text('۳ ⭐', 'rate:3')
            .row()
            .text('۴ ⭐', 'rate:4')
            .text('۵ ⭐', 'rate:5')
            .row()
            .text('⏭ رد کردن', 'rate:skip');
          const retryBody = 'لطفاً عددی بین ۱ تا ۵ وارد کنید یا دکمه رد کردن را بزنید.';
          const active = getActiveMessage(ctx.session);
          if (active) {
            try {
              await ctx.api.editMessageText(active.chatId, active.messageId, retryBody, {
                reply_markup: retryKb,
              });
              return;
            } catch (e) {
              await handleEditFailure(ctx, retryBody, { reply_markup: retryKb }, e, 'rating');
              return;
            }
          }
          await ctx.reply(retryBody, { reply_markup: retryKb });
          return;
        }
        flow.step = 'confirm';
        const stars = flow.rating ? '⭐'.repeat(flow.rating) : 'بدون امتیاز';
        const nameLine = flow.isAnonymous ? 'ناشناس' : flow.name;
        const preview = `<b>پیش‌نمایش پیام:</b>\n\n👤 ${nameLine}\n⭐ ${stars}\n\n📝 ${flow.content}`;
        const confirmKb = new InlineKeyboard()
          .text('✅ ارسال', 'msg:confirm')
          .text('❌ انصراف', 'msg:cancel');
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, preview, {
              parse_mode: 'HTML',
              reply_markup: confirmKb,
            });
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              preview,
              { parse_mode: 'HTML', reply_markup: confirmKb },
              e,
              'confirm',
            );
            return;
          }
        }
        await ctx.reply(preview, { parse_mode: 'HTML', reply_markup: confirmKb });
        return;
      }
    }

    if (!ctx.message.text.startsWith('/')) {
      if (!ctx.env.OPENCODE_API_KEY) {
        return ctx.reply('دستیار هوشمند در حال حاضر غیرفعال است.');
      }

      // AI-001: In-memory per-user cooldown (replaces log-based check in AiService
      // which had a race condition via waitUntil). The log-based cooldown was bypassed
      // by concurrent requests because logs hadn't been written yet.
      const userId = String(ctx.from?.id);
      if (!checkAndSetCooldown(userId)) {
        return ctx.reply('⏳ لطفاً چند ثانیه صبر کنید و دوباره سؤال بپرسید.');
      }

      try {
        const requestStartedAt = performance.now();
        // Best-effort typing indicator — Telegram timeout is expected
        await ctx.replyWithChatAction('typing').catch(() => {});
        const aiLogRepo = new AiLogRepository(ctx.env.DB);

        const catalogStartedAt = performance.now();
        const batch = await ctx.dataService.buildAIContextBatch(userId);
        const catalogDuration = performance.now() - catalogStartedAt;

        const contextStartedAt = performance.now();
        const menuContext = buildMinimalContext({
          query: ctx.message.text,
          productsWithDetails: batch.products,
          branches: batch.branches,
          faqs: batch.faqs,
          visibleCategoryIds: undefined,
          settings: batch.about ? { about: batch.about } : undefined,
          popularProducts: batch.popularProducts,
        });
        const contextDuration = performance.now() - contextStartedAt;

        const aiService = new AiService(ctx.env.OPENCODE_API_KEY, menuContext);

        const AI_TIMEOUT_MS = 20_000;
        const aiStartedAt = performance.now();
        const aiPromise = aiService.processQuery(
          ctx.message.text,
          userId,
          batch.recentLogs,
          batch.favorites.map((f) => f.name),
        );
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
        const sanitizedReply = sanitizeTelegramHtml(replyText);
        await ctx.reply(sanitizedReply, { parse_mode: 'HTML' }).catch(async () => {
          await ctx.reply('⚠️ خطا در ارسال پاسخ').catch(() => {});
        });

        if (ctx.execCtx) {
          ctx.execCtx.waitUntil(
            aiLogRepo
              .logConversation(userId, ctx.message.text, answer)
              .catch((e) => console.error('AI log failed:', e)),
          );
        } else {
          await aiLogRepo
            .logConversation(userId, ctx.message.text, answer)
            .catch((e) => console.error('AI log failed:', e));
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            operation: 'ai-message-handler',
            error: msg,
          }),
        );
        if (msg === 'AI_TIMEOUT') {
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
