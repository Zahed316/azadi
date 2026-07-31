import { webhookCallback } from "grammy";
import { createBot, Env } from "./bot";
import { setRequestContext } from "./requestContext";

let botInstance: ReturnType<typeof createBot> | null = null;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const url = new URL(request.url);
      if (url.pathname !== "/webhook") {
        return new Response("Not found", { status: 404 });
      }

      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secret !== env.SECRET_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }

      setRequestContext(env, ctx);

      if (!botInstance) {
        botInstance = createBot(env);
      }
      
      const handleUpdate = webhookCallback(botInstance, "cloudflare-mod", { timeoutMilliseconds: 25000 });
      return await handleUpdate(request);
    } catch (err: any) {
      console.error(err);
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500 });
    }
  }
};
