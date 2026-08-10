import { webhookCallback } from 'grammy';
import { createBot, Env } from './bot';
import { setRequestContext } from './requestContext';
import { handleApiRequest } from './api/router';
import { sweepStreaks } from './scripts/streaks';
import { ServiceContainer } from './services/container';

let botInstance: ReturnType<typeof createBot> | null = null;
let serviceContainer: ServiceContainer | null = null;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestStart = performance.now();
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // Initialize service container (cached across requests in same isolate)
    if (!serviceContainer) {
      serviceContainer = new ServiceContainer(env);
    }

    try {
      if (path.startsWith('/api/')) {
        const response = await handleApiRequest(request, env, ctx);
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          method,
          path,
          status: response.status,
          ms: Math.round(performance.now() - requestStart),
        }));
        return response;
      }

      if (path !== '/webhook') {
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          method,
          path,
          status: 404,
          ms: Math.round(performance.now() - requestStart),
        }));
        return new Response('Not found', { status: 404 });
      }

      if (method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secret !== env.SECRET_TOKEN) {
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          method,
          path,
          status: 401,
          reason: 'invalid-secret',
          ms: Math.round(performance.now() - requestStart),
        }));
        return new Response('Unauthorized', { status: 401 });
      }

      setRequestContext(env, ctx);

      if (!botInstance) {
        botInstance = createBot(env);
        console.log(JSON.stringify({
          ts: new Date().toISOString(),
          operation: 'bot-init',
          streakEnabled: env.STREAK_MESSAGES === 'true',
          conversationsEnabled: env.USE_CONVERSATIONS === 'true',
        }));
      }

      const handleUpdate = webhookCallback(botInstance, 'cloudflare-mod', {
        timeoutMilliseconds: 25000,
      });
      const response = await handleUpdate(request);
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        method,
        path,
        status: response.status,
        ms: Math.round(performance.now() - requestStart),
      }));
      return response;
    } catch (err: unknown) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        method,
        path,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }));
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
  async scheduled(event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const start = performance.now();
    try {
      await sweepStreaks(env);
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        operation: 'streak-sweep',
        status: 'ok',
        ms: Math.round(performance.now() - start),
      }));
    } catch (e) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        operation: 'streak-sweep',
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
        ms: Math.round(performance.now() - start),
      }));
    }
  },
};
