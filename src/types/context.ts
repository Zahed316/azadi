import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { Env } from '../bot';

export interface SessionData {}

export type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor & {
  env: Env;
  execCtx?: ExecutionContext;
  hasActiveConversation?: boolean;
};
