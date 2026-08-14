// ---------------------------------------------------------------------------
// AI Admin Assistant — tool executor
//
// Routes AI tool calls (name + parameters) to the existing repository
// layer and returns structured AiAction results. Write operations
// automatically invalidate the relevant KV cache prefixes.
// ---------------------------------------------------------------------------

import type { D1Database } from '@cloudflare/workers-types';
import type { ICacheService } from '../../services/types';
import type { AiAction } from './types';
import {
  ProductRepository,
  CategoryRepository,
  SettingsRepository,
  MenuConfigRepository,
} from '../../repositories';

// ---------------------------------------------------------------------------
// Execution context — D1 binding + optional KV cache, threaded through
// every handler so write ops can invalidate stale entries.
// ---------------------------------------------------------------------------

export interface ExecutorContext {
  db: D1Database;
  cache?: ICacheService;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Execute a single AI tool call and return a structured action result.
 *
 * @param toolName  - Name of the tool (matches `AiTool.name` from tools.ts)
 * @param params    - Parameters supplied by the AI model
 * @param ctx       - D1 binding + optional KV cache
 * @returns An `AiAction` describing success or failure with details.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  try {
    switch (toolName) {
      // -- Products (read) --
      case 'listProducts':
        return await handleListProducts(ctx);

      // -- Products (write) --
      case 'createProduct':
        return await handleCreateProduct(params, ctx);
      case 'updateProduct':
        return await handleUpdateProduct(params, ctx);
      case 'deleteProduct':
        return await handleDeleteProduct(params, ctx);
      case 'batchUpdateProducts':
        return await handleBatchUpdateProducts(params, ctx);

      // -- Categories (read) --
      case 'listCategories':
        return await handleListCategories(ctx);

      // -- Categories (write) --
      case 'createCategory':
        return await handleCreateCategory(params, ctx);
      case 'updateCategory':
        return await handleUpdateCategory(params, ctx);
      case 'deleteCategory':
        return await handleDeleteCategory(params, ctx);
      case 'reorderCategories':
        return await handleReorderCategories(params, ctx);

      // -- Settings --
      case 'updateSetting':
        return await handleUpdateSetting(params, ctx);
      case 'getSettings':
        return await handleGetSettings(params, ctx);

      // -- Menu config --
      case 'getMenuConfig':
        return await handleGetMenuConfig(ctx);
      case 'updateMenuConfig':
        return await handleUpdateMenuConfig(params, ctx);

      // -- Cache --
      case 'invalidateCache':
        return await handleInvalidateCache(params, ctx);

      default:
        return {
          type: toolName,
          result: 'error',
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AiExecutor] tool="${toolName}" error:`, message);
    return {
      type: toolName,
      result: 'error',
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Cache invalidation helpers
// ---------------------------------------------------------------------------

async function invalidate(cache: ICacheService | undefined, prefixes: string[]): Promise<void> {
  if (!cache) return;
  await Promise.all(prefixes.map((p) => cache.deleteByPrefix(p)));
}

const CACHE_PREFIXES = {
  products: 'cache:products:',
  categories: 'cache:menu:',
  visibleCategories: 'cache:visible-categories',
  settings: 'cache:settings:',
  menuConfig: 'cache:menu:',
} as const;

// ---------------------------------------------------------------------------
// Product handlers
// ---------------------------------------------------------------------------

async function handleCreateProduct(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new ProductRepository(ctx.db);
  const name = requireString(params, 'name');
  const categoryId = requireNumber(params, 'categoryId');
  const now = new Date();

  const result = await repo.addProduct({
    name,
    categoryId,
    description: optionalString(params, 'description'),
    price: optionalNumber(params, 'price'),
    stock: optionalNumber(params, 'stock') ?? 0,
    unit: optionalString(params, 'unit') || 'item',
    imageUrl: optionalString(params, 'imageUrl'),
    available: optionalBoolean(params, 'available') ?? true,
    featured: optionalBoolean(params, 'featured') ?? false,
    priceOnRequest: optionalBoolean(params, 'priceOnRequest') ?? false,
    isSeasonal: optionalBoolean(params, 'isSeasonal') ?? false,
    createdAt: now,
    updatedAt: now,
  });

  await invalidate(ctx.cache, [CACHE_PREFIXES.products, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'createProduct',
    result: 'success',
    details: { id: result[0]?.id, name },
  };
}

async function handleUpdateProduct(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new ProductRepository(ctx.db);
  const id = requireNumber(params, 'id');

  const existing = await repo.getProductById(id);
  if (!existing) {
    return { type: 'updateProduct', result: 'error', error: `Product ${id} not found` };
  }

  const data: Record<string, unknown> = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.categoryId !== undefined) data.categoryId = params.categoryId;
  if (params.price !== undefined) data.price = params.price;
  if (params.stock !== undefined) data.stock = params.stock;
  if (params.unit !== undefined) data.unit = params.unit;
  if (params.description !== undefined) data.description = params.description;
  if (params.available !== undefined) data.available = params.available;
  if (params.featured !== undefined) data.featured = params.featured;
  if (params.isSeasonal !== undefined) data.isSeasonal = params.isSeasonal;
  if (params.priceOnRequest !== undefined) data.priceOnRequest = params.priceOnRequest;
  if (params.imageUrl !== undefined) data.imageUrl = params.imageUrl;

  if (Object.keys(data).length === 0) {
    return { type: 'updateProduct', result: 'error', error: 'No fields to update' };
  }

  await repo.updateProduct(id, data);
  await invalidate(ctx.cache, [CACHE_PREFIXES.products, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'updateProduct',
    result: 'success',
    details: { id, updatedFields: Object.keys(data) },
  };
}

async function handleDeleteProduct(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new ProductRepository(ctx.db);
  const id = requireNumber(params, 'id');

  const existing = await repo.getProductById(id);
  if (!existing) {
    return { type: 'deleteProduct', result: 'error', error: `Product ${id} not found` };
  }

  await repo.deleteProduct(id);
  await invalidate(ctx.cache, [CACHE_PREFIXES.products, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'deleteProduct',
    result: 'success',
    details: { id, name: existing.name },
  };
}

async function handleBatchUpdateProducts(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new ProductRepository(ctx.db);
  const ids = requireNumberArray(params, 'ids');
  const action = requireString(params, 'action');

  if (action !== 'update' && action !== 'delete') {
    return {
      type: 'batchUpdateProducts',
      result: 'error',
      error: 'action must be "update" or "delete"',
    };
  }

  const fetched = await repo.getProductsByIds(ids);
  const productMap = new Map(fetched.map((p) => [p.id, p]));
  const results: Array<{ id: number; status: string }> = [];

  for (const id of ids) {
    const product = productMap.get(id);
    if (!product) {
      results.push({ id, status: 'not_found' });
      continue;
    }

    if (action === 'delete') {
      await repo.deleteProduct(id);
      results.push({ id, status: 'deleted' });
    } else {
      const updateData = (params.updateData as Record<string, unknown>) ?? {};
      await repo.updateProduct(id, updateData);
      results.push({ id, status: 'updated' });
    }
  }

  await invalidate(ctx.cache, [CACHE_PREFIXES.products, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'batchUpdateProducts',
    result: 'success',
    details: { action, count: results.length, results },
  };
}

// ---------------------------------------------------------------------------
// Category handlers
// ---------------------------------------------------------------------------

async function handleCreateCategory(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new CategoryRepository(ctx.db);
  const name = requireString(params, 'name');

  const result = await repo.addCategory({
    name,
    emoji: optionalString(params, 'emoji'),
    description: optionalString(params, 'description'),
    sortOrder: optionalNumber(params, 'sortOrder') ?? 0,
  });

  await invalidate(ctx.cache, [CACHE_PREFIXES.categories, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'createCategory',
    result: 'success',
    details: { id: result[0]?.id, name },
  };
}

async function handleUpdateCategory(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new CategoryRepository(ctx.db);
  const id = requireNumber(params, 'id');

  const existing = await repo.getCategoryById(id);
  if (!existing) {
    return { type: 'updateCategory', result: 'error', error: `Category ${id} not found` };
  }

  const data: Record<string, unknown> = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.emoji !== undefined) data.emoji = params.emoji;
  if (params.description !== undefined) data.description = params.description;
  if (params.sortOrder !== undefined) data.sortOrder = params.sortOrder;

  if (Object.keys(data).length === 0) {
    return { type: 'updateCategory', result: 'error', error: 'No fields to update' };
  }

  await repo.updateCategory(id, data);
  await invalidate(ctx.cache, [CACHE_PREFIXES.categories, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'updateCategory',
    result: 'success',
    details: { id, updatedFields: Object.keys(data) },
  };
}

async function handleDeleteCategory(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new CategoryRepository(ctx.db);
  const id = requireNumber(params, 'id');

  const existing = await repo.getCategoryById(id);
  if (!existing) {
    return { type: 'deleteCategory', result: 'error', error: `Category ${id} not found` };
  }

  await repo.deleteCategory(id);
  await invalidate(ctx.cache, [CACHE_PREFIXES.categories, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'deleteCategory',
    result: 'success',
    details: { id, name: existing.name },
  };
}

async function handleReorderCategories(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new CategoryRepository(ctx.db);
  const orderedIds = requireNumberArray(params, 'orderedIds');

  await Promise.all(orderedIds.map((id, index) => repo.updateCategory(id, { sortOrder: index })));

  await invalidate(ctx.cache, [CACHE_PREFIXES.categories, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'reorderCategories',
    result: 'success',
    details: { orderedIds },
  };
}

// ---------------------------------------------------------------------------
// Settings handlers
// ---------------------------------------------------------------------------

async function handleUpdateSetting(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new SettingsRepository(ctx.db);
  const key = requireString(params, 'key');
  const value = requireString(params, 'value');

  await repo.setValue(key, value);
  await invalidate(ctx.cache, [CACHE_PREFIXES.settings]);
  return {
    type: 'updateSetting',
    result: 'success',
    details: { key, value },
  };
}

async function handleGetSettings(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new SettingsRepository(ctx.db);
  const keys = params.keys as string[] | undefined;

  if (Array.isArray(keys) && keys.length > 0) {
    const results: Record<string, string | null> = {};
    for (const key of keys) {
      results[key] = await repo.getValue(key);
    }
    return {
      type: 'getSettings',
      result: 'success',
      details: { settings: results },
    };
  }

  const all = await repo.getAllSettings();
  const filtered = all.filter(
    (s) =>
      !['bot_token', 'api_key', 'secret', 'password', 'token'].some((blocked) =>
        s.key.toLowerCase().includes(blocked),
      ),
  );
  return {
    type: 'getSettings',
    result: 'success',
    details: { settings: filtered },
  };
}

// ---------------------------------------------------------------------------
// Read-only tool handlers
// ---------------------------------------------------------------------------

async function handleListProducts(ctx: ExecutorContext): Promise<AiAction> {
  const repo = new ProductRepository(ctx.db);
  const all = await repo.getAllProducts();
  // Strip internal fields the model doesn't need
  const items = all.map((p) => ({
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    price: p.price,
    stock: p.stock,
    unit: p.unit,
    available: p.available,
    featured: p.featured,
    isSeasonal: p.isSeasonal,
  }));
  return {
    type: 'listProducts',
    result: 'success',
    details: { products: items, count: items.length },
  };
}

async function handleListCategories(ctx: ExecutorContext): Promise<AiAction> {
  const repo = new CategoryRepository(ctx.db);
  const all = await repo.getAllCategories();
  const items = all.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    description: c.description,
    sortOrder: c.sortOrder,
  }));
  return {
    type: 'listCategories',
    result: 'success',
    details: { categories: items, count: items.length },
  };
}

async function handleGetMenuConfig(ctx: ExecutorContext): Promise<AiAction> {
  const repo = new MenuConfigRepository(ctx.db);
  const all = await repo.getAll();
  return {
    type: 'getMenuConfig',
    result: 'success',
    details: { menuConfig: all, count: all.length },
  };
}

// ---------------------------------------------------------------------------
// Menu config handler
// ---------------------------------------------------------------------------

async function handleUpdateMenuConfig(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  const repo = new MenuConfigRepository(ctx.db);
  const categoryId = requireNumber(params, 'categoryId');

  // Check if an entry already exists for this categoryId
  const all = await repo.getAll();
  const existing = all.find((entry) => entry.categoryId === categoryId);

  const now = new Date();

  if (existing) {
    const data: Record<string, unknown> = {};
    if (params.menuSection !== undefined) data.menuSection = params.menuSection;
    if (params.displayOrder !== undefined) data.displayOrder = params.displayOrder;
    if (params.isVisible !== undefined) data.isVisible = params.isVisible;
    if (params.buttonLabel !== undefined) data.buttonLabel = params.buttonLabel;
    if (params.specialMessage !== undefined) data.specialMessage = params.specialMessage;

    if (Object.keys(data).length === 0) {
      return { type: 'updateMenuConfig', result: 'error', error: 'No fields to update' };
    }

    await repo.update(existing.id, data);
    await invalidate(ctx.cache, [CACHE_PREFIXES.menuConfig, CACHE_PREFIXES.visibleCategories]);
    return {
      type: 'updateMenuConfig',
      result: 'success',
      details: { id: existing.id, categoryId, updatedFields: Object.keys(data) },
    };
  }

  // Create new entry
  const result = await repo.add({
    categoryId,
    menuSection: requireString(params, 'menuSection'),
    displayOrder: optionalNumber(params, 'displayOrder') ?? 0,
    isVisible: optionalBoolean(params, 'isVisible') ?? true,
    buttonLabel: optionalString(params, 'buttonLabel'),
    specialMessage: optionalString(params, 'specialMessage'),
    createdAt: now,
    updatedAt: now,
  });

  await invalidate(ctx.cache, [CACHE_PREFIXES.menuConfig, CACHE_PREFIXES.visibleCategories]);
  return {
    type: 'updateMenuConfig',
    result: 'success',
    details: { id: result[0]?.id, categoryId, created: true },
  };
}

// ---------------------------------------------------------------------------
// Cache handler
// ---------------------------------------------------------------------------

async function handleInvalidateCache(
  params: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<AiAction> {
  if (!ctx.cache) {
    return { type: 'invalidateCache', result: 'error', error: 'KV cache not available' };
  }

  const prefix = requireString(params, 'prefix');
  const prefixMap: Record<string, string> = {
    products: CACHE_PREFIXES.products,
    categories: CACHE_PREFIXES.categories,
    settings: CACHE_PREFIXES.settings,
    'menu-config': CACHE_PREFIXES.menuConfig,
    all: 'cache:',
  };

  const target = prefixMap[prefix];
  if (!target) {
    return { type: 'invalidateCache', result: 'error', error: `Unknown prefix: ${prefix}` };
  }

  await invalidate(ctx.cache, [target]);
  return {
    type: 'invalidateCache',
    result: 'success',
    details: { prefix, cacheKey: target },
  };
}

// ---------------------------------------------------------------------------
// Parameter validation helpers
// ---------------------------------------------------------------------------

function requireString(params: Record<string, unknown>, key: string): string {
  const val = params[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`Missing or invalid required parameter: ${key} (string)`);
  }
  return val;
}

function requireNumber(params: Record<string, unknown>, key: string): number {
  const val = params[key];
  if (typeof val !== 'number' || Number.isNaN(val)) {
    throw new Error(`Missing or invalid required parameter: ${key} (number)`);
  }
  return val;
}

function requireNumberArray(params: Record<string, unknown>, key: string): number[] {
  const val = params[key];
  if (!Array.isArray(val) || !val.every((v) => typeof v === 'number')) {
    throw new Error(`Missing or invalid required parameter: ${key} (number[])`);
  }
  return val;
}

function optionalString(params: Record<string, unknown>, key: string): string | null {
  const val = params[key];
  if (val === undefined || val === null) return null;
  if (typeof val !== 'string') throw new Error(`Parameter ${key} must be a string`);
  return val;
}

function optionalNumber(params: Record<string, unknown>, key: string): number | null {
  const val = params[key];
  if (val === undefined || val === null) return null;
  if (typeof val !== 'number' || Number.isNaN(val)) {
    throw new Error(`Parameter ${key} must be a number`);
  }
  return val;
}

function optionalBoolean(params: Record<string, unknown>, key: string): boolean | null {
  const val = params[key];
  if (val === undefined || val === null) return null;
  if (typeof val !== 'boolean') throw new Error(`Parameter ${key} must be a boolean`);
  return val;
}
