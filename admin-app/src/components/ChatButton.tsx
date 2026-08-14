import { useState } from 'react';
import { useAppContext } from '../AppContext';
import ChatPanel from './ChatPanel';

/**
 * Floating action button that toggles the AI assistant chat panel.
 * Only visible to super admins. Positioned bottom-left to avoid
 * overlap with the bottom navigation bar.
 */
export default function ChatButton() {
  const { isSuperAdmin } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);

  if (!isSuperAdmin) return null;

  return (
    <>
      {/* Overlay backdrop when chat is open */}
      {isOpen && (
        <div className="chat-overlay" onClick={() => setIsOpen(false)} aria-hidden="true" />
      )}

      {/* Chat panel (slides up from bottom-left) */}
      <div className={`chat-fab-panel ${isOpen ? 'chat-fab-panel--open' : ''}`}>
        <ChatPanel />
      </div>

      {/* Floating action button */}
      <button
        type="button"
        className={`chat-fab ${isOpen ? 'chat-fab--active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'بستن چت' : 'باز کردن چت'}
        aria-expanded={isOpen}
      >
        {isOpen ? '✕' : '💬'}
      </button>
    </>
  );
}
