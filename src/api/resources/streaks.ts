import { UserStateRepository, SettingsRepository } from '../../repositories';
import type { ResourceHandler } from './types';

export const handleStreaks: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // GET /streaks
  if (path === 'streaks' && method === 'GET') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new UserStateRepository(db);
    const users = await repo.listAll();
    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  // GET /streaks/config
  if (path === 'streaks/config' && method === 'GET') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new SettingsRepository(db);
    const [streakMessages, streakCronEnabled] = await Promise.all([
      repo.getValue('streak_messages'),
      repo.getValue('streak_cron_enabled'),
    ]);
    const streakMessagesVal = streakMessages ?? env.STREAK_MESSAGES ?? 'false';
    const streakCronEnabledVal = streakCronEnabled ?? env.STREAK_CRON_ENABLED ?? 'false';
    return new Response(
      JSON.stringify({
        streakMessages: streakMessagesVal === 'true',
        streakCronEnabled: streakCronEnabledVal === 'true',
      }),
      { headers: corsHeaders },
    );
  }

  // POST /streaks/config
  if (path === 'streaks/config' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const body: any = await request.json();
    const repo = new SettingsRepository(db);
    if (body.streakMessages !== undefined)
      await repo.setValue('streak_messages', body.streakMessages ? 'true' : 'false');
    if (body.streakCronEnabled !== undefined)
      await repo.setValue('streak_cron_enabled', body.streakCronEnabled ? 'true' : 'false');
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // POST /streaks/reset
  if (path === 'streaks/reset' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const body: any = await request.json();
    if (!body.telegramId)
      return new Response(JSON.stringify({ error: 'telegramId required' }), {
        status: 400,
        headers: corsHeaders,
      });
    const repo = new UserStateRepository(db);
    const ok = await repo.resetStreak(String(body.telegramId));
    return new Response(JSON.stringify({ success: ok }), { headers: corsHeaders });
  }

  return null;
};
