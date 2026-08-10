/**
 * BotService — modular monolith adapter for the Telegram bot service.
 *
 * Wraps an existing grammY {@link Bot} instance to satisfy the
 * {@link IBotService} interface consumed by the rest of the architecture.
 * The bot is created externally (via `createBot(env)`) and injected here —
 * this class handles only webhook processing and lifecycle.
 *
 * @module services/bot
 */

import { Bot, webhookCallback } from 'grammy';
import { IBotService } from '../types';
import type { MyContext } from '../../types/context';

export class BotService implements IBotService {
  private bot: Bot<MyContext>;

  /**
   * @param bot - A fully-configured grammY Bot instance (middleware, handlers,
   *   and menus already registered).
   */
  constructor(bot: Bot<MyContext>) {
    this.bot = bot;
  }

  /**
   * Process a Telegram update via webhook.
   * Uses `webhookCallback` with the `cloudflare-mod` adapter, matching
   * the runtime configuration in `src/index.ts`.
   *
   * @param request - The incoming webhook request from Telegram
   * @returns Response for Telegram (200 on success)
   */
  async handleWebhook(request: Request): Promise<Response> {
    const handleUpdate = webhookCallback(this.bot, 'cloudflare-mod', {
      timeoutMilliseconds: 25000,
    });
    return handleUpdate(request);
  }

  /**
   * Get the underlying grammY Bot instance.
   * Useful for testing, advanced configuration, or direct API access.
   */
  getBot(): Bot<MyContext> {
    return this.bot;
  }
}
