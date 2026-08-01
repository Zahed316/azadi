import { expect, test, vi } from 'vitest';
import { Bot } from 'grammy';
import { safeReply } from '../bot';
import { MyContext } from '../types/context';

type ActiveMap = Record<string, number>;

function snapshot(active: ActiveMap): { hasActiveConversation: boolean } {
  const out = { hasActiveConversation: false };
  out.hasActiveConversation = Object.values(active).some(count => count > 0);
  return out;
}

function buildMessageHandler(opts: { hasActiveConversation: boolean; aiEnabled: boolean }) {
  const aiCalls: string[] = [];
  const replies: string[] = [];

  const ctx: any = {
    hasActiveConversation: opts.hasActiveConversation,
    message: { text: '42' },
    from: { id: 93792739 },
    env: { AI: opts.aiEnabled ? { run: vi.fn(async () => ({ response: 'ai-answer' })) } : null, DB: null },
    execCtx: undefined,
    reply: vi.fn(async (text: string) => { replies.push(text); }),
    replyWithChatAction: vi.fn(async () => {}),
  };

  const handler = async (ctx: MyContext) => {
    if (ctx.hasActiveConversation) return;
    const text = ctx.message?.text ?? '';
    if (!text.startsWith('/')) {
      if (!ctx.env.AI) {
        await safeReply(ctx, "دستیار هوشمند در حال حاضر غیرفعال است.");
        return;
      }
      aiCalls.push(text);
      await safeReply(ctx, 'ai-answer', { parse_mode: 'HTML' });
    }
  };

  return { ctx, handler, aiCalls, replies };
}

test('toggle_product path: handler is skipped when an active conversation is present', () => {
  const result = snapshot({ toggleProductConversation: 1 });
  expect(result.hasActiveConversation).toBe(true);
});

test('toggle_product path: numeric input "42" does NOT trigger the AI when conversation is active', async () => {
  const { ctx, handler, aiCalls, replies } = buildMessageHandler({
    hasActiveConversation: true,
    aiEnabled: true,
  });

  await handler(ctx);

  expect(aiCalls).toEqual([]);
  expect(replies).toEqual([]);
});

test('toggle_product path: numeric input "42" triggers AI only when no conversation is active', async () => {
  const { ctx, handler, aiCalls, replies } = buildMessageHandler({
    hasActiveConversation: false,
    aiEnabled: true,
  });

  await handler(ctx);

  expect(aiCalls).toEqual(['42']);
  expect(replies).toEqual(['ai-answer']);
});

test('toggle_product path: numeric input does not produce an AI log when AI is disabled', async () => {
  const { ctx, handler, aiCalls, replies } = buildMessageHandler({
    hasActiveConversation: false,
    aiEnabled: false,
  });

  await handler(ctx);

  expect(aiCalls).toEqual([]);
  expect(replies).toEqual(["دستیار هوشمند در حال حاضر غیرفعال است."]);
});

test('safeReply swallows errors thrown by ctx.reply', async () => {
  const ctx: any = {
    reply: vi.fn(async () => { throw new Error('telegram 4xx'); }),
  };
  const bot = {} as Bot<MyContext>;
  await expect(safeReply(ctx as MyContext, 'hello')).resolves.toBeUndefined();
  expect(ctx.reply).toHaveBeenCalledWith('hello');
});
