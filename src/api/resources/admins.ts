import { admins } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { CategoryRepository } from '../../repositories';
import { getDb } from '../../database/client';
import type { ResourceHandler } from './types';

export const handleAdmins: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;
  const dbClient = getDb(db);

  // GET /admins
  if (path === 'admins' && method === 'GET') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const allAdmins = await dbClient.select().from(admins);
    return new Response(JSON.stringify({ admins: allAdmins }), { headers: corsHeaders });
  }

  // POST /admins
  if (path === 'admins' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const body: any = await request.json();
    if (!body.telegramId) {
      return new Response(JSON.stringify({ error: 'telegramId required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    // Validate categoryId exists if provided
    if (body.categoryId) {
      const catRepo = new CategoryRepository(db);
      const cat = await catRepo.getCategoryById(parseInt(body.categoryId));
      if (!cat) {
        return new Response(JSON.stringify({ error: 'Category not found' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    }
    // AUTH-003: Validate role enum
    const VALID_ROLES = ['super_admin', 'category_admin'];
    const role = body.role || 'category_admin';
    if (!VALID_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Must be super_admin or category_admin' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    await dbClient.insert(admins).values({
      telegramId: parseInt(body.telegramId),
      role,
      categoryId: body.categoryId ? parseInt(body.categoryId) : null,
    });
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // DELETE /admins/:id
  if (path.startsWith('admins/') && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const id = parseInt(path.split('/')[1]);

    // AUTH-002: Prevent self-deletion to avoid accidental lockout
    if (id === ctx.telegramId) {
      return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    await dbClient.delete(admins).where(eq(admins.telegramId, id));
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
