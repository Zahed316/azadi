import { ProductRepository } from '../../repositories';
import type { ResourceHandler } from './types';

export const handleProducts: ResourceHandler = async (method, path, ctx) => {
  const { db, isSuperAdmin, allowedCategoryId, request, corsHeaders } = ctx;

  // GET /products
  if (path === 'products' && method === 'GET') {
    const repo = new ProductRepository(db);
    const rows = await repo.getAllProductsWithDetails();
    // Flatten Drizzle join result into a single product object
    const products = rows.map((row) => ({
      ...row.products,
      coffee_details: row.coffee_details || null,
      category_name: row.categories?.name || null,
      category_emoji: row.categories?.emoji || null,
    }));
    return new Response(JSON.stringify({ products }), { headers: corsHeaders });
  }

  // POST /products
  if (path === 'products' && method === 'POST') {
    const repo = new ProductRepository(db);
    const body: any = await request.json();
    const catId = parseInt(body.categoryId);
    if (!isSuperAdmin && allowedCategoryId !== catId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot add to this category' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    const result = await repo.addProduct({
      ...body,
      unit: body.unit || 'item',
      available: body.available ?? true,
      featured: body.featured ?? false,
      priceOnRequest: body.priceOnRequest ?? false,
      isSeasonal: body.isSeasonal ?? false,
      calories: body.calories ?? null,
      allergens: body.allergens ?? null,
      caffeineMg: body.caffeineMg ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Save coffee details if provided
    if (body.coffeeDetails && result[0]?.id) {
      await repo.setCoffeeDetails(result[0].id, body.coffeeDetails);
    }
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // POST /products/batch
  if (path === 'products/batch' && method === 'POST') {
    const repo = new ProductRepository(db);
    const body: { ids: number[]; updateData?: any; action: 'update' | 'delete' } =
      await request.json();

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return new Response(JSON.stringify({ error: 'ids array required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Batch fetch all products in one query
    const allProducts = await Promise.all(body.ids.map((id) => repo.getProductById(id)));
    const results: { id: number; status: string }[] = [];

    await Promise.allSettled(
      allProducts.map(async (product, i) => {
        const id = body.ids[i];
        if (!product) {
          results.push({ id, status: 'not_found' });
          return;
        }
        if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
          results.push({ id, status: 'forbidden' });
          return;
        }

        if (body.action === 'delete') {
          await repo.deleteProduct(id);
          results.push({ id, status: 'deleted' });
        } else if (body.action === 'update' && body.updateData) {
          if (
            body.updateData.categoryId &&
            !isSuperAdmin &&
            body.updateData.categoryId !== allowedCategoryId
          ) {
            results.push({ id, status: 'forbidden' });
            return;
          }
          await repo.updateProduct(id, body.updateData);
          results.push({ id, status: 'updated' });
        }
      }),
    );

    return new Response(JSON.stringify({ success: true, results }), { headers: corsHeaders });
  }

  // PUT /products/:id/image (must be before general /products/:id handler)
  if (path.startsWith('products/') && path.endsWith('/image') && method === 'PUT') {
    const id = parseInt(path.split('/')[1]);
    const repo = new ProductRepository(db);
    const product = await repo.getProductById(id);

    if (!product)
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify this product' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    try {
      const body = await request.json<{ imageUrl?: string }>();
      if (!body.imageUrl || typeof body.imageUrl !== 'string') {
        return new Response(JSON.stringify({ error: 'imageUrl is required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      // Basic URL validation
      try {
        new URL(body.imageUrl);
      } catch {
        return new Response(JSON.stringify({ error: 'imageUrl is not a valid URL' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      await repo.updateProduct(id, { imageUrl: body.imageUrl });
      return new Response(JSON.stringify({ success: true, imageUrl: body.imageUrl }), { headers: corsHeaders });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: 'Failed to save image' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // DELETE /products/:id/image (must be before general /products/:id handler)
  if (path.startsWith('products/') && path.endsWith('/image') && method === 'DELETE') {
    const id = parseInt(path.split('/')[1]);
    const repo = new ProductRepository(db);
    const product = await repo.getProductById(id);

    if (!product)
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify this product' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    try {
      await repo.updateProduct(id, { imageUrl: null });
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: 'Failed to delete image' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // PUT /products/:id/stock or /products/:id/toggle (path.split length === 3)
  // TODO: legacy path-split guard — migrate to /products/:id/stock and /products/:id/toggle routes
  if (path.startsWith('products/') && method === 'PUT' && path.split('/').length === 3) {
    const id = parseInt(path.split('/')[1]);
    const action = path.split('/')[2];
    const repo = new ProductRepository(db);
    const product = await repo.getProductById(id);

    if (!product)
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body: any = await request.json();
    if (action === 'stock') {
      await repo.updateStock(id, body.stock);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } else if (action === 'toggle') {
      await repo.toggleAvailability(id, body.available);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
  }

  // PUT /products/:id (general update — after image/stock/toggle checks)
  if (path.startsWith('products/') && path.split('/').length === 2 && method === 'PUT') {
    const id = parseInt(path.split('/')[1]);
    const repo = new ProductRepository(db);
    const product = await repo.getProductById(id);

    if (!product)
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify this product' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body: any = await request.json();
    // If changing category, check permission
    if (
      body.categoryId !== undefined &&
      !isSuperAdmin &&
      parseInt(body.categoryId) !== allowedCategoryId
    ) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Cannot move to this category' }),
        { status: 403, headers: corsHeaders },
      );
    }

    await repo.updateProduct(id, {
      name: body.name,
      price: body.price,
      stock: body.stock,
      categoryId: body.categoryId !== undefined ? parseInt(body.categoryId) : undefined,
      description: body.description !== undefined ? body.description : null,
      unit: body.unit || 'item',
      available: body.available !== undefined ? body.available : true,
      featured: body.featured !== undefined ? body.featured : undefined,
      priceOnRequest: body.priceOnRequest !== undefined ? body.priceOnRequest : undefined,
      isSeasonal: body.isSeasonal !== undefined ? body.isSeasonal : undefined,
      sizeOptions: body.sizeOptions !== undefined ? body.sizeOptions : undefined,
      syrupOptions: body.syrupOptions !== undefined ? body.syrupOptions : undefined,
      calories: body.calories !== undefined ? body.calories : undefined,
      allergens: body.allergens !== undefined ? body.allergens : undefined,
      caffeineMg: body.caffeineMg !== undefined ? body.caffeineMg : undefined,
    });
    // Update coffee details: if coffeeDetails is present in body, set it (null deletes)
    if (body.coffeeDetails !== undefined) {
      await repo.setCoffeeDetails(id, body.coffeeDetails);
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /products/:id (after image/stock/toggle checks)
  if (path.startsWith('products/') && path.split('/').length === 2 && method === 'DELETE') {
    const id = parseInt(path.split('/')[1]);
    const repo = new ProductRepository(db);
    const product = await repo.getProductById(id);

    if (!product)
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    if (!isSuperAdmin && product.categoryId !== allowedCategoryId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify this product' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    await repo.deleteProduct(id);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
