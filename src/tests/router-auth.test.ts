/**
 * Authentication and authorization tests for src/api/router.ts (lines 29-47).
 */
import { expect, test, beforeEach } from 'vitest';
import {
  callRouter,
  setValidateResult,
  setAdminRole,
  resetAuthDefaults,
  clearStore,
} from './_helpers/routerHarness';

beforeEach(() => {
  resetAuthDefaults();
  clearStore();
});

test('missing Authorization header returns 401', async () => {
  const res = await callRouter({ method: 'GET', path: 'currentUser', auth: null });
  expect(res.status).toBe(401);
  expect(res.body.error).toMatch(/Missing or invalid Authorization/i);
});

test('Authorization without Telegram prefix returns 401', async () => {
  const res = await callRouter({ method: 'GET', path: 'currentUser', auth: 'Bearer abc' });
  expect(res.status).toBe(401);
  expect(res.body.error).toMatch(/Missing or invalid Authorization/i);
});

test('valid Telegram prefix but validateInitData returns null yields 401', async () => {
  setValidateResult(null);
  // The Request constructor strips trailing spaces, so use non-empty initData.
  // The mock always returns null, simulating an invalid signature.
  const res = await callRouter({ method: 'GET', path: 'currentUser', auth: 'Telegram bad-data' });
  expect(res.status).toBe(401);
  expect(res.body.error).toBe('Unauthorized');
});

test('validateInitData returning null yields 401', async () => {
  setValidateResult(null);
  const res = await callRouter({ method: 'GET', path: 'currentUser' });
  expect(res.status).toBe(401);
  expect(res.body.error).toBe('Unauthorized');
});

test('valid user but getAdminRole returns null yields 403', async () => {
  setAdminRole(null);
  const res = await callRouter({ method: 'GET', path: 'currentUser' });
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/Not an admin/i);
});

test('super_admin on /currentUser returns 200', async () => {
  setAdminRole({ telegramId: 12345, role: 'super_admin', categoryId: null });
  const res = await callRouter({ method: 'GET', path: 'currentUser' });
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe('super_admin');
});
