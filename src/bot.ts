import { Bot, session } from 'grammy';
import { conversations } from '@grammyjs/conversations';
import { D1Database } from '@cloudflare/workers-types';
import { mainMenu } from './menus/mainMenu';
import { beansMenu, cakesMenu } from './menus/productsMenu';
import { drinksNavMenu } from './menus/drinksNavMenu';
import { branchesMenu } from './menus/branchesMenu';

import { setupAdminCommands } from './commands/admin';
import { setupMessageHandlers } from './handlers/message';
import { setupCallbackHandlers } from './handlers/callbackQuery';
import { MyContext, SessionData } from './types/context';
import { getEnv, getExecCtx } from './requestContext';
import { D1SessionStorage } from './database/sessionStorage';
import { UserStateRepository } from './repositories';
import { toPersianDigits } from './utils/numbers';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  SECRET_TOKEN: string;
  DB: D1Database;
  OPENCODE_API_KEY: string;
  // Optional runtime flags — kept loose so workers can be deployed without
  // them being present in wrangler.toml/[vars]. Set via `wrangler secret put`.
  USE_CONVERSATIONS?: string;
  PERF_LOG?: string;
  STREAK_MESSAGES?: string;
  STREAK_CRON_ENABLED?: string;
}

export function createBot(env: Env) {
  const bot = new Bot<MyContext>(env.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    ctx.env = getEnv() || env;
    ctx.execCtx = getExecCtx();
    await next();
  });

  // Streak counter: track consecutive-day visits and notify the user when the
  // streak increments. Env-gated so the middleware is inert by default; flip on
  // via `wrangler secret put STREAK_MESSAGES`. Never re-throw — streak path
  // must not break the rest of the bot chain.
  bot.use(async (ctx, next) => {
    if (ctx.from?.id && ctx.env.STREAK_MESSAGES === 'true') {
      try {
        const repo = new UserStateRepository(ctx.env.DB);
        const { streakDays, isNewStreak } = await repo.upsertVisit(String(ctx.from.id));
        if (isNewStreak && streakDays > 1) {
          // Defer: don't block the rest of the handler chain.
          ctx.execCtx?.waitUntil(
            ctx.reply(`🔥 ${toPersianDigits(streakDays)} روز متوالی از رستوری بازدید کردید!`).catch(() => {}),
          );
        }
      } catch (e) {
        console.error('streak middleware:', e);
        /* never break the chain */
      }
    }
    await next();
  });

  bot.use(
    session({
      initial: () => ({}),
      storage: new D1SessionStorage(env.DB),
    }),
  );

  // Ignore Telegram Webhook Retries (Idempotency)
  bot.use(async (ctx, next) => {
    if (ctx.update.update_id) {
      if (ctx.session?.lastUpdateId === ctx.update.update_id) {
        console.log(`Ignoring duplicate update: ${ctx.update.update_id}`);
        return; // Reject retry, do not process
      }
      if (ctx.session) {
        ctx.session.lastUpdateId = ctx.update.update_id;
      }
    }
    await next();
  });
  // Conversations framework is intentionally gated by USE_CONVERSATIONS — the
  // last admin wizard was removed in commit ea14c3f because per-request
  // conversation state leaked into the AI-fallback path on Telegram webhook
  // retries. Re-introduction must (a) flip USE_CONVERSATIONS to 'true' on the
  // Worker (`wrangler secret put USE_CONVERSATIONS`), and (b) add a guard
  // middleware here that snapshots `ctx.hasActiveConversation` BEFORE any
  // `createConversation()` is entered, AND a corresponding skip in
  // src/handlers/message.ts:9 — otherwise a wizard's final message will be
  // answered by the AI rather than the wizard's own handler.
  if (env.USE_CONVERSATIONS === 'true') {
    bot.use(
      conversations({
        storage: {
          type: 'key',
          prefix: 'convo_',
          adapter: new D1SessionStorage(env.DB),
        },
      }),
    );
  }

  // Register Menus
  mainMenu.register(drinksNavMenu);
  mainMenu.register(beansMenu);
  mainMenu.register(branchesMenu);
  mainMenu.register(cakesMenu);

  bot.use(mainMenu);

  // Define commands
  bot.command('start', async (ctx) => {
    // `ctx.conversation` is only populated when the conversations() middleware
    // is registered (see USE_CONVERSATIONS gate above). Guard so /start works
    // in both states — the framework is currently dormant.
    await ctx.conversation?.exitAll();
    return ctx.reply(
      'به روستری قهوه آزادی خوش آمدید! ☕\n\n' +
        'از منوی زیر می‌توانید نوشیدنی‌ها، دانه‌های قهوه، کیک و کوکی، شعب و سوالات متداول را ببینید.\n\n' +
        '💬 <b>هر سوالی دارید همین‌جا بنویسید</b> — دستیار هوشمند قهوه درباره منو، قیمت‌ها، روش‌های دم‌آوری و هر چیز دیگری به شما پاسخ می‌دهد!',
      { reply_markup: mainMenu, parse_mode: 'HTML' },
    );
  });

  setupAdminCommands(bot, env);
  setupCallbackHandlers(bot);
  setupMessageHandlers(bot, env);

  return bot;
}
