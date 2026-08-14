// ---------------------------------------------------------------------------
// AI Admin Assistant — shared types for the AI chat backend
// ---------------------------------------------------------------------------

/** Inbound request from the admin chat panel. */
export interface AiChatRequest {
  message: string;
  conversationId?: string;
}

/** Response returned after processing an AI chat message. */
export interface AiChatResponse {
  reply: string;
  actions: AiAction[];
  conversationId: string;
}

/** A single action executed by the AI tool executor. */
export interface AiAction {
  type: string;
  result: 'success' | 'error';
  details?: Record<string, unknown>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tool definitions — used by the AI model to decide which tools to call
// ---------------------------------------------------------------------------

/** A single tool the AI model can invoke. */
export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, AiToolParameter>;
}

/** Schema for one parameter of an AI tool. */
export interface AiToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
  default?: unknown;
}

// ---------------------------------------------------------------------------
// Conversation persistence (for future multi-turn support)
// ---------------------------------------------------------------------------

export interface AiConversation {
  id: string;
  adminId: number;
  messages: AiMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AiAction[];
  timestamp: string;
}
