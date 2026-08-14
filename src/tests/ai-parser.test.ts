import { describe, test, expect } from 'vitest';
import { parseAiActions, classifyAction } from '../api/ai/parser';

describe('parseAiActions', () => {
  test('returns clean text when no action blocks present', () => {
    const result = parseAiActions('Hello, how can I help?');
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe('Hello, how can I help?');
  });

  test('parses a single action block', () => {
    const text = `Here is the change:
<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({ tool: 'updateProduct', params: { id: 1, price: 105000 } });
    expect(result.cleanText).toBe('Here is the change:');
  });

  test('parses multiple action blocks', () => {
    const text = `<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>
<ai_action>
{"tool": "updateProduct", "params": {"id": 2, "price": 95000}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toHaveLength(2);
    expect(result.cleanText).toBe('');
  });

  test('handles malformed JSON gracefully', () => {
    const text = `<ai_action>
{invalid json}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe('');
  });

  test('handles missing tool name', () => {
    const text = `<ai_action>
{"params": {"id": 1}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.actions).toEqual([]);
  });

  test('handles partial/unclosed block by ignoring it', () => {
    const text = 'Some text <ai_action>{"tool": "updateProduct", "params": {"id": 1}}';
    const result = parseAiActions(text);
    expect(result.actions).toEqual([]);
    expect(result.cleanText).toBe(
      'Some text <ai_action>{"tool": "updateProduct", "params": {"id": 1}}',
    );
  });

  test('strips action blocks from displayed text', () => {
    const text = `قیمت تغییر می‌کنم:
<ai_action>
{"tool": "updateSetting", "params": {"key": "price_unit", "value": "ریال"}}
</ai_action>`;
    const result = parseAiActions(text);
    expect(result.cleanText).toBe('قیمت تغییر می‌کنم:');
  });
});

describe('classifyAction', () => {
  test('classifies read tools correctly', () => {
    expect(classifyAction({ tool: 'getSettings', params: {} })).toBe('read');
    expect(classifyAction({ tool: 'listProducts', params: {} })).toBe('read');
    expect(classifyAction({ tool: 'listCategories', params: {} })).toBe('read');
    expect(classifyAction({ tool: 'getMenuConfig', params: {} })).toBe('read');
  });

  test('classifies write tools correctly', () => {
    expect(classifyAction({ tool: 'updateProduct', params: {} })).toBe('write');
    expect(classifyAction({ tool: 'deleteCategory', params: {} })).toBe('write');
    expect(classifyAction({ tool: 'createProduct', params: {} })).toBe('write');
    expect(classifyAction({ tool: 'invalidateCache', params: {} })).toBe('write');
  });

  test('classifies unknown tools as write (safe default)', () => {
    expect(classifyAction({ tool: 'unknownTool', params: {} })).toBe('write');
  });
});
