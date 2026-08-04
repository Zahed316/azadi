import { Bot, session, type SessionFlavor } from "grammy";
import { conversations } from "@grammyjs/conversations";
import { mainMenu } from "./menus/mainMenu";
import { beansMenu, cakesMenu } from "./menus/productsMenu";
import { drinksNavMenu } from "./menus/drinksNavMenu";
import { branchesMenu } from "./menus/branchesMenu";

import { setupAdminCommands } from "./commands/admin";
import { setupMessageHandlers } from "./handlers/message";
import { setupCallbackHandlers } from "./handlers/callbackQuery";
import { MyContext, SessionData } from "./types/context";
import { getEnv, getExecCtx } from "./requestContext";
import { D1SessionStorage } from "./database/sessionStorage";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  SECRET_TOKEN: string;
  DB: any;
  AI: any;
}

export function createBot(env: Env) {
  const bot = new Bot<MyContext>(env.TELEGRAM_BOT_TOKEN);

  bot.use(async (ctx, next) => {
    ctx.env = getEnv() || env;
    ctx.execCtx = getExecCtx();
    await next();
  });

  bot.use(session({
    initial: () => ({}) as SessionData,
    storage: new D1SessionStorage(env.DB),
  }));

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
  bot.use(conversations({
    storage: {
      type: "key",
      prefix: "convo_",
      adapter: new D1SessionStorage(env.DB),
    },
  }));

  // Register Menus
  mainMenu.register(drinksNavMenu);
  mainMenu.register(beansMenu);
  mainMenu.register(branchesMenu);
  mainMenu.register(cakesMenu);
  
  bot.use(mainMenu);

  // Define commands
  bot.command("start", async (ctx) => {
    await ctx.conversation.exitAll();
    return ctx.reply(
      "به روستری قهوه آزادی خوش آمدید! ☕\n\n" +
      "از منوی زیر می‌توانید نوشیدنی‌ها، دانه‌های قهوه، کیک و کوکی، شعب و سوالات متداول را ببینید.\n" +
      "یا همین‌جا سوالتان را بنویسید تا دستیار هوشمند پاسخ دهد. 🤖",
      { reply_markup: mainMenu }
    );
  });

  setupAdminCommands(bot, env);
  setupCallbackHandlers(bot);
  setupMessageHandlers(bot, env);

  return bot;
}
