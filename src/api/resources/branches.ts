import { BranchRepository } from '../../repositories';
import { requireSuperAdmin } from '../../utils/apiHelpers';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

interface BranchBody {
  name?: string;
  address?: string;
  phone?: string;
  location?: string;
  openingHours?: string;
  isActive?: boolean;
}

export const handleBranches: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;

  // GET /branches
  if (path === 'branches' && method === 'GET') {
    const repo = new BranchRepository(db);
    const branchesList = await repo.getAllBranches();
    return new Response(JSON.stringify({ branches: branchesList }), { headers: corsHeaders });
  }

  // POST /branches
  if (path === 'branches' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new BranchRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as BranchBody;
    if (!body.name || !body.address) {
      return new Response(JSON.stringify({ error: 'name and address required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    await repo.addBranch({
      name: body.name,
      address: body.address,
      phone: body.phone || null,
      location: body.location || null,
      openingHours: body.openingHours || null,
      isActive: body.isActive ?? true,
    });
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:branches:');
    }
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // PUT /branches/:id
  if (path.startsWith('branches/') && path.split('/').length === 2 && method === 'PUT') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new BranchRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as BranchBody;
    if (!body.name || !body.address) {
      return new Response(JSON.stringify({ error: 'name and address required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    await repo.updateBranch(id, {
      name: body.name,
      address: body.address,
      phone: body.phone || null,
      location: body.location || null,
      openingHours: body.openingHours || null,
      isActive: body.isActive ?? true,
    });
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:branches:');
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /branches/:id
  if (path.startsWith('branches/') && path.split('/').length === 2 && method === 'DELETE') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new BranchRepository(db);
    await repo.deleteBranch(id);
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:branches:');
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
