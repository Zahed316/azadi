import { Bot, session } from 'grammy';
import { conversations } from '@grammyjs/conversations';
import { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { mainMenu, getWelcomeText } from './menus/mainMenu';
import { discoverMenu } from './menus/discoverMenu';
import { infoMenu } from './menus/infoMenu';
import { beansMenu, cakesMenu } from './menus/productsMenu';
import { drinksNavMenu } from './menus/drinksNavMenu';

import { setupAdminCommands } from './commands/admin';
import { setupMessageHandlers } from './handlers/message';
import { setupCallbackHandlers } from './handlers/callbackQuery';
import { MyContext } from './types/context';
import { getEnv, getExecCtx } from './requestContext';
import { D1SessionStorage } from './database/sessionStorage';
import { ConditionalSessionStorage } from './database/conditionalSessionStorage';
import { DataService } from './services/data';
import { CacheService } from './services/cache';
import { pushMessage } from './utils/menuLifecycle';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  SECRET_TOKEN: string;
  DB: D1Database;
  OPENCODE_API_KEY: string;
  // Optional KV binding — may not be bound yet in all environments.
  CACHE?: KVNamespace;
  // Optional runtime flags — kept loose so workers can be deployed without
  // them being present in wrangler.toml/[vars]. Set via `wrangler secret put`.
  USE_CONVERSATIONS?: string;
  PERF_LOG?: string;
}

export function createBot(env: Env): Bot<MyContext> {
  const bot = new Bot<MyContext>(env.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    ctx.env = getEnv() || env;
    ctx.execCtx = getExecCtx();
    ctx.dataService = new DataService(
      ctx.env.DB,
      ctx.env.CACHE ? new CacheService(ctx.env.CACHE) : undefined,
    );
    await next();
  });

  bot.use(
    session({
      initial: () => ({}),
      storage: new ConditionalSessionStorage(env.DB),
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
  mainMenu.register(discoverMenu);
  mainMenu.register(infoMenu);
  mainMenu.register(drinksNavMenu);
  mainMenu.register(beansMenu);
  mainMenu.register(cakesMenu);

  bot.use(mainMenu);

  // Define commands
  bot.command('start', async (ctx) => {
    // Force-overwrite Telegram's cached command list to clear stale commands
    // (e.g. a deprecated /help from an earlier deployment). Safe to call on
    // every /start — idempotent and cheap.
    await ctx.api
      .setMyCommands([
        { command: 'start', description: 'باز کردن منوی اصلی' },
        { command: 'menu', description: '📋 مشاهده منوی کافه' },
        { command: 'admin', description: 'پنل مدیریت (فقط ادمین)' },
      ])
      .catch(() => {});
    // Set the chat menu button to show the bot command list.
    // The "/" button at the bottom of the chat opens a menu with all
    // registered commands (/start, /menu, /admin) instead of a Web App.
    await ctx.api
      .setChatMenuButton({
        menu_button: { type: 'commands' },
      })
      .catch(() => {});
    // `ctx.conversation` is only populated when the conversations() middleware
    // is registered (see USE_CONVERSATIONS gate above). Guard so /start works
    // in both states — the framework is currently dormant.
    await ctx.conversation?.exitAll();
    const sent = await ctx.reply(await getWelcomeText(ctx.dataService), {
      reply_markup: mainMenu,
      parse_mode: 'HTML',
    });
    const evicted = pushMessage(ctx.session, ctx.chat.id, sent.message_id, 'main');
    if (evicted) {
      await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
    }
  });

  setupAdminCommands(bot, env);
  setupCallbackHandlers(bot);
  setupMessageHandlers(bot, env);

  return bot;
}
