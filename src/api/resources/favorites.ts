import { FavoritesRepository } from '../../repositories';
import type { ResourceHandler } from './types';

export const handleFavorites: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, corsHeaders, url } = ctx;

  // GET /favorites
  if (path === 'favorites' && method === 'GET') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const groupBy = url.searchParams.get('groupBy') ?? 'user';
    if (groupBy !== 'user' && groupBy !== 'product') {
      return new Response(JSON.stringify({ error: 'Invalid groupBy' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const repo = new FavoritesRepository(db);
    const favorites = await repo.listAllGrouped();
    return new Response(JSON.stringify({ favorites }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  // DELETE /favorites/:telegramId/:productId
  const favDeleteMatch = url.pathname.match(/^\/api\/favorites\/([^/]+)\/([^/]+)$/);
  if (favDeleteMatch && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const [, telegramId, productIdStr] = favDeleteMatch;
    const productId = parseInt(productIdStr, 10);
    if (Number.isNaN(productId)) {
      return new Response(JSON.stringify({ error: 'Invalid productId' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const repo = new FavoritesRepository(db);
    const ok = await repo.remove(telegramId, productId);
    if (!ok) {
      return new Response(JSON.stringify({ ok: false }), { status: 404, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }

  return null;
};
