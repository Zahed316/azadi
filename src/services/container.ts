/**
 * ServiceContainer — wires together all modular services for the Azadi Coffee Bot.
 *
 * Handles dependency injection by constructing services in the correct order
 * and providing getter methods for each. The bot is created lazily on first
 * access.
 *
 * @module services/container
 */

import { Env, createBot } from '../bot';
import { CacheService } from './cache';
import { DataService } from './data';
import { AIService } from './ai';
import { BotService } from './bot';
import type { MyContext } from '../types/context';
import type { Bot } from 'grammy';

export class ServiceContainer {
  private cache: CacheService | null = null;
  private data: DataService;
  private ai: AIService;
  private bot: BotService | null = null;
  private botInstance: Bot<MyContext> | null = null;

  constructor(private env: Env) {
    // Initialize cache if KV binding is available
    if (env.CACHE) {
      this.cache = new CacheService(env.CACHE);
    }

    // Initialize data service (works with or without cache)
    this.data = new DataService(env.DB, this.cache ?? undefined);

    // Initialize AI service
    this.ai = new AIService(this.data, env.OPENCODE_API_KEY);
  }

  getCache(): CacheService | null {
    return this.cache;
  }

  getData(): DataService {
    return this.data;
  }

  getAI(): AIService {
    return this.ai;
  }

  /**
   * Get or create the BotService.
   * The bot is created lazily on first access.
   */
  getBotService(): BotService {
    if (!this.bot) {
      if (!this.botInstance) {
        this.botInstance = createBot(this.env);
      }
      this.bot = new BotService(this.botInstance);
    }
    return this.bot;
  }

  /**
   * Get the raw bot instance (for webhook handling).
   */
  getBotInstance(): Bot<MyContext> {
    return this.getBotService().getBot();
  }
}
