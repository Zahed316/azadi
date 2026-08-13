/**
 * In-memory per-user rate limiter for AI queries.
 *
 * Module-level Map survives across requests within the same Worker isolate.
 * Cross-isolate bypass is theoretically possible but extremely unlikely in
 * practice (Workers isolate reuse is sticky per CPU core).
 *
 * Replaces the log-based cooldown in aiService.ts which had a race condition:
 * logs were written via waitUntil, so concurrent requests could bypass the
 * 5-second cooldown by reading stale logs.
 */

const lastRequestByUser = new Map<string, number>();
const COOLDOWN_MS = 5_000;

/**
 * Check if the user is within the cooldown window. If not, set the cooldown
 * timestamp and return true (allowed). If yes, return false (rate-limited).
 */
export function checkAndSetCooldown(userId: string): boolean {
  const now = Date.now();
  const last = lastRequestByUser.get(userId) ?? 0;
  if (now - last < COOLDOWN_MS) {
    return false; // rate-limited
  }
  lastRequestByUser.set(userId, now);
  return true; // allowed
}

/**
 * Exported for testing only. Clears all cooldown state.
 */
export function resetCooldownState(): void {
  lastRequestByUser.clear();
}
