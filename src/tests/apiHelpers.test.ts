import { describe, expect, test } from 'vitest';
import { requireSuperAdmin, jsonSuccess, jsonError, noContent } from '../utils/apiHelpers';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

// --- requireSuperAdmin ---

describe('requireSuperAdmin', () => {
  test('returns 403 when isSuperAdmin is false', () => {
    const res = requireSuperAdmin(false, CORS_HEADERS);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  test('returns error body with correct message', async () => {
    const res = requireSuperAdmin(false, CORS_HEADERS);
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.error).toBe('Forbidden: super admin only');
  });

  test('returns null when isSuperAdmin is true', () => {
    const res = requireSuperAdmin(true, CORS_HEADERS);
    expect(res).toBeNull();
  });
});

// --- jsonSuccess ---

describe('jsonSuccess', () => {
  test('returns data with default 200 status', () => {
    const res = jsonSuccess({ ok: true }, CORS_HEADERS);
    expect(res.status).toBe(200);
  });

  test('returns data with custom status', () => {
    const res = jsonSuccess({ created: true }, CORS_HEADERS, 201);
    expect(res.status).toBe(201);
  });

  test('body contains the data as JSON', async () => {
    const res = jsonSuccess({ items: [1, 2, 3] }, CORS_HEADERS);
    const body = await res.json();
    expect(body).toEqual({ items: [1, 2, 3] });
  });
});

// --- jsonError ---

describe('jsonError', () => {
  test('returns error with default 400 status', () => {
    const res = jsonError('bad request', CORS_HEADERS);
    expect(res.status).toBe(400);
  });

  test('returns error with custom status', () => {
    const res = jsonError('not found', CORS_HEADERS, 404);
    expect(res.status).toBe(404);
  });

  test('body contains { error: message }', async () => {
    const res = jsonError('something broke', CORS_HEADERS, 500);
    const body = await res.json();
    expect(body).toEqual({ error: 'something broke' });
  });
});

// --- noContent ---

describe('noContent', () => {
  test('returns 204', () => {
    const res = noContent(CORS_HEADERS);
    expect(res.status).toBe(204);
  });

  test('body is null', async () => {
    const res = noContent(CORS_HEADERS);
    const text = await res.text();
    expect(text).toBe('');
  });
});
