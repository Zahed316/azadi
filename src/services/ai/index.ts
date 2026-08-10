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
    const [products, branches, faqs, visibleCategoryIds, about, userFavorites, popularProducts] =
      await Promise.all([
        this.data.getAllProductsWithDetails(),
        this.data.getActiveBranches(),
        this.data.getAllFaqs(),
        this.data.getVisibleCategoryIds(),
        this.data.getSetting('about'),
        this.data.getUserFavorites(userId),
        this.data.getPopularProducts(5),
      ]);

    return buildMinimalContext({
      query: '',
      productsWithDetails: products,
      branches,
      faqs,
      visibleCategoryIds,
      settings: about ? { about } : undefined,
      popularProducts,
    });
  }
}
