// ---------------------------------------------------------------------------
// AI Admin Assistant — execute endpoint handler
//
// Validates and executes a write action that was previously proposed by the
// AI chat handler and confirmed by the admin via the frontend confirmation UI.
// ---------------------------------------------------------------------------

import type { D1Database } from '@cloudflare/workers-types';
import type { ICacheService } from '../../services/types';
import type { AiAction } from './types';
import { executeTool, type ExecutorContext } from './executor';

/** Request body for POST /api/ai/execute. */
export interface AiExecuteRequest {
  tool: string;
  params: Record<string, unknown>;
  conversationId?: string;
}

/** Response from POST /api/ai/execute. */
export interface AiExecuteResponse {
  action: AiAction;
}

/**
 * Handle a confirmed write action from the admin chat panel.
 *
 * This endpoint is called after the admin reviews a pending action
 * in the confirmation UI and clicks "Confirm". It validates the tool
 * name and parameters, then delegates to the existing executor.
 *
 * @param request  - Parsed execute request with tool name and params
 * @param db       - D1 database binding
 * @param cache    - Optional KV cache service
 * @returns The executed action result
 */
export async function handleAiExecute(
  request: AiExecuteRequest,
  db: D1Database,
  cache?: ICacheService,
): Promise<AiExecuteResponse> {
  // Validate tool name
  if (!request.tool || typeof request.tool !== 'string') {
    return {
      action: {
        type: 'unknown',
        result: 'error',
        error: 'tool is required',
      },
    };
  }

  // Validate params
  if (!request.params || typeof request.params !== 'object') {
    return {
      action: {
        type: request.tool,
        result: 'error',
        error: 'params is required and must be an object',
      },
    };
  }

  // Execute via the existing executor (100% reuse)
  const ctx: ExecutorContext = { db, cache };
  const action = await executeTool(request.tool, request.params, ctx);

  return { action };
}
