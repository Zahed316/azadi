import { handleAiChat as processAiChat } from '../ai/handler';
import type { AiChatRequest } from '../ai/types';
import { AiLogRepository } from '../../repositories';
import { requireSuperAdmin, jsonSuccess, jsonError } from '../../utils/apiHelpers';
import type { ResourceHandler } from './types';

/**
 * AI Chat resource handler — wires the AI chat backend into the admin REST API.
 *
 * POST /ai/chat — send a message to the AI assistant, get a reply + actions
 * GET  /ai/history — retrieve recent AI conversation logs
 */
export const handleAiChatRoute: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // --- POST /ai/chat ---
  if (path === 'ai/chat' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;

    if (!env.OPENCODE_API_KEY) {
      return jsonError('AI service not configured', corsHeaders, 500);
    }

    let body: AiChatRequest;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', corsHeaders);
    }

    if (!body.message || typeof body.message !== 'string') {
      return jsonError('message is required', corsHeaders);
    }

    const cache = ctx.cache;
    const response = await processAiChat(body, env.OPENCODE_API_KEY, db, cache);
    return jsonSuccess(response, corsHeaders);
  }

  // --- GET /ai/history ---
  if (path === 'ai/history' && method === 'GET') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;

    const repo = new AiLogRepository(db);
    const limitParam = ctx.url.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;
    const userId = ctx.url.searchParams.get('userId');

    const logs = userId ? await repo.getLogsByUser(userId, limit) : await repo.getAllLogs(limit);

    return jsonSuccess({ logs }, corsHeaders);
  }

  return null;
};
