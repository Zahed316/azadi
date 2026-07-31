import { Bot, session } from "grammy";
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

  bot.use(session({ initial: () => ({}) }));
  bot.use(conversations());

  // Register Menus
  mainMenu.register(drinksNavMenu);
  mainMenu.register(beansMenu);
  mainMenu.register(branchesMenu);
  mainMenu.register(cakesMenu);
  
  bot.use(mainMenu);

  // Define commands
  bot.command(["start", "restart"], async (ctx) => {
    await ctx.conversation.exitAll();
    return ctx.reply("Welcome to Azadi Coffee Roastery! ☕\n\nHow can I help you today?", {
      reply_markup: mainMenu,
    });
  });

  bot.command("cancel", async (ctx) => {
    const active = ctx.conversation.active();
    const hasActive = Object.values(active).some(count => count > 0);
    if (hasActive) {
      await ctx.conversation.exitAll();
      await ctx.reply("❌ Cancelled. Use /start to return to the main menu.");
    } else {
      await ctx.reply("No active operation to cancel.");
    }
  });

  bot.command("help", (ctx) => {
    return ctx.reply("<b>Available commands:</b>\n\n/start - Open main menu\n/help - Show this help message\n\n<b>Admin commands:</b>\n/add_product - Add a product\n/update_stock - Update product stock\n/toggle_product - Toggle product availability\n/delete_product - Delete a product\n/list_products - List all products\n/add_faq - Add a FAQ\n/delete_faq - Delete a FAQ\n/add_branch - Add a branch\n/list_branches - List all branches", { parse_mode: "HTML" });
  });

  setupAdminCommands(bot, env);
  setupCallbackHandlers(bot);
  setupMessageHandlers(bot, env);

  return bot;
}
