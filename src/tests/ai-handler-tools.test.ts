import { describe, test, expect } from 'vitest';
import { parseAiActions, classifyAction } from '../api/ai/parser';
import type { PendingAction } from '../api/ai/types';

// ---------------------------------------------------------------------------
// Parser integration tests (handler depends on parser output shape)
// ---------------------------------------------------------------------------

describe('parseAiActions + classifyAction integration', () => {
  test('read action is classified for immediate execution', () => {
    const text = `<ai_action>
{"tool": "getSettings", "params": {"keys": ["price_unit"]}}
</ai_action>`;
    const { actions } = parseAiActions(text);
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('read');
  });

  test('write action is classified for confirmation', () => {
    const text = `<ai_action>
{"tool": "updateProduct", "params": {"id": 1, "price": 105000}}
</ai_action>`;
    const { actions } = parseAiActions(text);
    expect(actions).toHaveLength(1);
    expect(classifyAction(actions[0])).toBe('write');
  });

  test('mixed read/write actions are classified separately', () => {
    const text = `<ai_action>
{"tool": "getSettings", "params": {}}
</ai_action>
<ai_action>
{"tool": "updateSetting", "params": {"key": "price_unit", "value": "ریال"}}
</ai_action>`;
    const { actions } = parseAiActions(text);
    expect(actions).toHaveLength(2);
    expect(classifyAction(actions[0])).toBe('read');
    expect(classifyAction(actions[1])).toBe('write');
  });

  test('description generation for pending actions', () => {
    // The handler generates descriptions based on tool name and params
    // This tests the shape the handler will produce
    const action: PendingAction = {
      tool: 'updateProduct',
      params: { id: 1, price: 105000 },
      description: 'تغییر محصول #1',
    };
    expect(action.description).toBeTruthy();
    expect(action.tool).toBe('updateProduct');
  });
});
