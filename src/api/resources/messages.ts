import { MessageRepository } from '../../repositories';
import { requireSuperAdmin, jsonSuccess, jsonError } from '../../utils/apiHelpers';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

interface MessageReplyBody {
  replyText?: string;
}

export const handleMessages: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // GET /messages/unread-count (must be before /messages/:id)
  if (path === 'messages/unread-count' && method === 'GET') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new MessageRepository(db);
    const count = await repo.getUnreadCount();
    return jsonSuccess({ count }, corsHeaders);
  }

  // GET /messages (list all)
  if (path === 'messages' && method === 'GET') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new MessageRepository(db);
    const messages = await repo.getAll();
    return jsonSuccess({ messages }, corsHeaders);
  }

  // GET /messages/:id (must not match /reply)
  if (path.startsWith('messages/') && method === 'GET' && !path.includes('/reply')) {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new MessageRepository(db);
    const message = await repo.getById(id);
    if (!message) {
      return jsonError('Not found', corsHeaders, 404);
    }
    // Mark as read
    if (!message.isRead) {
      await repo.markRead(id);
    }
    return jsonSuccess(message, corsHeaders);
  }

  // POST /messages/:id/reply
  if (path.match(/^messages\/\d+\/reply$/) && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new MessageRepository(db);
    const message = await repo.getById(id);
    if (!message) {
      return jsonError('Not found', corsHeaders, 404);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as MessageReplyBody;
    if (!body.replyText || typeof body.replyText !== 'string') {
      return jsonError('replyText required (string)', corsHeaders);
    }

    // Save reply to database
    await repo.markReplied(id, body.replyText);

    // Send reply via Telegram Bot API
    try {
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.telegramId,
            text: `💬 پاسخ ادمین:\n\n${body.replyText}`,
            parse_mode: 'HTML',
          }),
        },
      );

      if (!telegramResponse.ok) {
        await telegramResponse.text().catch(() => {});
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            operation: 'telegram-send-reply-error',
            status: telegramResponse.status,
            messageId: id,
          }),
        );
      }
    } catch (e) {
      console.error('Failed to send Telegram reply:', e);
    }

    return jsonSuccess({ success: true }, corsHeaders, 201);
  }

  return null;
};
