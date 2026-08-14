import { describe, test, expect, vi, beforeEach } from 'vitest';
import { editOrSend } from '../utils/editOrSend';

vi.mock('../utils/menuLifecycle', () => ({
  getActiveMessage: vi.fn(),
  pushMessage: vi.fn(),
  handleEditFailure: vi.fn(),
}));

import { getActiveMessage, pushMessage, handleEditFailure } from '../utils/menuLifecycle';

const getActiveMessageMock = vi.mocked(getActiveMessage);
const pushMessageMock = vi.mocked(pushMessage);
const handleEditFailureMock = vi.mocked(handleEditFailure);

let ctx: {
  session: { menuStack: Array<{ chatId: number; messageId: number; state: string; timestamp: number }> };
  chat: { id: number } | null;
  api: {
    editMessageText: ReturnType<typeof vi.fn>;
    deleteMessage: ReturnType<typeof vi.fn>;
  };
  reply: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();

  ctx = {
    session: { menuStack: [] },
    chat: { id: 123 },
    api: {
      editMessageText: vi.fn().mockResolvedValue({}),
      deleteMessage: vi.fn().mockResolvedValue({}),
    },
    reply: vi.fn().mockResolvedValue({ message_id: 999 }),
  };
});

describe('editOrSend', () => {
  test('edits active message when one exists', async () => {
    const active = { chatId: 123, messageId: 42, state: 'old', timestamp: Date.now() };
    getActiveMessageMock.mockReturnValue(active);

    await editOrSend(ctx as any, '<b>Hello</b>', { parse_mode: 'HTML' }, 'greet');

    expect(ctx.api.editMessageText).toHaveBeenCalledWith(123, 42, '<b>Hello</b>', {
      parse_mode: 'HTML',
    });
    expect(active.state).toBe('greet');
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  test('calls handleEditFailure when edit throws', async () => {
    const active = { chatId: 123, messageId: 42, state: 'old', timestamp: Date.now() };
    getActiveMessageMock.mockReturnValue(active);
    const editError = new Error('message to edit not found');
    ctx.api.editMessageText.mockRejectedValue(editError);

    await editOrSend(ctx as any, '<b>New</b>', { parse_mode: 'HTML' }, 'fallback');

    expect(handleEditFailureMock).toHaveBeenCalledWith(
      ctx,
      '<b>New</b>',
      { parse_mode: 'HTML' },
      editError,
    );
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  test('sends new reply when no active message', async () => {
    getActiveMessageMock.mockReturnValue(null);
    pushMessageMock.mockReturnValue(null);

    await editOrSend(ctx as any, '<b>Brand new</b>', { parse_mode: 'HTML' }, 'fresh');

    expect(ctx.reply).toHaveBeenCalledWith('<b>Brand new</b>', { parse_mode: 'HTML' });
    expect(pushMessageMock).toHaveBeenCalledWith(ctx.session, 123, 999, 'fresh');
  });

  test('deletes evicted message when stack overflows', async () => {
    getActiveMessageMock.mockReturnValue(null);
    const evicted = { chatId: 123, messageId: 10, state: 'old', timestamp: Date.now() };
    pushMessageMock.mockReturnValue(evicted);

    await editOrSend(ctx as any, '<b>Overflow</b>', { parse_mode: 'HTML' }, 'stack');

    expect(ctx.api.deleteMessage).toHaveBeenCalledWith(123, 10);
  });
});
