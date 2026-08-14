import { SettingsRepository } from '../../repositories';
import { requireSuperAdmin } from '../../utils/apiHelpers';
import type { ResourceHandler } from './types';

interface SettingsBody {
  settings?: Array<{ key: string; value: string }>;
  value?: string;
}

export const handleSettings: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env: _env } = ctx;

  // GET /settings
  if (path === 'settings' && method === 'GET') {
    const repo = new SettingsRepository(db);
    const allSettings = await repo.getAllSettings();
    // SEC-005: Filter out sensitive keys to prevent accidental exposure
    const SENSITIVE_KEYS = ['bot_token', 'api_key', 'secret', 'password', 'token'];
    const filteredSettings = allSettings.filter(
      (s: { key: string; value: string }) =>
        !SENSITIVE_KEYS.some((blocked) => s.key.toLowerCase().includes(blocked)),
    );
    return new Response(JSON.stringify({ settings: filteredSettings }), { headers: corsHeaders });
  }

  // POST /settings
  if (path === 'settings' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new SettingsRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as SettingsBody;
    if (!body || !Array.isArray(body.settings)) {
      return new Response(JSON.stringify({ error: 'settings must be an array' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (body.settings.length === 0) {
      return new Response(JSON.stringify({ error: 'settings array is empty' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (body.settings.length > 100) {
      return new Response(JSON.stringify({ error: 'settings array too large (max 100)' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    // Validate each item has required fields
    for (const item of body.settings) {
      if (!item || typeof item.key !== 'string' || typeof item.value !== 'string') {
        return new Response(
          JSON.stringify({ error: 'each setting must have string key and value' }),
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }
    }
    for (const item of body.settings) {
      await repo.setValue(item.key, item.value);
    }
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:settings:');
    }
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // DELETE /settings/:key
  if (path.startsWith('settings/') && method === 'DELETE') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const key = decodeURIComponent(path.split('/')[1]);
    const repo = new SettingsRepository(db);
    await repo.deleteSetting(key);
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:settings:');
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // PUT /settings/:key
  if (path.startsWith('settings/') && method === 'PUT') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const key = decodeURIComponent(path.split('/')[1]);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as SettingsBody;
    if (body.value === undefined || typeof body.value !== 'string')
      return new Response(JSON.stringify({ error: 'value required (string)' }), {
        status: 400,
        headers: corsHeaders,
      });
    const repo = new SettingsRepository(db);
    await repo.setValue(key, body.value);
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:settings:');
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  return null;
};
