import { UserStateRepository, SettingsRepository } from '../../repositories';
import { requireSuperAdmin, jsonSuccess, jsonError } from '../../utils/apiHelpers';
import type { ResourceHandler } from './types';

interface StreakConfigBody {
  streakMessages?: boolean;
  streakCronEnabled?: boolean;
}

interface StreakResetBody {
  telegramId?: string | number;
}

export const handleStreaks: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // GET /streaks
  if (path === 'streaks' && method === 'GET') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new UserStateRepository(db);
    const users = await repo.listAll();
    return jsonSuccess({ users }, corsHeaders);
  }

  // GET /streaks/config
  if (path === 'streaks/config' && method === 'GET') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new SettingsRepository(db);
    const [streakMessages, streakCronEnabled] = await Promise.all([
      repo.getValue('streak_messages'),
      repo.getValue('streak_cron_enabled'),
    ]);
    const streakMessagesVal = streakMessages ?? env.STREAK_MESSAGES ?? 'false';
    const streakCronEnabledVal = streakCronEnabled ?? env.STREAK_CRON_ENABLED ?? 'false';
    return jsonSuccess(
      {
        streakMessages: streakMessagesVal === 'true',
        streakCronEnabled: streakCronEnabledVal === 'true',
      },
      corsHeaders,
    );
  }

  // POST /streaks/config
  if (path === 'streaks/config' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as StreakConfigBody;
    const repo = new SettingsRepository(db);
    if (body.streakMessages !== undefined)
      await repo.setValue('streak_messages', body.streakMessages ? 'true' : 'false');
    if (body.streakCronEnabled !== undefined)
      await repo.setValue('streak_cron_enabled', body.streakCronEnabled ? 'true' : 'false');
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:settings:');
    }
    return jsonSuccess({ success: true }, corsHeaders);
  }

  // POST /streaks/reset
  if (path === 'streaks/reset' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as StreakResetBody;
    if (!body.telegramId) return jsonError('telegramId required', corsHeaders);
    const repo = new UserStateRepository(db);
    const ok = await repo.resetStreak(String(body.telegramId));
    return jsonSuccess({ success: ok }, corsHeaders);
  }

  return null;
};
