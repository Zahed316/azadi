import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../hooks/useAIChat';
import type { AiAction, PendingAction } from '../api/aiTypes';

/** User-friendly error message map for common failure scenarios. */
const ERROR_MESSAGES: Record<string, string> = {
  'Failed to fetch': 'خطا در اتصال به سرور — اینترنت خود را بررسی کنید',
  NetworkError: 'خطا در اتصال به سرور — اینترنت خود را بررسی کنید',
};

/* ------------------------------------------------------------------ */
/* Action card — renders a single AI tool execution result             */
/* ------------------------------------------------------------------ */

/** Format a Persian-style price with thousand separators. */
function fmtPrice(n: number): string {
  return n.toLocaleString('fa-IR');
}

/** Render the details payload of a successful tool action. */
function ActionDetails({ action }: { action: AiAction }) {
  const d = action.details;
  if (!d) return null;

  switch (action.type) {
    case 'listProducts': {
      const products = d.products as Array<{
        id: number;
        name: string;
        price: number | null;
        stock: number;
        unit: string;
        available: boolean;
        featured: boolean;
        isSeasonal: boolean;
      }>;
      const count = d.count as number;
      if (!products?.length) return <div className="chat-action-detail">محصولی یافت نشد.</div>;
      return (
        <div className="chat-action-detail">
          <div className="chat-action-detail-header">{count} محصول</div>
          <ul className="chat-action-list">
            {products.map((p) => (
              <li key={p.id} dir="auto">
                <span className="chat-action-product-name">{p.name}</span>
                {p.price != null && (
                  <span className="chat-action-product-price">{fmtPrice(p.price)} تومان</span>
                )}
                {p.featured && <span className="chat-action-tag">⭐</span>}
                {p.isSeasonal && <span className="chat-action-tag">🌿</span>}
                {!p.available && (
                  <span className="chat-action-tag chat-action-unavailable">غیرفعال</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'listCategories': {
      const categories = d.categories as Array<{
        id: number;
        name: string;
        emoji: string | null;
      }>;
      const count = d.count as number;
      if (!categories?.length) return <div className="chat-action-detail">دسته‌ای یافت نشد.</div>;
      return (
        <div className="chat-action-detail">
          <div className="chat-action-detail-header">{count} دسته‌بندی</div>
          <ul className="chat-action-list">
            {categories.map((c) => (
              <li key={c.id} dir="auto">
                {c.emoji && <span className="chat-action-emoji">{c.emoji}</span>}
                <span>{c.name}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'getMenuConfig': {
      const entries = d.menuConfig as Array<{
        id: number;
        menuSection: string;
        isVisible: boolean;
        categoryName: string | null;
      }>;
      const count = d.count as number;
      if (!entries?.length) return <div className="chat-action-detail">تنظیمات منو یافت نشد.</div>;
      return (
        <div className="chat-action-detail">
          <div className="chat-action-detail-header">{count} آیتم منو</div>
          <ul className="chat-action-list">
            {entries.map((e) => (
              <li key={e.id} dir="auto">
                <span>{e.categoryName ?? `#${e.id}`}</span>
                <span className="chat-action-tag">{e.menuSection}</span>
                {!e.isVisible && (
                  <span className="chat-action-tag chat-action-unavailable">مخفی</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'getSettings': {
      const settings = d.settings as Record<string, string | null>;
      if (!settings || typeof settings !== 'object') return null;
      const entries = Object.entries(settings);
      if (!entries.length) return <div className="chat-action-detail">تنظیمی یافت نشد.</div>;
      return (
        <div className="chat-action-detail">
          <ul className="chat-action-list">
            {entries.map(([k, v]) => (
              <li key={k} dir="auto">
                <span className="chat-action-setting-key">{k}:</span>
                <span>{v ?? '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    default:
      return null;
  }
}

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
      {action.result === 'success' && action.details && <ActionDetails action={action} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pending actions card — confirmation UI for write actions            */
/* ------------------------------------------------------------------ */

function PendingActionsCard({
  pendingActions,
  confirmed,
  onConfirm,
  onCancel,
}: {
  pendingActions: PendingAction[];
  confirmed: boolean;
  onConfirm: (tool: string, params: Record<string, unknown>) => void | Promise<void>;
  onCancel: () => void;
}) {
  if (confirmed) {
    return (
      <div className="chat-pending-confirmed">
        <span>✅ تأیید شد</span>
      </div>
    );
  }

  return (
    <div className="chat-pending-actions">
      <div className="chat-pending-label">عملیات پیشنهادی:</div>
      {pendingActions.map((action, i) => (
        <div key={`${action.tool}-${i}`} className="chat-pending-item" dir="auto">
          <span className="chat-pending-desc">{action.description}</span>
        </div>
      ))}
      <div className="chat-pending-buttons">
        <button
          type="button"
          className="chat-confirm-btn"
          onClick={() => {
            // For now, confirm the first pending action
            // Multi-action confirmation can be added later
            const first = pendingActions[0];
            void onConfirm(first.tool, first.params);
          }}
        >
          ✅ تأیید
        </button>
        <button type="button" className="chat-cancel-btn" onClick={onCancel}>
          ❌ لغو
        </button>
      </div>
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
  pendingActions,
  confirmed,
  onConfirm,
  onCancel,
}: {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actions?: AiAction[];
  pendingActions?: PendingAction[];
  confirmed?: boolean;
  onConfirm?: (tool: string, params: Record<string, unknown>) => void | Promise<void>;
  onCancel?: () => void;
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
      {pendingActions && pendingActions.length > 0 && onConfirm && onCancel && (
        <PendingActionsCard
          pendingActions={pendingActions}
          confirmed={confirmed ?? false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
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
  const {
    messages,
    isSending,
    error,
    sendMessage,
    retryLastMessage,
    canRetry,
    clearHistory,
    confirmAction,
    cancelAction,
  } = useAIChat();
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
            pendingActions={msg.pendingActions}
            confirmed={msg.confirmed}
            onConfirm={msg.role === 'assistant' ? confirmAction : undefined}
            onCancel={msg.role === 'assistant' ? cancelAction : undefined}
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
