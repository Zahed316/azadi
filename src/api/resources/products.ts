import { ProductRepository, BranchRepository } from '../../repositories';
import { parseRequiredInt } from '../../utils/validation';
import type { ResourceHandler } from './types';

interface ProductBody {
  name: string;
  categoryId: number;
  description?: string;
  price?: number;
  unit?: string;
  available?: boolean;
  featured?: boolean;
  isSeasonal?: boolean;
  imageUrl?: string;
  stock?: number;
  priceOnRequest?: boolean;
  calories?: number;
  caffeineMg?: number;
  allergens?: string;
  sizeOptions?: string;
  syrupOptions?: string;
  coffeeDetails?: {
    origin?: string;
    farm?: string;
    altitude?: string;
    processing?: string;
    variety?: string;
    roastLevel?: string;
    flavorNotes?: string;
    recommendedBrew?: string;
    acidity?: string;
    body?: string;
    brewGuide?: string;
  } | null;
}

interface ProductBatchBody {
  ids: number[];
  updateData?: Partial<ProductBody>;
  action: 'update' | 'delete';
}

interface ProductStockBody {
  stock?: number;
  available?: boolean;
}

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as ProductBody;
    const catIdResult = parseRequiredInt(String(body.categoryId), 'categoryId');
    if (catIdResult instanceof Response) return catIdResult;
    const catId = catIdResult;
    if (!isSuperAdmin && allowedCategoryId !== catId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot add to this category' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    const result = await repo.addProduct({
      name: body.name,
      categoryId: catId,
      description: body.description ?? null,
      price: body.price ?? null,
      stock: body.stock ?? 0,
      unit: body.unit || 'item',
      imageUrl: body.imageUrl ?? null,
      available: body.available ?? true,
      featured: body.featured ?? false,
      priceOnRequest: body.priceOnRequest ?? false,
      isSeasonal: body.isSeasonal ?? false,
      sizeOptions: body.sizeOptions ?? null,
      syrupOptions: body.syrupOptions ?? null,
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
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:products:');
    }
    return new Response(JSON.stringify({ success: true }), { status: 201, headers: corsHeaders });
  }

  // POST /products/batch
  if (path === 'products/batch' && method === 'POST') {
    const repo = new ProductRepository(db);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as ProductBatchBody;

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return new Response(JSON.stringify({ error: 'ids array required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Batch fetch all products in one query
    const fetchedProducts = await repo.getProductsByIds(body.ids);
    const productMap = new Map(fetchedProducts.map((p) => [p.id, p]));
    const allProducts = body.ids.map((id) => productMap.get(id) ?? null);
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

    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:products:');
    }
    return new Response(JSON.stringify({ success: true, results }), { headers: corsHeaders });
  }

  // PUT /products/:id/image (must be before general /products/:id handler)
  if (path.startsWith('products/') && path.endsWith('/image') && method === 'PUT') {
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
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
      if (ctx.cache) {
        await ctx.cache.deleteByPrefix('cache:products:');
      }
      return new Response(JSON.stringify({ success: true, imageUrl: body.imageUrl }), {
        headers: corsHeaders,
      });
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
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
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
      if (ctx.cache) {
        await ctx.cache.deleteByPrefix('cache:products:');
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: 'Failed to delete image' }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // POST /products/:id/clone (must be before general /products/:id handler)
  if (path.startsWith('products/') && path.endsWith('/clone') && method === 'POST') {
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;

    const repo = new ProductRepository(db);
    const source = await repo.getProductById(id);
    if (!source) {
      return new Response(JSON.stringify({ error: 'Source product not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Role check
    if (!isSuperAdmin && source.categoryId !== allowedCategoryId) {
      return new Response(JSON.stringify({ error: 'Forbidden: Cannot clone this product' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const body = await request.json<{ targetBranchId?: number }>();
    if (!body.targetBranchId) {
      return new Response(JSON.stringify({ error: 'targetBranchId required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate target branch exists
    const branchRepo = new BranchRepository(db);
    const targetBranch = await branchRepo.getBranchById(body.targetBranchId);
    if (!targetBranch) {
      return new Response(JSON.stringify({ error: 'Target branch not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const newProduct = await repo.cloneProduct(id, body.targetBranchId);
    if (!newProduct) {
      return new Response(JSON.stringify({ error: 'Clone failed' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:products:');
    }

    return new Response(JSON.stringify({ product: newProduct }), {
      status: 201,
      headers: corsHeaders,
    });
  }

  // PUT /products/:id/stock or /products/:id/toggle (path.split length === 3)
  // TODO: legacy path-split guard — migrate to /products/:id/stock and /products/:id/toggle routes
  if (path.startsWith('products/') && method === 'PUT' && path.split('/').length === 3) {
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as ProductStockBody;
    if (action === 'stock') {
      await repo.updateStock(id, body.stock!);
      if (ctx.cache) {
        await ctx.cache.deleteByPrefix('cache:products:');
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    } else if (action === 'toggle') {
      await repo.toggleAvailability(id, body.available!);
      if (ctx.cache) {
        await ctx.cache.deleteByPrefix('cache:products:');
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }
  }

  // PUT /products/:id (general update — after image/stock/toggle checks)
  if (path.startsWith('products/') && path.split('/').length === 2 && method === 'PUT') {
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const body = (await request.json()) as ProductBody;
    // If changing category, check permission
    if (body.categoryId !== undefined && !isSuperAdmin) {
      const permCatId = parseRequiredInt(String(body.categoryId), 'categoryId');
      if (permCatId instanceof Response) return permCatId;
      if (permCatId !== allowedCategoryId) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot move to this category' }), {
          status: 403,
          headers: corsHeaders,
        });
      }
    }

    const updateCatId =
      body.categoryId !== undefined
        ? parseRequiredInt(String(body.categoryId), 'categoryId')
        : undefined;
    if (updateCatId instanceof Response) return updateCatId;

    await repo.updateProduct(id, {
      name: body.name,
      price: body.price,
      stock: body.stock,
      categoryId: updateCatId,
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
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:products:');
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  // DELETE /products/:id (after image/stock/toggle checks)
  if (path.startsWith('products/') && path.split('/').length === 2 && method === 'DELETE') {
    const idResult = parseRequiredInt(path.split('/')[1], 'id');
    if (idResult instanceof Response) return idResult;
    const id = idResult;
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
    if (ctx.cache) {
      await ctx.cache.deleteByPrefix('cache:products:');
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return null;
};
