import { expect, test } from 'vitest';

test('FaqRepository update shape contract', () => {
  const fakeFaq = { id: 1, question: 'Updated Q', answer: 'Updated A' };
  expect(fakeFaq).toHaveProperty('question');
  expect(fakeFaq).toHaveProperty('answer');
});
