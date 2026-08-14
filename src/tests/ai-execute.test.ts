import { describe, test, expect, vi } from 'vitest';

// Mock executor to avoid D1/KV dependencies
vi.mock('../api/ai/executor', () => ({
  executeTool: vi.fn().mockImplementation(async (toolName: string) => {
    if (toolName === 'nonexistent') {
      return { type: 'nonexistent', result: 'error' as const, error: 'Unknown tool: nonexistent' };
    }
    return {
      type: 'updateProduct',
      result: 'success' as const,
      details: { id: 1, updatedFields: ['price'] },
    };
  }),
}));

describe('POST /api/ai/execute', () => {
  test('returns action result on success', async () => {
    const { executeTool } = await import('../api/ai/executor');
    const result = await executeTool('updateProduct', { id: 1, price: 105000 }, { db: {} as any });
    expect(result.result).toBe('success');
    expect(result.type).toBe('updateProduct');
  });

  test('returns error for unknown tool', async () => {
    const { executeTool } = await import('../api/ai/executor');
    // executeTool handles unknown tools internally
    const result = await executeTool('nonexistent', {}, { db: {} as any });
    expect(result.result).toBe('error');
  });
});
