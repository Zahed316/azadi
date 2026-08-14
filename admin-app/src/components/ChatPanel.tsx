import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../hooks/useAIChat';
import type { AiAction } from '../api/aiTypes';

/** User-friendly error message map for common failure scenarios. */
const ERROR_MESSAGES: Record<string, string> = {
  'Failed to fetch': 'خطا در اتصال به سرور — اینترنت خود را بررسی کنید',
  NetworkError: 'خطا در اتصال به سرور — اینترنت خود را بررسی کنید',
};

/* ------------------------------------------------------------------ */
/* Action card — renders a single AI tool execution result             */
/* ------------------------------------------------------------------ */

function ActionCard({ action }: { action: AiAction }) {
  const icon = action.result === 'success' ? '✅' : '❌';
  const label = action.type;

  return (
    <div className="chat-action-card">
      <span className="chat-action-icon">{icon}</span>
      <span className="chat-action-label" dir="auto">
        {label}
      </span>
      {action.error && (
        <span className="chat-action-error" dir="auto">
          {action.error}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single chat bubble                                                  */
/* ------------------------------------------------------------------ */

function ChatBubble({
  role,
  text,
  timestamp,
  actions,
}: {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actions?: AiAction[];
}) {
  const isUser = role === 'user';

  return (
    <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
      <div className="chat-bubble-text" dir="auto">
        {text}
      </div>
      {actions && actions.length > 0 && (
        <div className="chat-actions">
          {actions.map((a, i) => (
            <ActionCard key={`${a.type}-${i}`} action={a} />
          ))}
        </div>
      )}
      <div className="chat-bubble-time">
        {timestamp.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Typing indicator (three animated dots)                              */
/* ------------------------------------------------------------------ */

function TypingIndicator() {
  return (
    <div className="chat-bubble chat-bubble-assistant chat-typing">
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ChatPanel — main exported component                                 */
/* ------------------------------------------------------------------ */

/**
 * AI assistant chat panel for the admin app.
 *
 * Renders a scrollable message list, an input bar, and a clear-history
 * button. Uses `useAIChat` for state management and API calls.
 */
export default function ChatPanel() {
  const { messages, isSending, error, sendMessage, retryLastMessage, canRetry, clearHistory } =
    useAIChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll to bottom when messages change or sending starts */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    sendMessage(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const handleClear = () => {
    clearHistory();
    setInput('');
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <h3 style={{ margin: 0 }}>دستیار هوش مصنوعی</h3>
        <button
          type="button"
          className="chat-clear-btn"
          onClick={handleClear}
          disabled={messages.length === 0 && !isSending}
        >
          پاک کردن تاریخچه
        </button>
      </div>

      {/* Messages area */}
      <div className="chat-messages">
        {messages.length === 0 && !isSending && (
          <div className="chat-empty">
            <p>سلام! چطور می‌توانم کمک کنم؟</p>
            <p className="chat-empty-hint">
              مثلاً: «وضعیت سفارش‌ها چطوره؟» یا «یک دسته‌بندی جدید اضافه کن»
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble
            key={`${msg.role}-${msg.timestamp.getTime()}-${i}`}
            role={msg.role}
            text={msg.text}
            timestamp={msg.timestamp}
            actions={msg.actions}
          />
        ))}

        {isSending && <TypingIndicator />}

        {error && (
          <div className="chat-error" role="alert">
            <span>{ERROR_MESSAGES[error.message] || `خطا در دریافت پاسخ: ${error.message}`}</span>
            {canRetry && (
              <button
                type="button"
                className="chat-retry-btn"
                onClick={retryLastMessage}
                disabled={isSending}
              >
                تلاش مجدد
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="پیام خود را بنویسید..."
          dir="auto"
          disabled={isSending}
          className="chat-input"
          autoComplete="off"
        />
        <button type="submit" className="chat-send-btn" disabled={!input.trim() || isSending}>
          {isSending ? '...' : 'ارسال'}
        </button>
      </form>
    </div>
  );
}
