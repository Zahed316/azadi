import { admins } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { CategoryRepository } from '../../repositories';
import { getDb } from '../../database/client';
import { requireSuperAdmin, jsonSuccess, jsonError, noContent } from '../../utils/apiHelpers';
import { parseRequiredInt, parseOptionalInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

interface AdminBody {
  telegramId?: string;
  categoryId?: string;
  role?: string;
}

export const handleAdmins: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;
  const dbClient = getDb(db);

  // GET /admins
  if (path === 'admins' && method === 'GET') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const allAdmins = await dbClient.select().from(admins);
    return jsonSuccess({ admins: allAdmins }, corsHeaders);
  }

  // POST /admins
  if (path === 'admins' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as AdminBody;
    if (!body.telegramId) {
      return jsonError('telegramId required', corsHeaders);
    }
    // Validate categoryId exists if provided
    if (body.categoryId) {
      const catIdVal = parseOptionalInt(body.categoryId, 'categoryId');
      if (catIdVal !== null) {
        const catRepo = new CategoryRepository(db);
        const cat = await catRepo.getCategoryById(catIdVal);
        if (!cat) {
          return jsonError('Category not found', corsHeaders);
        }
      }
    }
    // AUTH-003: Validate role enum
    const VALID_ROLES = ['super_admin', 'category_admin'];
    const role = body.role || 'category_admin';
    if (!VALID_ROLES.includes(role)) {
      return jsonError('Invalid role. Must be super_admin or category_admin', corsHeaders);
    }
    const telegramIdResult = parseRequiredInt(body.telegramId, 'telegramId');
    if (telegramIdResult instanceof Response) return telegramIdResult;
    const adminCatId = body.categoryId ? parseOptionalInt(body.categoryId, 'categoryId') : null;
    await dbClient.insert(admins).values({
      telegramId: telegramIdResult,
      role,
      categoryId: adminCatId,
    });
    return jsonSuccess({ success: true }, corsHeaders, 201);
  }

  // DELETE /admins/:id
  if (path.startsWith('admins/') && method === 'DELETE') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;

    // AUTH-002: Prevent self-deletion to avoid accidental lockout
    if (id === ctx.telegramId) {
      return jsonError('Cannot delete your own account', corsHeaders, 403);
    }

    await dbClient.delete(admins).where(eq(admins.telegramId, id));
    return noContent(corsHeaders);
  }

  return null;
};
