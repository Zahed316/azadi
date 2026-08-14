import { FavoritesRepository } from '../../repositories';
import { requireSuperAdmin, jsonSuccess, jsonError, noContent } from '../../utils/apiHelpers';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

export const handleFavorites: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, corsHeaders, url } = ctx;

  // GET /favorites
  if (path === 'favorites' && method === 'GET') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const groupBy = url.searchParams.get('groupBy') ?? 'user';
    if (groupBy !== 'user' && groupBy !== 'product') {
      return jsonError('Invalid groupBy', corsHeaders);
    }
    const repo = new FavoritesRepository(db);
    const favorites = await repo.listAllGrouped();
    return jsonSuccess({ favorites }, corsHeaders);
  }

  // DELETE /favorites/:telegramId/:productId
  const favDeleteMatch = url.pathname.match(/^\/api\/favorites\/([^/]+)\/([^/]+)$/);
  if (favDeleteMatch && method === 'DELETE') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const [, telegramId, productIdStr] = favDeleteMatch;
    const productIdResult = parseRequiredInt(productIdStr, 'productId');
    if (productIdResult instanceof Response) return productIdResult;
    const productId = productIdResult;
    const repo = new FavoritesRepository(db);
    const ok = await repo.remove(telegramId, productId);
    if (!ok) {
      return jsonSuccess({ ok: false }, corsHeaders, 404);
    }
    if (ctx.cache) {
      await ctx.cache.delete(`cache:favorites:${telegramId}`);
    }
    return noContent(corsHeaders);
  }

  return null;
};
