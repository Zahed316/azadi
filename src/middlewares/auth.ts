import { NextFunction } from 'grammy';
import { MyContext } from '../types/context';

const ADMIN_IDS = [93792739]; // Added user ID

export async function adminAuth(ctx: MyContext, next: NextFunction) {
  if (ctx.from && ADMIN_IDS.includes(ctx.from.id)) {
    await next();
  } else {
    await ctx.reply("Unauthorized: You do not have admin permissions.");
  }
}
