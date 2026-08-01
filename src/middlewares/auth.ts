import { NextFunction } from 'grammy';
import { MyContext } from '../types/context';
import { getDb } from '../database/client';
import { admins } from '../database/schema';
import { eq } from 'drizzle-orm';

export async function getAdminRole(userId: number, d1Binding: any) {
  const db = getDb(d1Binding);
  const result = await db.select().from(admins).where(eq(admins.telegramId, userId));
  return result[0] || null;
}

export async function isAdmin(userId?: number, d1Binding?: any): Promise<boolean> {
  if (userId === undefined || d1Binding === undefined) return false;
  const admin = await getAdminRole(userId, d1Binding);
  return admin !== null;
}

export async function adminAuth(ctx: MyContext, next: NextFunction) {
  if (ctx.from && await isAdmin(ctx.from.id, ctx.env.DB)) {
    await next();
  } else {
    await ctx.reply("Unauthorized: You do not have admin permissions.");
  }
}
