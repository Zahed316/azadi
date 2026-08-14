import { getActiveMessage, pushMessage, handleEditFailure } from './menuLifecycle';
import type { MyContext } from '../types/context';

/**
 * Edit-or-send-or-fallback helper for Telegram message lifecycle.
 *
 * 1. If an active message exists on the session stack, try to edit it in place.
 *    On success the stack entry's state is updated.
 *    On failure, delegate to handleEditFailure (which replies as a fallback).
 * 2. If no active message, send a new reply, push it onto the stack,
 *    delete any evicted message from the stack limit, and invoke onSent.
 */
export async function editOrSend(
  ctx: MyContext,
  body: string,
  msgOpts: Record<string, unknown>,
  newState: string,
  onSent?: (messageId: number) => void,
): Promise<void> {
  const active = getActiveMessage(ctx.session);

  if (active) {
    try {
      await ctx.api.editMessageText(active.chatId, active.messageId, body, msgOpts);
      active.state = newState;
      return;
    } catch (e: unknown) {
      await handleEditFailure(ctx, body, msgOpts, e);
      return;
    }
  }

  const sent = await ctx.reply(body, msgOpts);
  const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, newState);

  if (evicted) {
    await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
  }

  if (onSent) {
    onSent(sent.message_id);
  }
}
