import { Env } from './bot';

/**
 * Module-level request context.
 *
 * SAFETY: Workers process one request at a time per isolate, and the
 * webhook path (the only consumer) is synchronous from setRequestContext
 * through webhookCallback. However, concurrent requests CAN overlap at
 * await points — this pattern is safe ONLY because:
 *   1. setRequestContext is called immediately before a synchronous flow
 *   2. getExecCtx/getEnv are only consumed within that same flow
 *
 * If you need request context elsewhere (e.g., API routes), pass env/ctx
 * through MyContext middleware — do NOT add more getEnv/getExecCtx callsites.
 */
let _execCtx: ExecutionContext | undefined;
let _env: Env | undefined;

export const setRequestContext = (env: Env, ctx: ExecutionContext): void => {
  _env = env;
  _execCtx = ctx;
};

export const getExecCtx = (): ExecutionContext | undefined => _execCtx;
export const getEnv = (): Env | undefined => _env;
