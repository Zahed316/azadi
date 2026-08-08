import { MenuConfigRepository } from '../../repositories';
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
    const now = new Date();
    const result = await repo.add({
      categoryId: parseInt(body.categoryId),
      menuSection: body.menuSection,
      displayOrder: body.displayOrder ?? 0,
      isVisible: body.isVisible ?? true,
      buttonLabel: body.buttonLabel ?? null,
      specialMessage: body.specialMessage ?? null,
      createdAt: now,
      updatedAt: now,
    });
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
    const repo = new MenuConfigRepository(db);
    const body: any = await request.json(); // { items: [{id, displayOrder}] }
    await repo.reorder(body.items);
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // PUT /menu-config/:id
  if (path.startsWith('menu-config/') && path.split('/').length === 2 && method === 'PUT') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const id = parseInt(path.split('/')[1]);
    const repo = new MenuConfigRepository(db);
    const body: any = await request.json();
    await repo.update(id, {
      menuSection: body.menuSection,
      displayOrder: body.displayOrder,
      isVisible: body.isVisible,
      buttonLabel: body.buttonLabel ?? null,
      specialMessage: body.specialMessage ?? null,
    });
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /menu-config/:id
  if (path.startsWith('menu-config/') && path.split('/').length === 2 && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const id = parseInt(path.split('/')[1]);
    const repo = new MenuConfigRepository(db);
    await repo.delete(id);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
