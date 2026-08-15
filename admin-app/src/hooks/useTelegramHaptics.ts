import { useCallback } from 'react';
import { hapticFeedback } from '@telegram-apps/sdk';

/**
 * Provides haptic feedback helpers backed by the Telegram Mini App SDK.
 *
 * All functions are no-ops when haptic feedback is not supported
 * (e.g. running outside Telegram's WebView).
 *
 * @example
 * ```tsx
 * const { tap, success, error, select } = useTelegramHaptics();
 *
 * <button onClick={() => { doThing(); success(); }}>Save</button>
 * ```
 */
export function useTelegramHaptics() {
  const tap = useCallback(() => {
    if (hapticFeedback.isSupported()) {
      hapticFeedback.impactOccurred('light');
    }
  }, []);

  const success = useCallback(() => {
    if (hapticFeedback.isSupported()) {
      hapticFeedback.notificationOccurred('success');
    }
  }, []);

  const error = useCallback(() => {
    if (hapticFeedback.isSupported()) {
      hapticFeedback.notificationOccurred('error');
    }
  }, []);

  const select = useCallback(() => {
    if (hapticFeedback.isSupported()) {
      hapticFeedback.selectionChanged();
    }
  }, []);

  return { tap, success, error, select };
}
