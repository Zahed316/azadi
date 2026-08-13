import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor } from '@grammyjs/conversations';
import { Env } from '../bot';
import type { IDataService } from '../services/types';

export interface MenuStackEntry {
  chatId: number;
  messageId: number;
  state: string; // 'main', 'discover', 'featured', 'product:123', etc.
  timestamp: number;
}

export interface SessionData {
  lastUpdateId?: number;
  messageFlow?: {
    step: 'name' | 'content' | 'rating' | 'confirm';
    name?: string;
    content?: string;
    rating?: number;
    isAnonymous?: boolean;
  };
  menuStack?: MenuStackEntry[];
}

export type MyContext = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor<Context> & {
    env: Env;
    execCtx?: ExecutionContext;
    dataService: IDataService;
  };
