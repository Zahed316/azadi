import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { sendAiChatMessage, executeAiAction } from '../api/aiClient';
import type { AiChatResponse, AiAction, PendingAction } from '../api/aiTypes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single chat bubble — either user-sent or AI-replied. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** Timestamp when the message was created locally. */
  timestamp: Date;
  /** Actions executed by the AI (only on assistant messages). */
  actions?: AiAction[];
  /** Write actions pending admin confirmation (only on assistant messages). */
  pendingActions?: PendingAction[];
  /** Whether this message's pending actions have been confirmed (hides Confirm/Cancel buttons). */
  confirmed?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages an AI chat conversation for the admin assistant.
 *
 * Handles message sending via `sendAiChatMessage`, tracks multi-turn
 * conversation state, and exposes loading/error states for the UI.
 *
 * @example
 * ```tsx
 * const { messages, isSending, sendMessage, clearHistory } = useAIChat();
 *
 * <ChatInput onSend={sendMessage} disabled={isSending} />
 * <ChatMessages messages={messages} loading={isSending} />
 * ```
 */
export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  /** The last user message text, kept for retry after a failed send. */
  const [lastUserText, setLastUserText] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: sendAiChatMessage,
    onSuccess: (data: AiChatResponse) => {
      // Persist conversationId for multi-turn continuity
      setConversationId(data.conversationId);
      // Clear retry state on success
      setLastUserText(null);

      // Append AI reply to the chat log
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply,
          timestamp: new Date(),
          actions: data.actions.length > 0 ? data.actions : undefined,
          pendingActions: data.pendingActions.length > 0 ? data.pendingActions : undefined,
        },
      ]);
    },
  });

  /**
   * Send a user message to the AI assistant.
   *
   * Appends the user message immediately (optimistic UI), then fires the
   * mutation. On success the AI reply is appended by the `onSuccess` handler.
   * On error the user message remains visible and `error` becomes truthy so
   * the UI can display it.
   */
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || mutation.isPending) return;

      // Track the text for potential retry
      setLastUserText(trimmed);

      // Append user message immediately
      setMessages((prev) => [...prev, { role: 'user', text: trimmed, timestamp: new Date() }]);

      // Fire the API call — conversationId is included for multi-turn
      mutation.mutate({
        message: trimmed,
        conversationId: conversationId ?? undefined,
      });
    },
    [mutation, conversationId],
  );

  /**
   * Retry the last failed message.
   *
   * Removes the failed user message from the log and re-sends it.
   * Only works when there's an error and a lastUserText to retry.
   */
  const retryLastMessage = useCallback(() => {
    if (!lastUserText || mutation.isPending) return;

    // Remove the last user message (which failed) from the log
    setMessages((prev) => {
      // Find the last user message index (reverse iteration for ES2020 compat)
      let lastIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'user') {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx === -1) return prev;
      return prev.slice(0, lastIdx);
    });

    // Re-send the message
    mutation.mutate({
      message: lastUserText,
      conversationId: conversationId ?? undefined,
    });
  }, [mutation, lastUserText, conversationId]);

  /**
   * Confirm a pending write action, sending it for execution.
   *
   * Finds the last assistant message with pendingActions, marks it as confirmed,
   * sends the action for execution, and appends the result as a new message.
   */
  const confirmAction = useCallback(
    async (tool: string, params: Record<string, unknown>) => {
      // Find and mark the last assistant message with pending actions as confirmed
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === 'assistant' && updated[i].pendingActions?.length) {
            updated[i] = { ...updated[i], confirmed: true };
            break;
          }
        }
        return updated;
      });

      try {
        const result = await executeAiAction(tool, params, conversationId ?? undefined);

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text:
              result.result === 'success'
                ? `✅ انجام شد: ${result.type}`
                : `❌ خطا: ${result.error || 'مشکلی پیش آمد'}`,
            timestamp: new Date(),
            actions: [result],
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `❌ خطا در اجرای عملیات: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: new Date(),
          },
        ]);
      }
    },
    [conversationId],
  );

  /**
   * Cancel all pending actions on the last assistant message.
   * Marks the message as confirmed (hiding the buttons) without executing.
   */
  const cancelAction = useCallback(() => {
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === 'assistant' && updated[i].pendingActions?.length) {
          updated[i] = { ...updated[i], confirmed: true };
          break;
        }
      }
      return updated;
    });
  }, []);

  /** Reset the conversation — clears all messages and the conversationId. */
  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setLastUserText(null);
    mutation.reset();
  }, [mutation]);

  return {
    /** Ordered list of chat messages (user + assistant). */
    messages,
    /** Whether a send request is in flight. */
    isSending: mutation.isPending,
    /** Error from the most recent failed request, if any. */
    error: mutation.error,
    /** Current conversation ID (null until the first reply). */
    conversationId,
    /** Send a user message to the AI assistant. */
    sendMessage,
    /** Retry the last failed message (removes the failed message and re-sends). */
    retryLastMessage,
    /** Whether a retry is possible (last send failed and we have the text). */
    canRetry: !mutation.isPending && lastUserText !== null && mutation.isError,
    /** Clear all messages and reset the conversation. */
    clearHistory,
    /** Confirm a pending write action, sending it for execution. */
    confirmAction,
    /** Cancel all pending actions on the last assistant message (hides buttons). */
    cancelAction,
  };
}
