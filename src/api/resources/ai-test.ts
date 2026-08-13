import { runAiQuery } from '../../handlers/message';
import type { ResourceHandler } from './types';

interface AiTestBody {
  query?: string;
}

export const handleAiTest: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // POST /ai-test
  if (path === 'ai-test' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as AiTestBody;
    if (!body.query || typeof body.query !== 'string')
      return new Response(JSON.stringify({ error: 'query required' }), {
        status: 400,
        headers: corsHeaders,
      });
    try {
      const response = await runAiQuery(db, body.query, 'admin-test', env.OPENCODE_API_KEY);
      return new Response(JSON.stringify({ response }), { headers: corsHeaders });
    } catch (e: unknown) {
      console.error('ai-test error:', e);
      return new Response(JSON.stringify({ error: 'AI query failed' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return null;
};
