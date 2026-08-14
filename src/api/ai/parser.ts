// ---------------------------------------------------------------------------
// AI Admin Assistant — action block parser
//
// Extracts <ai_action> blocks from model text output, parses the JSON,
// and classifies each action as read-only or write (requiring confirmation).
// ---------------------------------------------------------------------------

/** A parsed action block from the model output. */
export interface ParsedAction {
  tool: string;
  params: Record<string, unknown>;
}

/** Read-only tools that execute immediately without confirmation. */
const READ_TOOLS = new Set(['getSettings', 'listProducts', 'listCategories', 'getMenuConfig']);

/**
 * Parse `<ai_action>` blocks from model text output.
 *
 * Extracts JSON action blocks, parses them, and returns them alongside
 * the cleaned text (blocks removed). Malformed JSON or missing tool names
 * are silently ignored — the response degrades to conversational.
 *
 * @param text - Raw model output potentially containing <ai_action> blocks
 * @returns Parsed actions and cleaned text with blocks stripped
 */
export function parseAiActions(text: string): { actions: ParsedAction[]; cleanText: string } {
  const actions: ParsedAction[] = [];
  const cleanText = text.replace(
    /<ai_action>\s*(\{[\s\S]*?\})\s*<\/ai_action>/g,
    (_, jsonStr: string) => {
      try {
        const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        if (parsed.tool && typeof parsed.tool === 'string' && typeof parsed.params === 'object') {
          actions.push({
            tool: parsed.tool,
            params: (parsed.params as Record<string, unknown>) ?? {},
          });
        }
      } catch {
        // Malformed JSON — log warning, treat as conversational
        console.warn('ai-action-parse-fail', jsonStr.slice(0, 200));
      }
      return ''; // Remove block from displayed text
    },
  );
  return { actions, cleanText: cleanText.trim() };
}

/**
 * Classify a parsed action as read (execute immediately) or write (requires confirmation).
 *
 * Read tools: getSettings, listProducts, listCategories, getMenuConfig
 * Write tools: everything else (safe default — unknown tools require confirmation)
 *
 * @param action - Parsed action with tool name and params
 * @returns 'read' if the tool is read-only, 'write' if it modifies data
 */
export function classifyAction(action: ParsedAction): 'read' | 'write' {
  return READ_TOOLS.has(action.tool) ? 'read' : 'write';
}
