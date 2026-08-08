import { MessageRepository } from '../../repositories';
import type { ResourceHandler } from './types';

export const handleMessages: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // GET /messages/unread-count (must be before /messages/:id)
  if (path === 'messages/unread-count' && method === 'GET') {
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    const repo = new MessageRepository(db);
    const count = await repo.getUnreadCount();
    return new Response(JSON.stringify({ count }), { headers: corsHeaders });
  }

  // GET /messages (list all)
  if (path === 'messages' && method === 'GET') {
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    const repo = new MessageRepository(db);
    const messages = await repo.getAll();
    return new Response(JSON.stringify(messages), { headers: corsHeaders });
  }

  // GET /messages/:id (must not match /reply)
  if (path.startsWith('messages/') && method === 'GET' && !path.includes('/reply')) {
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    const id = parseInt(path.split('/')[1]);
    const repo = new MessageRepository(db);
    const message = await repo.getById(id);
    if (!message) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }
    // Mark as read
    if (!message.isRead) {
      await repo.markRead(id);
    }
    return new Response(JSON.stringify(message), { headers: corsHeaders });
  }

  // POST /messages/:id/reply
  if (path.match(/^messages\/\d+\/reply$/) && method === 'POST') {
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    const id = parseInt(path.split('/')[1]);
    const repo = new MessageRepository(db);
    const message = await repo.getById(id);
    if (!message) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const body: any = await request.json();
    if (!body.replyText || typeof body.replyText !== 'string') {
      return new Response(JSON.stringify({ error: 'replyText required (string)' }), {
        status: 400,
        headers: corsHeaders,
      });
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
        console.error('Telegram API error:', await telegramResponse.text());
      }
    } catch (e) {
      console.error('Failed to send Telegram reply:', e);
    }

    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  return null;
};
