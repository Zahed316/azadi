import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../bot';

/**
 * Shared context passed to every resource handler.
 */
export interface ResourceCtx {
  db: D1Database;
  isSuperAdmin: boolean;
  allowedCategoryId: number | null;
  telegramId: number; // Authenticated user's Telegram ID
  request: Request;
  corsHeaders: Record<string, string>;
  url: URL;
  env: Env;
}

/**
 * A resource handler tries to match the request path/method.
 * Returns a Response if it handled the route, or null to fall through.
 */
export type ResourceHandler = (
  method: string,
  path: string,
  ctx: ResourceCtx,
) => Promise<Response | null>;
