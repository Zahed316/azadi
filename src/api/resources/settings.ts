import { SettingsRepository } from '../../repositories';
import type { ResourceHandler } from './types';

export const handleSettings: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders, env } = ctx;

  // GET /settings
  if (path === 'settings' && method === 'GET') {
    const repo = new SettingsRepository(db);
    const allSettings = await repo.getAllSettings();
    return new Response(JSON.stringify({ settings: allSettings }), { headers: corsHeaders });
  }

  // POST /settings
  if (path === 'settings' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new SettingsRepository(db);
    const body: any = await request.json(); // Array of { key, value }
    for (const item of body.settings) {
      await repo.setValue(item.key, item.value);
    }
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // DELETE /settings/:key
  if (path.startsWith('settings/') && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const key = decodeURIComponent(path.split('/')[1]);
    const repo = new SettingsRepository(db);
    await repo.deleteSetting(key);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // PUT /settings/:key
  if (path.startsWith('settings/') && method === 'PUT') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const key = decodeURIComponent(path.split('/')[1]);
    const body: any = await request.json();
    if (body.value === undefined || typeof body.value !== 'string')
      return new Response(JSON.stringify({ error: 'value required (string)' }), {
        status: 400,
        headers: corsHeaders,
      });
    const repo = new SettingsRepository(db);
    await repo.setValue(key, body.value);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  return null;
};
