import { AiLogRepository } from '../../repositories';
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
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const logs = userId
      ? await repo.getLogsByUser(userId, limit)
      : await repo.getAllLogs(limit);
    return new Response(JSON.stringify({ logs }), { headers: corsHeaders });
  }

  return null;
};
