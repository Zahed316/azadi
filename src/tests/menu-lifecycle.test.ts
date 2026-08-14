import { describe, test, expect, vi } from 'vitest';
import {
  pushMessage,
  popMessage,
  getActiveMessage,
  peekStack,
  cleanupOldMessages,
  handleEditFailure,
  type MessageStackEntry,
} from '../utils/menuLifecycle';
import type { SessionData } from '../types/context';

function makeSession(menuStack?: MessageStackEntry[]): SessionData {
  return { menuStack };
}

describe('pushMessage', () => {
  test('adds entry to empty stack', () => {
    const session = makeSession();
    pushMessage(session, 123, 456, 'featured');
    expect(session.menuStack).toHaveLength(1);
    expect(session.menuStack![0]).toEqual({
      chatId: 123,
      messageId: 456,
      state: 'featured',
      timestamp: expect.any(Number),
    });
  });

  test('maintains FIFO order', () => {
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'main', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'discover', timestamp: 2 },
      { chatId: 1, messageId: 30, state: 'featured', timestamp: 3 },
    ]);
    pushMessage(session, 1, 40, 'product:1');
    expect(session.menuStack).toHaveLength(4);
    expect(session.menuStack![3].messageId).toBe(40);
  });

  test('cleans up when stack exceeds 4', () => {
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'a', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'b', timestamp: 2 },
      { chatId: 1, messageId: 30, state: 'c', timestamp: 3 },
      { chatId: 1, messageId: 40, state: 'd', timestamp: 4 },
    ]);
    pushMessage(session, 1, 50, 'e');
    expect(session.menuStack).toHaveLength(4);
    expect(session.menuStack![0].messageId).toBe(20); // oldest removed
  });

  test('initializes stack if undefined', () => {
    const session = makeSession(undefined);
    pushMessage(session, 1, 10, 'main');
    expect(session.menuStack).toBeDefined();
    expect(session.menuStack).toHaveLength(1);
  });

  test('returns null when no eviction needed', () => {
    const session = makeSession([{ chatId: 1, messageId: 10, state: 'a', timestamp: 1 }]);
    const evicted = pushMessage(session, 1, 20, 'b');
    expect(evicted).toBeNull();
    expect(session.menuStack).toHaveLength(2);
  });

  test('returns evicted entry when stack overflows', () => {
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'a', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'b', timestamp: 2 },
      { chatId: 1, messageId: 30, state: 'c', timestamp: 3 },
      { chatId: 1, messageId: 40, state: 'd', timestamp: 4 },
    ]);
    const evicted = pushMessage(session, 1, 50, 'e');
    expect(evicted).toEqual({ chatId: 1, messageId: 10, state: 'a', timestamp: 1 });
    expect(session.menuStack).toHaveLength(4);
    expect(session.menuStack![0].messageId).toBe(20);
  });
});

describe('popMessage', () => {
  test('removes and returns last entry', () => {
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'a', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'b', timestamp: 2 },
    ]);
    const popped = popMessage(session);
    expect(popped?.messageId).toBe(20);
    expect(session.menuStack).toHaveLength(1);
  });

  test('returns null on empty stack', () => {
    const session = makeSession();
    expect(popMessage(session)).toBeNull();
  });

  test('returns null on undefined stack', () => {
    const session = makeSession(undefined);
    expect(popMessage(session)).toBeNull();
  });
});

describe('getActiveMessage', () => {
  test('returns last entry', () => {
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'a', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'b', timestamp: 2 },
    ]);
    expect(getActiveMessage(session)?.messageId).toBe(20);
  });

  test('returns null on empty stack', () => {
    const session = makeSession();
    expect(getActiveMessage(session)).toBeNull();
  });
});

describe('peekStack', () => {
  test('returns copy of stack', () => {
    const session = makeSession([{ chatId: 1, messageId: 10, state: 'a', timestamp: 1 }]);
    const peek = peekStack(session);
    expect(peek).toHaveLength(1);
    peek.push({ chatId: 1, messageId: 99, state: 'x', timestamp: 99 });
    expect(session.menuStack).toHaveLength(1); // original unchanged
  });

  test('returns empty array for undefined stack', () => {
    expect(peekStack(makeSession(undefined))).toEqual([]);
  });
});

describe('cleanupOldMessages', () => {
  test('does nothing when stack <= 4', async () => {
    const api = { deleteMessage: vi.fn() };
    const session = makeSession([{ chatId: 1, messageId: 10, state: 'a', timestamp: 1 }]);
    await cleanupOldMessages(api, session);
    expect(api.deleteMessage).not.toHaveBeenCalled();
  });

  test('deletes oldest when stack > 4', async () => {
    const api = { deleteMessage: vi.fn().mockResolvedValue({}) };
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'a', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'b', timestamp: 2 },
      { chatId: 1, messageId: 30, state: 'c', timestamp: 3 },
      { chatId: 1, messageId: 40, state: 'd', timestamp: 4 },
      { chatId: 1, messageId: 50, state: 'e', timestamp: 5 },
    ]);
    await cleanupOldMessages(api, session);
    expect(api.deleteMessage).toHaveBeenCalledWith(1, 10);
    expect(session.menuStack).toHaveLength(4);
  });

  test('handles deleteMessage failure gracefully', async () => {
    const api = { deleteMessage: vi.fn().mockRejectedValue(new Error('not found')) };
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'a', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'b', timestamp: 2 },
      { chatId: 1, messageId: 30, state: 'c', timestamp: 3 },
      { chatId: 1, messageId: 40, state: 'd', timestamp: 4 },
      { chatId: 1, messageId: 50, state: 'e', timestamp: 5 },
    ]);
    // Should not throw
    await cleanupOldMessages(api, session);
    expect(session.menuStack).toHaveLength(4);
  });
});

