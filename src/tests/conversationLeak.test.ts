import { expect, test } from 'vitest';

type ActiveMap = Record<string, number>;

function snapshot(active: ActiveMap): { hasActiveConversation: boolean } {
  const out = { hasActiveConversation: false };
  out.hasActiveConversation = Object.values(active).some(count => count > 0);
  return out;
}

test('snapshot is true when a conversation is active', () => {
  const result = snapshot({ addProductConversation: 1 });
  expect(result.hasActiveConversation).toBe(true);
});

test('snapshot is true with multiple active conversations', () => {
  const result = snapshot({ addProductConversation: 1, toggleProductConversation: 2 });
  expect(result.hasActiveConversation).toBe(true);
});

test('snapshot is false when no conversation is active', () => {
  const result = snapshot({});
  expect(result.hasActiveConversation).toBe(false);
});

test('snapshot is false when active map has only zero counts', () => {
  const result = snapshot({ addProductConversation: 0, toggleProductConversation: 0 });
  expect(result.hasActiveConversation).toBe(false);
});
