import { describe, test, expect, vi } from 'vitest';
import { parseAiActions, classifyAction } from '../api/ai/parser';

// Mock executor
vi.mock('../api/ai/executor', () => ({
  executeTool: vi.fn().mockImplementation((tool: string, params: Record<string, unknown>) => ({
    type: tool,
    result: 'success' as const,
    details: { ...params },
  })),
}));

describe('Full AI tool execution flow', () => {
  test('parse → classify → execute read tool', async () => {
    const modelOutput = `تنظیمات فعلی:
<ai_action>
{"tool": "getSettings", "params": {"keys": ["price_unit"]}}
</ai_action>`;

    const { actions, cleanText } = parseAiActions(modelOutput);
    expect(cleanText).toBe('تنظیمات فعلی:');
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('read');

    // In the handler, read tools are executed immediately
    const { executeTool } = await import('../api/ai/executor');
    const result = await executeTool(actions[0].tool, actions[0].params, { db: {} as any });
    expect(result.result).toBe('success');
    expect(result.type).toBe('getSettings');
  });

  test('parse → classify → pending for write tool', () => {
    const modelOutput = `قیمت را تغییر می‌دهم:
<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>`;

    const { actions, cleanText } = parseAiActions(modelOutput);
    expect(cleanText).toBe('قیمت را تغییر می‌دهم:');
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('write');
    // In the handler, this becomes a pendingAction — not executed
  });

  test('mixed read and write actions', () => {
    const modelOutput = `<ai_action>
{"tool": "listCategories", "params": {}}
</ai_action>
<ai_action>
{"tool": "updateSetting", "params": {"key": "price_unit", "value": "ریال"}}
</ai_action>`;

    const { actions } = parseAiActions(modelOutput);
    expect(actions).toHaveLength(2);
    expect(classifyAction(actions[0])).toBe('read');
    expect(classifyAction(actions[1])).toBe('write');
  });
});
