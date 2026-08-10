/**
 * AIService — modular monolith adapter for the AI fallback service.
 *
 * Delegates to the existing {@link AiService} (OpenCode API) and
 * {@link buildMinimalContext} (menu context builder) while satisfying
 * the {@link IAIService} interface consumed by the rest of the architecture.
 *
 * @module services/ai
 */

import { IDataService, IAIService, AIContext } from '../types';
import { AiService } from '../../services/aiService';
import { buildMinimalContext } from '../../utils/menuContext';
import { DataService } from '../data';

export class AIService implements IAIService {
  constructor(
    private data: IDataService,
    private apiKey: string,
  ) {}

  async processQuery(
    query: string,
    userId: string,
    recentLogs: Array<{ question: string; response: string; timestamp: Date }>,
    userFavorites?: string[],
  ): Promise<string> {
    // Build context dynamically per query so data is always fresh
    const context = await this.buildContext(userId);

    // Create a new AiService instance with the fresh context
    const service = new AiService(this.apiKey, context);

    return service.processQuery(query, userId, recentLogs, userFavorites ?? []);
  }

  buildMenuContext(context: AIContext): string {
    return buildMinimalContext({
      query: '',
      productsWithDetails: context.productsWithDetails,
      branches: context.branches,
      faqs: context.faqs,
      visibleCategoryIds: context.visibleCategoryIds,
      settings: context.settings,
      popularProducts: context.popularProducts,
    });
  }

  private async buildContext(userId: string): Promise<string> {
    // Use D1 batch API to fetch all context data in a single round-trip
    const batchData = await (this.data as DataService).buildAIContextBatch(userId);

    return buildMinimalContext({
      query: '',
      productsWithDetails: batchData.products,
      branches: batchData.branches,
      faqs: batchData.faqs,
      visibleCategoryIds: new Set(batchData.menuConfig.map((m: any) => m.categoryId)),
      settings: batchData.about ? { about: batchData.about } : undefined,
      popularProducts: batchData.popularProducts,
    });
  }
}
