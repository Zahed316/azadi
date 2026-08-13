import { Env } from '../bot';
import { validateInitData } from './auth';
import { getAdminRole } from '../middlewares/auth';
import { getDb } from '../database/client';
import { settings } from '../database/schema';
import { CacheService } from '../services/cache';
import {
  handleAdmins,
  handleSettings,
  handleCategories,
  handleProducts,
  handleFaqs,
  handleBranches,
  handleMenuConfig,
  handleMessages,
  handleFavorites,
  handleAiLogs,
  handleAiTest,
  handleStreaks,
} from './resources';
import type { ResourceCtx, ResourceHandler } from './resources';

const ALLOWED_ORIGINS = [
  'https://azadi-admin.pages.dev',
  'https://azadi-menu.pages.dev',
  'https://web.telegram.org',
];

function getAllowedOrigin(origin: string | null): string {
  if (origin && ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

// Ordered list of resource handlers — first match wins.
// Resource handlers MUST be checked in order of specificity (longer/more-specific
// paths first) so that e.g. /products/batch matches before /products/:id.
const resourceHandlers: ResourceHandler[] = [
  handleAdmins,
  handleSettings,
  handleCategories,
  handleMessages,
  handleMenuConfig,
  handleProducts,
  handleFaqs,
  handleBranches,
  handleStreaks,
  handleFavorites,
  handleAiLogs,
  handleAiTest,
];

export async function handleApiRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', ''); // e.g. "products"
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': getAllowedOrigin(request.headers.get('Origin')),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': getAllowedOrigin(request.headers.get('Origin')),
    'Content-Type': 'application/json',
  };

  // --- Health check (no auth) ---
  if (path === 'health' && method === 'GET') {
    let dbOk = false;
    try {
      const testDb = getDb(env.DB);
      await testDb.select().from(settings).limit(1);
      dbOk = true;
    } catch {
      /* db unreachable */
    }
    return new Response(
      JSON.stringify({
        status: dbOk ? 'ok' : 'degraded',
        db: dbOk,
        timestamp: new Date().toISOString(),
      }),
      { headers: corsHeaders },
    );
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Telegram ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const initData = authHeader.replace('Telegram ', '');
  const user = await validateInitData(initData, env.TELEGRAM_BOT_TOKEN);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const adminRole = await getAdminRole(user.id, env.DB);
  if (!adminRole) {
    return new Response(JSON.stringify({ error: 'Forbidden: Not an admin' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  const isSuperAdmin = adminRole.role === 'super_admin';
  const allowedCategoryId = adminRole.categoryId;

  try {
    const db = env.DB;

    // Current User Info (inlined — no resource file needed)
    if (path === 'currentUser' && method === 'GET') {
      return new Response(JSON.stringify({ user: adminRole }), { headers: corsHeaders });
    }

    const resourceCtx: ResourceCtx = {
      db,
      isSuperAdmin,
      allowedCategoryId,
      telegramId: user.id,
      request,
      corsHeaders,
      url,
      env,
      cache: env.CACHE ? new CacheService(env.CACHE) : undefined,
    };

    for (const handler of resourceHandlers) {
      const response = await handler(method, path, resourceCtx);
      if (response) return response;
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        operation: 'api-error',
        method,
        path,
        error: errMsg,
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
