import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { Env } from '../bot';

export interface SessionData {
  lastUpdateId?: number;
}

export type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor<Context> & {
  env: Env;
  execCtx?: ExecutionContext;
  hasActiveConversation?: boolean;
};
