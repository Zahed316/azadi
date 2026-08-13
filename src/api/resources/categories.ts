import { CategoryRepository } from '../../repositories';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

export const handleCategories: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;

  // GET /categories
  if (path === 'categories' && method === 'GET') {
    const repo = new CategoryRepository(db);
    const categoriesList = await repo.getAllCategories();
    return new Response(JSON.stringify({ categories: categoriesList }), {
      headers: corsHeaders,
    });
  }

  // POST /categories
  if (path === 'categories' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new CategoryRepository(db);
    const body: any = await request.json();
    await repo.addCategory({
      name: body.name,
      description: body.description || null,
      emoji: body.emoji || null,
      sortOrder: body.sortOrder || 0,
    });
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.deleteByPrefix('cache:visible-categories');
    }
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // PUT /categories/:id
  if (path.startsWith('categories/') && method === 'PUT') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new CategoryRepository(db);
    const body: any = await request.json();
    await repo.updateCategory(id, {
      name: body.name,
      description: body.description || null,
      emoji: body.emoji || null,
      sortOrder: body.sortOrder || 0,
    });
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.deleteByPrefix('cache:visible-categories');
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /categories/:id
  if (path.startsWith('categories/') && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new CategoryRepository(db);
    await repo.deleteCategory(id);
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:menu:');
      await ctx.cache.deleteByPrefix('cache:visible-categories');
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
