import { AiLogRepository } from '../../repositories';
import { parseBoundedInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

export const handleAiLogs: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, corsHeaders, url } = ctx;

  // GET /ai-logs
  if (path === 'ai-logs' && method === 'GET') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new AiLogRepository(db);
    const userId = url.searchParams.get('userId');
    const limitResult = parseBoundedInt(
      url.searchParams.get('limit') || undefined,
      'limit',
      1,
      200,
    );
    const limit = limitResult instanceof Response ? 50 : limitResult;
    const logs = userId ? await repo.getLogsByUser(userId, limit) : await repo.getAllLogs(limit);
    return new Response(JSON.stringify({ logs }), { headers: corsHeaders });
  }

  return null;
};
