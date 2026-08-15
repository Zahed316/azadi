import { timingSafeEqual } from '../utils/crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export async function validateInitData(
  initData: string,
  botToken: string,
): Promise<TelegramUser | null> {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');

  if (!hash) {
    return null;
  }

  urlParams.delete('hash');

  const keys = Array.from(urlParams.keys()).sort();
  const dataCheckString = keys.map((key) => `${key}=${urlParams.get(key)}`).join('\n');

  const encoder = new TextEncoder();
  const secretKeyData = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const secretKey = await crypto.subtle.sign('HMAC', secretKeyData, encoder.encode(botToken));

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    secretKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time hex comparison — see src/utils/crypto.ts.
  if (!timingSafeEqual(hash, signatureHex)) {
    return null;
  }

  // AUTH-001: Validate auth_date is present and fresh to prevent replay attacks.
  // Telegram's spec recommends checking that auth_date is within a reasonable
  // window to limit token replay. Without this check, a stolen initData works
  // indefinitely. We use 24 hours (86400s) instead of Telegram's suggested 5
  // minutes because Mini Apps that stay open for longer sessions (e.g., admin
  // dashboards) would otherwise fail auth after the window expires, causing
  // the app to show degraded state. The risk is acceptable for trusted admin
  // users — an attacker would need both the bot token AND the user's initData.
  const authDateStr = urlParams.get('auth_date');
  if (!authDateStr) {
    return null;
  }
  const authDate = parseInt(authDateStr, 10);
  const now = Math.floor(Date.now() / 1000);
  const MAX_AGE_SECONDS = 86400; // 24 hours — long-lived Mini App sessions
  if (Number.isNaN(authDate) || Math.abs(now - authDate) > MAX_AGE_SECONDS) {
    return null;
  }

  const userStr = urlParams.get('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (_e) {
      return null;
    }
  }

  return null;
}