describe('handleEditFailure', () => {
  test('"message is not modified" calls answerCallbackQuery', async () => {
    const ctx = {
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({ message_id: 1 }),
    };
    const error = new Error('message is not modified');
    await handleEditFailure(ctx, 'new text', {}, error);
    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith({
      text: 'Already showing this',
      show_alert: false,
    });
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  test('"message to edit not found" creates new message and deletes orphan', async () => {
    const api = { deleteMessage: vi.fn().mockResolvedValue({}) };
    const session = makeSession([{ chatId: 1, messageId: 10, state: 'espresso', timestamp: 1 }]);
    const ctx = {
      api,
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({ message_id: 99 }),
      session,
      chat: { id: 1 },
    };
    const error = new Error('message to edit not found');
    await handleEditFailure(ctx, 'new text', { parse_mode: 'HTML' }, error);
    expect(ctx.reply).toHaveBeenCalledWith('new text', { parse_mode: 'HTML' });
    // Orphaned message (messageId: 10) should be deleted from Telegram
    expect(api.deleteMessage).toHaveBeenCalledWith(1, 10);
    // Stack: old entry popped, new fallback pushed
    expect(session.menuStack).toHaveLength(1);
    expect(session.menuStack![0].messageId).toBe(99);
    expect(session.menuStack![0].state).toBe('fallback');
  });

  test("message can't be edited creates new message and deletes orphan", async () => {
    const api = { deleteMessage: vi.fn().mockResolvedValue({}) };
    const session = makeSession([{ chatId: 1, messageId: 20, state: 'featured', timestamp: 1 }]);
    const ctx = {
      api,
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({ message_id: 88 }),
      session,
      chat: { id: 1 },
    };
    const error = new Error("message can't be edited");
    await handleEditFailure(ctx, 'new text', {}, error);
    expect(ctx.reply).toHaveBeenCalled();
    expect(api.deleteMessage).toHaveBeenCalledWith(1, 20);
  });

  test('unknown error creates new message and deletes orphan', async () => {
    const api = { deleteMessage: vi.fn().mockResolvedValue({}) };
    const session = makeSession([{ chatId: 1, messageId: 30, state: 'main', timestamp: 1 }]);
    const ctx = {
      api,
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({ message_id: 77 }),
      session,
      chat: { id: 1 },
    };
    const error = new Error('network timeout');
    await handleEditFailure(ctx, 'new text', {}, error);
    expect(ctx.reply).toHaveBeenCalled();
    expect(api.deleteMessage).toHaveBeenCalledWith(1, 30);
  });

  test('pops active message then pushes fallback to stack', async () => {
    const api = { deleteMessage: vi.fn().mockResolvedValue({}) };
    const session = makeSession([
      { chatId: 1, messageId: 10, state: 'drinks', timestamp: 1 },
      { chatId: 1, messageId: 20, state: 'espresso', timestamp: 2 },
    ]);
    const ctx = {
      api,
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({ message_id: 77 }),
      session,
      chat: { id: 1 },
    };
    const error = new Error('message to edit not found');
    await handleEditFailure(ctx, 'fallback text', { parse_mode: 'HTML' }, error);
    expect(ctx.reply).toHaveBeenCalledWith('fallback text', { parse_mode: 'HTML' });
    // Active message (espresso) was popped, then fallback was pushed
    expect(session.menuStack).toHaveLength(2);
    expect(session.menuStack![0]).toEqual({
      chatId: 1,
      messageId: 10,
      state: 'drinks',
      timestamp: expect.any(Number),
    });
    expect(session.menuStack![1]).toEqual({
      chatId: 1,
      messageId: 77,
      state: 'fallback',
      timestamp: expect.any(Number),
    });
    // Orphaned message deleted from Telegram
    expect(api.deleteMessage).toHaveBeenCalledWith(1, 20);
  });

  test('does not push to stack when ctx has no session', async () => {
    const ctx = {
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({ message_id: 77 }),
    };
    const error = new Error('message to edit not found');
    await handleEditFailure(ctx, 'fallback text', {}, error);
    expect(ctx.reply).toHaveBeenCalled();
    // No crash — just no stack push
  });

  test('does not delete when ctx has no api (backward compat)', async () => {
    const session = makeSession([{ chatId: 1, messageId: 10, state: 'main', timestamp: 1 }]);
    const ctx = {
      answerCallbackQuery: vi.fn().mockResolvedValue({}),
      reply: vi.fn().mockResolvedValue({ message_id: 55 }),
      session,
      chat: { id: 1 },
    };
    const error = new Error('some error');
    await handleEditFailure(ctx, 'new text', {}, error);
    // No crash — api is optional, so no deleteMessage call
    expect(ctx.reply).toHaveBeenCalled();
    expect(session.menuStack).toHaveLength(1);
    expect(session.menuStack![0].messageId).toBe(55);
  });
});
