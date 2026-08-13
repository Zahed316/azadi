import type { SessionData, MenuStackEntry } from '../types/context';

export type { MenuStackEntry };

// Alias used by tests
export type MessageStackEntry = MenuStackEntry;

const MAX_STACK_SIZE = 4;

/**
 * Push a new message onto the session's menu stack.
 * If the stack exceeds MAX_STACK_SIZE, the oldest entry is evicted and returned
 * so the caller can delete the actual Telegram message.
 */
export function pushMessage(
  session: SessionData,
  chatId: number,
  messageId: number,
  state: string,
): MenuStackEntry | null {
  if (!session.menuStack) {
    session.menuStack = [];
  }
  session.menuStack.push({ chatId, messageId, state, timestamp: Date.now() });
  // FIFO cleanup: remove oldest when exceeding limit
  let evicted: MenuStackEntry | null = null;
  while (session.menuStack.length > MAX_STACK_SIZE) {
    const old = session.menuStack.shift();
    if (old) evicted = old;
  }
  return evicted;
}

/**
 * Remove and return the most recent entry from the stack.
 * Returns null if the stack is empty or undefined.
 */
export function popMessage(session: SessionData): MenuStackEntry | null {
  if (!session.menuStack || session.menuStack.length === 0) return null;
  return session.menuStack.pop()!;
}

/**
 * Return the most recent entry without removing it.
 * Returns null if the stack is empty or undefined.
 */
export function getActiveMessage(session: SessionData): MenuStackEntry | null {
  if (!session.menuStack || session.menuStack.length === 0) return null;
  return session.menuStack[session.menuStack.length - 1];
}

/**
 * Return a shallow copy of the stack (for iteration without mutation).
 */
export function peekStack(session: SessionData): MenuStackEntry[] {
  return session.menuStack ? [...session.menuStack] : [];
}

/**
 * Delete a Telegram message, swallowing errors.
 */
export async function deleteMessage(
  api: { deleteMessage: (chatId: number, messageId: number) => Promise<unknown> },
  chatId: number,
  messageId: number,
): Promise<void> {
  try {
    await api.deleteMessage(chatId, messageId);
  } catch {
    // Message may already be deleted — safe to ignore
  }
}

/**
 * When stack exceeds MAX_STACK_SIZE, delete the oldest message from Telegram
 * and remove it from the stack.
 */
export async function cleanupOldMessages(
  api: { deleteMessage: (chatId: number, messageId: number) => Promise<unknown> },
  session: SessionData,
): Promise<void> {
  while (session.menuStack && session.menuStack.length > MAX_STACK_SIZE) {
    const oldest = session.menuStack[0];
    if (oldest) {
      await deleteMessage(api, oldest.chatId, oldest.messageId);
      session.menuStack.shift();
    }
  }
}

/**
 * Handle editMessageText failure with smart fallback:
 * - "message is not modified" → answerCallbackQuery with "Already showing this"
 * - Other errors → create new message via ctx.reply() and push to stack
 */
export async function handleEditFailure(
  ctx: {
    answerCallbackQuery: (opts?: { text?: string; show_alert?: boolean }) => Promise<unknown>;
    reply: (text: string, opts?: Record<string, unknown>) => Promise<{ message_id: number }>;
    session?: SessionData;
    chat?: { id: number };
  },
  newContent: string,
  opts: Record<string, unknown>,
  error: unknown,
): Promise<void> {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('message is not modified')) {
    await ctx
      .answerCallbackQuery({ text: 'Already showing this', show_alert: false })
      .catch(() => {});
    return;
  }

  // All other errors: create new message as fallback and track it
  const sent = await ctx.reply(newContent, opts).catch(() => null);
  if (sent && ctx.session && ctx.chat) {
    pushMessage(ctx.session, ctx.chat.id, sent.message_id, 'fallback');
  }
}
