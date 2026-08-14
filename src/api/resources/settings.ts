import { SettingsRepository } from '../../repositories';
import { requireSuperAdmin, jsonSuccess, jsonError, noContent } from '../../utils/apiHelpers';
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
    return jsonSuccess({ settings: filteredSettings }, corsHeaders);
  }

  // POST /settings
  if (path === 'settings' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new SettingsRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as SettingsBody;
    if (!body || !Array.isArray(body.settings)) {
      return jsonError('settings must be an array', corsHeaders);
    }
    if (body.settings.length === 0) {
      return jsonError('settings array is empty', corsHeaders);
    }
    if (body.settings.length > 100) {
      return jsonError('settings array too large (max 100)', corsHeaders);
    }
    // Validate each item has required fields
    for (const item of body.settings) {
      if (!item || typeof item.key !== 'string' || typeof item.value !== 'string') {
        return jsonError('each setting must have string key and value', corsHeaders);
      }
    }
    for (const item of body.settings) {
      await repo.setValue(item.key, item.value);
    }
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:settings:');
    }
    return jsonSuccess({ success: true }, corsHeaders, 201);
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
    return noContent(corsHeaders);
  }

  // PUT /settings/:key
  if (path.startsWith('settings/') && method === 'PUT') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const key = decodeURIComponent(path.split('/')[1]);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as SettingsBody;
    if (body.value === undefined || typeof body.value !== 'string')
      return jsonError('value required (string)', corsHeaders);
    const repo = new SettingsRepository(db);
    await repo.setValue(key, body.value);
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:settings:');
    }
    return jsonSuccess({ success: true }, corsHeaders);
  }

  return null;
};
