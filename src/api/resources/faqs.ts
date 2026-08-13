import { FaqRepository } from '../../repositories';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

export const handleFaqs: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;

  // GET /faqs
  if (path === 'faqs' && method === 'GET') {
    const repo = new FaqRepository(db);
    const faqs = await repo.getAll();
    return new Response(JSON.stringify({ faqs }), { headers: corsHeaders });
  }

  // POST /faqs
  if (path === 'faqs' && method === 'POST') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const repo = new FaqRepository(db);
    const body: any = await request.json();
    if (!body.question || !body.answer) {
      return new Response(JSON.stringify({ error: 'question and answer required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    await repo.add(body.question, body.answer);
    if (ctx.cache) {
      await ctx.cache.delete('cache:faq:all');
    }
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // PUT /faqs/:id
  if (path.startsWith('faqs/') && path.split('/').length === 2 && method === 'PUT') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new FaqRepository(db);
    const body: any = await request.json();
    if (!body.question || !body.answer) {
      return new Response(JSON.stringify({ error: 'question and answer required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    await repo.update(id, body.question, body.answer);
    if (ctx.cache) {
      await ctx.cache.delete('cache:faq:all');
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /faqs/:id
  if (path.startsWith('faqs/') && path.split('/').length === 2 && method === 'DELETE') {
    if (!isSuperAdmin)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new FaqRepository(db);
    await repo.delete(id);
    if (ctx.cache) {
      await ctx.cache.delete('cache:faq:all');
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
