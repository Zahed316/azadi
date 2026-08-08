import { useState, useEffect } from 'react';
import { fetchMessages, replyToMessage, Message } from '../api/client';
import { useAppContext } from '../AppContext';

export function MessagesPage() {
  const { showToast } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'replied'>('all');

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const data = await fetchMessages();
      setMessages(data);
    } catch (e) {
      showToast('خطا در بارگذاری پیام‌ها');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    setSending(true);
    try {
      await replyToMessage(selectedMessage.id, replyText);
      showToast('✅ پاسخ ارسال شد');
      setReplyText('');
      setSelectedMessage(null);
      await loadMessages();
    } catch (e) {
      showToast('❌ خطا در ارسال پاسخ');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'unread') return !msg.isRead && !msg.replied;
    if (filter === 'replied') return msg.replied;
    return true;
  });

  const unreadCount = messages.filter((msg) => !msg.isRead && !msg.replied).length;

  if (loading) {
    return <div className="loading-state">در حال بارگذاری...</div>;
  }

  if (selectedMessage) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="back-btn" onClick={() => setSelectedMessage(null)}>
            ← بازگشت
          </button>
          <h2>پیام #{selectedMessage.id}</h2>
        </div>

        <div className="message-detail">
          <div className="message-meta">
            <span className="sender">
              {selectedMessage.isAnonymous ? 'ناشناس' : selectedMessage.senderName || 'ناشناس'}
            </span>
            <span className="date">{formatDate(selectedMessage.createdAt)}</span>
          </div>

          {selectedMessage.rating && (
            <div className="rating">
              {'⭐'.repeat(selectedMessage.rating)}
            </div>
          )}

          <div className="content" dir="auto">
            {selectedMessage.content}
          </div>

          {selectedMessage.replied && selectedMessage.replyText && (
            <div className="reply-section">
              <h4>💬 پاسخ شما:</h4>
              <p>{selectedMessage.replyText}</p>
              <span className="reply-date">{formatDate(selectedMessage.repliedAt!)}</span>
            </div>
          )}
        </div>

        {!selectedMessage.replied && (
          <div className="reply-form">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="پاسخ خود را بنویسید..."
              rows={4}
            />
            <button
              className="btn-primary"
              onClick={handleReply}
              disabled={sending || !replyText.trim()}
            >
              {sending ? 'در حال ارسال...' : 'ارسال پاسخ'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>📬 پیام‌ها</h2>
        {unreadCount > 0 && (
          <span className="badge">{unreadCount} خوانده نشده</span>
        )}
      </div>

      <div className="filter-tabs">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          همه ({messages.length})
        </button>
        <button
          className={filter === 'unread' ? 'active' : ''}
          onClick={() => setFilter('unread')}
        >
          خوانده نشده ({unreadCount})
        </button>
        <button
          className={filter === 'replied' ? 'active' : ''}
          onClick={() => setFilter('replied')}
        >
          پاسخ داده شده ({messages.filter((m) => m.replied).length})
        </button>
      </div>

      {filteredMessages.length === 0 ? (
        <div className="empty-state">
          <p>📭 پیامی وجود ندارد</p>
        </div>
      ) : (
        <div className="messages-list">
          {filteredMessages.map((msg) => (
            <button
              key={msg.id}
              type="button"
              className={`message-item ${!msg.isRead && !msg.replied ? 'unread' : ''} ${msg.replied ? 'replied' : ''}`}
              onClick={() => setSelectedMessage(msg)}
            >
              <div className="message-header">
                <span className="sender">
                  {msg.isAnonymous ? 'ناشناس' : msg.senderName || 'ناشناس'}
                </span>
                <span className="date">{formatDate(msg.createdAt)}</span>
              </div>

              <div className="preview" dir="auto">
                {msg.content.slice(0, 100)}
                {msg.content.length > 100 ? '...' : ''}
              </div>

              <div className="message-footer">
                {msg.rating && <span className="rating">{'⭐'.repeat(msg.rating)}</span>}
                {msg.replied && <span className="status replied">✓ پاسخ داده شده</span>}
                {!msg.isRead && !msg.replied && (
                  <span className="status unread">● خوانده نشده</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
