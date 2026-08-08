import { BranchRepository } from '../../repositories';
import type { ResourceHandler } from './types';

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
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new BranchRepository(db);
    const body: any = await request.json();
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
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // PUT /branches/:id
  if (path.startsWith('branches/') && path.split('/').length === 2 && method === 'PUT') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const id = parseInt(path.split('/')[1]);
    const repo = new BranchRepository(db);
    const body: any = await request.json();
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
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /branches/:id
  if (path.startsWith('branches/') && path.split('/').length === 2 && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const id = parseInt(path.split('/')[1]);
    const repo = new BranchRepository(db);
    await repo.deleteBranch(id);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
