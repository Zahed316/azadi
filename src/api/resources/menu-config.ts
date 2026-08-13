import { MenuConfigRepository } from '../../repositories';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

export const handleMenuConfig: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;

  // GET /menu-config
  if (path === 'menu-config' && method === 'GET') {
    const repo = new MenuConfigRepository(db);
    const configs = await repo.getAll();
    return new Response(JSON.stringify({ menuConfigs: configs }), { headers: corsHeaders });
  }

  // POST /menu-config
  if (path === 'menu-config' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new MenuConfigRepository(db);
    const body: any = await request.json();
    const catIdResult = parseRequiredInt(body.categoryId, 'categoryId');
    if (catIdResult instanceof Response) return catIdResult;
    const now = new Date();
    const result = await repo.add({
      categoryId: catIdResult,
      menuSection: body.menuSection,
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
    return new Response(JSON.stringify({ success: true, menuConfig: result[0] }), {
      status: 201,
      headers: corsHeaders,
    });
  }

  // POST /menu-config/reorder (must be before /menu-config/:id)
  if (path === 'menu-config/reorder' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const body: any = await request.json();
    if (!Array.isArray(body.items)) {
      return new Response(JSON.stringify({ error: 'items must be an array' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    for (const item of body.items) {
      if (typeof item?.id !== 'number' || typeof item?.displayOrder !== 'number') {
        return new Response(
          JSON.stringify({ error: 'Each item must have numeric id and displayOrder' }),
          { status: 400, headers: corsHeaders },
        );
      }
    }
    const repo = new MenuConfigRepository(db);
    try {
      await repo.reorder(body.items);
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || 'Reorder failed' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.delete('cache:visible-categories');
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // PUT /menu-config/:id
  if (path.startsWith('menu-config/') && path.split('/').length === 2 && method === 'PUT') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new MenuConfigRepository(db);
    const body: any = await request.json();
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
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /menu-config/:id
  if (path.startsWith('menu-config/') && path.split('/').length === 2 && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new MenuConfigRepository(db);
    await repo.delete(id);
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.delete('cache:visible-categories');
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
