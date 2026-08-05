// Phase 5.1: daily cron entry point. Resets streaks for users who haven't
// been seen in 48h. Gated by env.STREAK_CRON_ENABLED so the cron can be
// deployed with the trigger declared in wrangler.toml but the body inert
// until the operator is ready (mirrors USE_CONVERSATIONS in src/bot.ts).

import { Env } from '../bot';
import { UserStateRepository } from '../repositories';

export async function sweepStreaks(env: Env): Promise<void> {
  if (env.STREAK_CRON_ENABLED !== 'true') {
    console.log('streak cron: disabled (STREAK_CRON_ENABLED != "true")');
    return;
  }
  const repo = new UserStateRepository(env.DB);
  const reset = await repo.sweepStaleStreaks();
  console.log(`streak sweep: reset ${reset} stale user(s) to streak_days=0`);
}
