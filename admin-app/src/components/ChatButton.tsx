import ChatPanelView from './ChatPanel';

/**
 * Backward-compat default export -- now a no-op.
 * The chat UI is mounted by App.tsx inside the nav tab content area.
 */
export default function ChatButton() {
  return null;
}

// Named export -- App.tsx renders <ChatPanel /> when chat is open.
export { ChatPanelView as ChatPanel };
