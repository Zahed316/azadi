import { Env } from './bot';

let _execCtx: ExecutionContext | undefined;
let _env: Env | undefined;

export const setRequestContext = (env: Env, ctx: ExecutionContext) => {
  _env = env;
  _execCtx = ctx;
};

export const getExecCtx = () => _execCtx;
export const getEnv = () => _env;
