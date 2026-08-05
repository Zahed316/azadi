import { expect, test } from 'vitest';

const DEFAULT_GREETING =
  'من دستیار هوشمند قهوه شما هستم! 🤖☕\n\nهر سوالی درباره قهوه، روش‌های دم‌آوری، شعب یا هر چیز دیگری دارید از من بپرسید.';

test('falls back to default when DB value is null', () => {
  const dbValue = null;
  const greeting = dbValue || DEFAULT_GREETING;
  expect(greeting).toContain('دستیار هوشمند');
});

test('falls back to default when DB value is empty string', () => {
  const dbValue = '';
  const greeting = dbValue || DEFAULT_GREETING;
  expect(greeting).toBe(DEFAULT_GREETING);
});

test('uses DB value when set', () => {
  const dbValue = 'Custom greeting from admin panel';
  const greeting = dbValue || DEFAULT_GREETING;
  expect(greeting).toBe('Custom greeting from admin panel');
});

test('default greeting is HTML-safe', () => {
  expect(DEFAULT_GREETING).not.toMatch(/<[a-z][a-z0-9]*>/i);
});
