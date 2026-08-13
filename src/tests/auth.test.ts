/**
 * Unit tests for validateInitData (src/api/auth.ts).
 *
 * Tests AUTH-001 (auth_date required + freshness) and AUTH-002 (hash length check)
 * by calling the real HMAC validation with a known bot token.
 */
import { expect, test } from 'vitest';
import { validateInitData } from '../api/auth';

const BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

/**
 * Build a valid initData string and compute the correct HMAC hash.
 * Returns { initData, hash } — hash is the valid signature.
 */
async function buildInitData(
  params: Record<string, string>,
): Promise<{ initData: string; hash: string }> {
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const encoder = new TextEncoder();
  const secretKeyData = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secretKey = await crypto.subtle.sign('HMAC', secretKeyData, encoder.encode(BOT_TOKEN));

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString));
  const hash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const queryString = entries.map(([k, v]) => `${k}=${v}`).join('&');
  const initData = `${queryString}&hash=${hash}`;
  return { initData, hash };
}

test('valid initData returns TelegramUser', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { initData } = await buildInitData({
    auth_date: String(now),
    user: JSON.stringify({ id: 1, first_name: 'Test' }),
  });

  const result = await validateInitData(initData, BOT_TOKEN);
  expect(result).not.toBeNull();
  expect(result?.id).toBe(1);
  expect(result?.first_name).toBe('Test');
});

// AUTH-001: auth_date is required
test('missing auth_date returns null', async () => {
  const encoder = new TextEncoder();
  const secretKeyData = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secretKey = await crypto.subtle.sign('HMAC', secretKeyData, encoder.encode(BOT_TOKEN));
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  // Build data check string WITHOUT auth_date
  const dataCheckString = 'user={"id":1,"first_name":"Test"}';
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString));
  const hash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const initData = `user=${encodeURIComponent('{"id":1,"first_name":"Test"}')}&hash=${hash}`;

  const result = await validateInitData(initData, BOT_TOKEN);
  expect(result).toBeNull();
});

// AUTH-001: auth_date freshness check
test('auth_date outside 5-minute window returns null', async () => {
  const oldDate = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
  const { initData } = await buildInitData({
    auth_date: String(oldDate),
    user: JSON.stringify({ id: 1, first_name: 'Test' }),
  });

  const result = await validateInitData(initData, BOT_TOKEN);
  expect(result).toBeNull();
});

test('auth_date in the future returns null', async () => {
  const futureDate = Math.floor(Date.now() / 1000) + 600; // 10 minutes ahead
  const { initData } = await buildInitData({
    auth_date: String(futureDate),
    user: JSON.stringify({ id: 1, first_name: 'Test' }),
  });

  const result = await validateInitData(initData, BOT_TOKEN);
  expect(result).toBeNull();
});

// AUTH-001: malformed auth_date
test('auth_date as non-numeric string returns null', async () => {
  const { initData } = await buildInitData({
    auth_date: 'not-a-number',
    user: JSON.stringify({ id: 1, first_name: 'Test' }),
  });

  const result = await validateInitData(initData, BOT_TOKEN);
  expect(result).toBeNull();
});

// AUTH-002: hash length mismatch
test('truncated hash returns null', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { initData, hash } = await buildInitData({
    auth_date: String(now),
    user: JSON.stringify({ id: 1, first_name: 'Test' }),
  });

  // Replace the valid hash with a truncated one
  const truncatedHash = hash.slice(0, 32); // 32 chars instead of 64
  const manipulated = initData.replace(`hash=${hash}`, `hash=${truncatedHash}`);

  const result = await validateInitData(manipulated, BOT_TOKEN);
  expect(result).toBeNull();
});

test('extended hash returns null', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { initData, hash } = await buildInitData({
    auth_date: String(now),
    user: JSON.stringify({ id: 1, first_name: 'Test' }),
  });

  // Append extra chars to the hash
  const extendedHash = hash + 'aabb';
  const manipulated = initData.replace(`hash=${hash}`, `hash=${extendedHash}`);

  const result = await validateInitData(manipulated, BOT_TOKEN);
  expect(result).toBeNull();
});

// Missing hash entirely
test('missing hash returns null', async () => {
  const result = await validateInitData('user={"id":1}', BOT_TOKEN);
  expect(result).toBeNull();
});

// Invalid signature (wrong token)
test('wrong bot token returns null', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { initData } = await buildInitData({
    auth_date: String(now),
    user: JSON.stringify({ id: 1, first_name: 'Test' }),
  });

  const result = await validateInitData(initData, 'wrong-token');
  expect(result).toBeNull();
});

// Missing user field
test('valid hash but missing user field returns null', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { initData } = await buildInitData({
    auth_date: String(now),
  });

  const result = await validateInitData(initData, BOT_TOKEN);
  expect(result).toBeNull();
});

// Malformed user JSON
test('valid hash but malformed user JSON returns null', async () => {
  const now = Math.floor(Date.now() / 1000);
  const { initData } = await buildInitData({
    auth_date: String(now),
    user: 'not-valid-json',
  });

  const result = await validateInitData(initData, BOT_TOKEN);
  expect(result).toBeNull();
});
