import { runAiQuery } from '../../handlers/message';
import { requireSuperAdmin, jsonSuccess, jsonError } from '../../utils/apiHelpers';
import type { ResourceHandler } from './types';

interface AiTestBody {
  query?: string;
}

export const handleAiTest: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // POST /ai-test
  if (path === 'ai-test' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as AiTestBody;
    if (!body.query || typeof body.query !== 'string')
      return jsonError('query required', corsHeaders);
    try {
      const response = await runAiQuery(db, body.query, 'admin-test', env.OPENCODE_API_KEY);
      return jsonSuccess({ response }, corsHeaders);
    } catch (e: unknown) {
      console.error('ai-test error:', e);
      return jsonError('AI query failed', corsHeaders, 500);
    }
  }

  return null;
};
