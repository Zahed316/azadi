import { MenuConfigRepository } from '../../repositories';
import { requireSuperAdmin, jsonSuccess, jsonError, noContent } from '../../utils/apiHelpers';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

interface MenuConfigBody {
  categoryId?: string;
  menuSection?: string;
  displayOrder?: number;
  isVisible?: boolean;
  buttonLabel?: string;
  specialMessage?: string;
}

interface MenuConfigReorderBody {
  items?: Array<{ id: number; displayOrder: number }>;
}

export const handleMenuConfig: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;

  // GET /menu-config
  if (path === 'menu-config' && method === 'GET') {
    const repo = new MenuConfigRepository(db);
    const configs = await repo.getAll();
    return jsonSuccess({ menuConfigs: configs }, corsHeaders);
  }

  // POST /menu-config
  if (path === 'menu-config' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new MenuConfigRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as MenuConfigBody;
    const catIdResult = parseRequiredInt(body.categoryId, 'categoryId');
    if (catIdResult instanceof Response) return catIdResult;
    const now = new Date();
    const result = await repo.add({
      categoryId: catIdResult,
      menuSection: body.menuSection!,
      displayOrder: body.displayOrder ?? 0,
      isVisible: body.isVisible ?? true,
      buttonLabel: body.buttonLabel ?? null,
      specialMessage: body.specialMessage ?? null,
      createdAt: now,
      updatedAt: now,
    });
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.delete('cache:visible-categories');
    }
    return jsonSuccess({ success: true, menuConfig: result[0] }, corsHeaders, 201);
  }

  // POST /menu-config/reorder (must be before /menu-config/:id)
  if (path === 'menu-config/reorder' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as MenuConfigReorderBody;
    if (!Array.isArray(body.items)) {
      return jsonError('items must be an array', corsHeaders);
    }
    for (const item of body.items) {
      if (typeof item?.id !== 'number' || typeof item?.displayOrder !== 'number') {
        return jsonError('Each item must have numeric id and displayOrder', corsHeaders);
      }
    }
    const repo = new MenuConfigRepository(db);
    try {
      await repo.reorder(body.items);
    } catch (e: unknown) {
      console.error('Menu config reorder error:', e);
      return jsonError('Reorder failed', corsHeaders, 500);
    }
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.delete('cache:visible-categories');
    }
    return jsonSuccess({ success: true }, corsHeaders);
  }

  // PUT /menu-config/:id
  if (path.startsWith('menu-config/') && path.split('/').length === 2 && method === 'PUT') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new MenuConfigRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as MenuConfigBody;
    await repo.update(id, {
      menuSection: body.menuSection,
      displayOrder: body.displayOrder,
      isVisible: body.isVisible,
      buttonLabel: body.buttonLabel ?? null,
      specialMessage: body.specialMessage ?? null,
    });
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.delete('cache:visible-categories');
    }
    return jsonSuccess({ success: true }, corsHeaders);
  }

  // DELETE /menu-config/:id
  if (path.startsWith('menu-config/') && path.split('/').length === 2 && method === 'DELETE') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new MenuConfigRepository(db);
    await repo.delete(id);
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.delete('cache:visible-categories');
    }
    return noContent(corsHeaders);
  }

  return null;
};
