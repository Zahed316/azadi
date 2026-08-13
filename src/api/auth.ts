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

  // Constant-time hex comparison. `===` on strings short-circuits on the first
  // mismatched char, leaking the index of the first byte difference through
  // timing. Workers jitter dominates the side channel in practice, but the
  // canonical Telegram-spec validation is constant-time — match it.
  if (hash.length !== signatureHex.length) {
    return null;
  }
  {
    let diff = 0;
    for (let i = 0; i < signatureHex.length; i++) {
      diff |= signatureHex.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    if (diff === 0) {
      // AUTH-001: Validate auth_date is present and fresh to prevent replay attacks.
      // Telegram's spec requires checking that auth_date is within a reasonable
      // window (5 minutes) to limit token replay. Without this check, a stolen
      // initData works indefinitely.
      const authDateStr = urlParams.get('auth_date');
      if (!authDateStr) {
        return null;
      }
      const authDate = parseInt(authDateStr, 10);
      const now = Math.floor(Date.now() / 1000);
      const MAX_AGE_SECONDS = 300; // 5 minutes
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
    }
  }

  return null;
}
