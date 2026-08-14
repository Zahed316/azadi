import { FaqRepository } from '../../repositories';
import { requireSuperAdmin, jsonSuccess, jsonError, noContent } from '../../utils/apiHelpers';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

interface FaqBody {
  question?: string;
  answer?: string;
  sortOrder?: number;
}

export const handleFaqs: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, request, corsHeaders } = ctx;

  // GET /faqs
  if (path === 'faqs' && method === 'GET') {
    const repo = new FaqRepository(db);
    const faqs = await repo.getAll();
    return jsonSuccess({ faqs }, corsHeaders);
  }

  // POST /faqs
  if (path === 'faqs' && method === 'POST') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const repo = new FaqRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as FaqBody;
    if (!body.question || !body.answer) {
      return jsonError('question and answer required', corsHeaders);
    }
    await repo.add(body.question, body.answer);
    if (ctx.cache) {
      await ctx.cache.delete('cache:faq:all');
    }
    return jsonSuccess({ success: true }, corsHeaders, 201);
  }

  // PUT /faqs/:id
  if (path.startsWith('faqs/') && path.split('/').length === 2 && method === 'PUT') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new FaqRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as FaqBody;
    if (!body.question || !body.answer) {
      return jsonError('question and answer required', corsHeaders);
    }
    await repo.update(id, body.question, body.answer);
    if (ctx.cache) {
      await ctx.cache.delete('cache:faq:all');
    }
    return jsonSuccess({ success: true }, corsHeaders);
  }

  // DELETE /faqs/:id
  if (path.startsWith('faqs/') && path.split('/').length === 2 && method === 'DELETE') {
    const guard = requireSuperAdmin(isSuperAdmin, corsHeaders);
    if (guard) return guard;
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
    const repo = new FaqRepository(db);
    await repo.delete(id);
    if (ctx.cache) {
      await ctx.cache.delete('cache:faq:all');
    }
    return noContent(corsHeaders);
  }

  return null;
};
