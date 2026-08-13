/**
 * Unit tests for the in-memory rate limiter (src/utils/rateLimit.ts).
 * Tests AI-001 fix: atomic cooldown check-and-set replaces log-based check.
 */
import { expect, test, vi, beforeEach } from 'vitest';
import { checkAndSetCooldown, resetCooldownState } from '../utils/rateLimit';

beforeEach(() => {
  resetCooldownState();
});

test('first call returns true (allowed)', () => {
  expect(checkAndSetCooldown('user1')).toBe(true);
});

test('second call within 5 seconds returns false (rate-limited)', () => {
  expect(checkAndSetCooldown('user1')).toBe(true);
  expect(checkAndSetCooldown('user1')).toBe(false);
});

test('call after 5 seconds returns true again', () => {
  vi.useFakeTimers();
  try {
    expect(checkAndSetCooldown('user1')).toBe(true);

    // Advance 5 seconds
    vi.advanceTimersByTime(5000);
    expect(checkAndSetCooldown('user1')).toBe(true);

    // Advance another 4.9 seconds — still rate-limited from second call
    vi.advanceTimersByTime(4900);
    expect(checkAndSetCooldown('user1')).toBe(false);

    // Advance to 5 seconds after second call
    vi.advanceTimersByTime(200);
    expect(checkAndSetCooldown('user1')).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test('different users have independent cooldowns', () => {
  expect(checkAndSetCooldown('user1')).toBe(true);
  expect(checkAndSetCooldown('user2')).toBe(true);
  expect(checkAndSetCooldown('user1')).toBe(false);
  expect(checkAndSetCooldown('user2')).toBe(false);
});

test('resetCooldownState clears all cooldowns', () => {
  expect(checkAndSetCooldown('user1')).toBe(true);
  expect(checkAndSetCooldown('user1')).toBe(false);
  resetCooldownState();
  expect(checkAndSetCooldown('user1')).toBe(true);
});
