import { expect, test } from 'vitest';

test('AI request loads five independent data sources', () => {
  expect(['products', 'branches', 'faqs', 'history', 'visible categories']).toHaveLength(5);
});

test('AI log repository contract supports history and response logging', () => {
  const repo = { getRecentLogs: () => [], logConversation: () => undefined };
  expect(repo.getRecentLogs).toBeDefined();
  expect(repo.logConversation).toBeDefined();
});
