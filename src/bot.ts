import { Bot, session, type SessionFlavor } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { mainMenu } from "./menus/mainMenu";
import { beansMenu, cakesMenu } from "./menus/productsMenu";
import { drinksNavMenu } from "./menus/drinksNavMenu";
import { branchesMenu } from "./menus/branchesMenu";

import { setupAdminCommands } from "./commands/admin";
import { setupMessageHandlers } from "./handlers/message";
import { setupCallbackHandlers } from "./handlers/callbackQuery";
import { MyContext } from "./types/context";
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
    initial: () => undefined as SessionData | undefined,
    storage: new D1SessionStorage(env.DB),
  }));
  bot.use(conversations({
    storage: {
      type: "key",
      prefix: "convo_",
      adapter: new D1SessionStorage(env.DB),
    },
  }));

  // Snapshot conversation state before any createConversation() runs.
  // createConversation() calls next() upon completion, which would otherwise
  // let the final message of a wizard leak into the global message handler.
  bot.use(async (ctx, next) => {
    const active = (ctx.conversation?.active() || {}) as Record<string, number>;
    ctx.hasActiveConversation = Object.values(active).some(count => count > 0);
    await next();
  });

  // Register Menus
  mainMenu.register(drinksNavMenu);
  mainMenu.register(beansMenu);
  mainMenu.register(branchesMenu);
  mainMenu.register(cakesMenu);
  
  bot.use(mainMenu);

  // Define commands
  bot.command(["start", "restart"], async (ctx) => {
    await ctx.conversation.exitAll();
    return ctx.reply("به روستری قهوه آزادی خوش آمدید! ☕\n\nچطور می‌توانم کمکتان کنم؟", {
      reply_markup: mainMenu,
    });
  });

  bot.command("cancel", async (ctx) => {
    const active = (ctx.conversation.active() || {}) as Record<string, number>;
    const hasActive = Object.values(active).some(count => count > 0);
    if (hasActive) {
      await ctx.conversation.exitAll();
      await ctx.reply("❌ لغو شد. برای بازگشت به منوی اصلی از /start استفاده کنید.");
    } else {
      await ctx.reply("هیچ عملیات فعالی برای لغو وجود ندارد.");
    }
  });

  bot.command("help", (ctx) => {
    return ctx.reply("<b>دستورات موجود:</b>\n\n/start - منوی اصلی\n/help - نمایش این پیام راهنما\n\n<b>دستورات مدیریت:</b>\n/add_product - افزودن محصول\n/update_stock - به‌روزرسانی موجودی\n/toggle_product - تغییر وضعیت محصول\n/delete_product - حذف محصول\n/list_products - لیست همه محصولات\n/add_faq - افزودن سوال متداول\n/delete_faq - حذف سوال متداول\n/add_branch - افزودن شعبه\n/delete_branch - حذف شعبه\n/list_branches - لیست شعب", { parse_mode: "HTML" });
  });

  setupAdminCommands(bot, env);
  setupCallbackHandlers(bot);
  setupMessageHandlers(bot, env);

  return bot;
}
