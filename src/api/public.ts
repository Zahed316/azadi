import { Env } from '../bot';
import { getDb } from '../database/client';
import { CacheService } from '../services/cache';
import { DataService } from '../services/data';
import { settings } from '../database/schema';
import { eq, asc } from 'drizzle-orm';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 100; // requests per window per IP

async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}:${Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW)}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) + 1 : 1;

  if (count > RATE_LIMIT_MAX) {
    return false;
  }

  await kv.put(key, count.toString(), { expirationTtl: RATE_LIMIT_WINDOW * 2 });
  return true;
}

const PUBLIC_SETTINGS_KEYS = [
  'about',
  'price_unit',
  'instagram',
  'welcome_message',
  'vat_note',
  'announcement',
];

export async function handlePublicApiRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/public/', ''); // e.g. "products"
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Rate limiting (fixed-window per IP)
  if (env.CACHE) {
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const allowed = await checkRateLimit(env.CACHE, clientIp);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          'Retry-After': RATE_LIMIT_WINDOW.toString(),
        },
      });
    }
  }

  // Only GET is allowed for public endpoints
  if (method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const cache = env.CACHE ? new CacheService(env.CACHE) : undefined;
  const dataService = new DataService(env.DB, cache);

  try {
    // --- GET /api/public/menu ---
    if (path === 'menu') {
      const sections = ['drinks', 'beans', 'cakes', 'extras'] as const;
      const sectionEntries = await Promise.all(
        sections.map(async (section) => ({
          section,
          entries: (await dataService.getBySection(section)).filter((e: any) => e.isVisible),
        })),
      );
      const menuData: Record<string, any[]> = Object.fromEntries(
        sectionEntries.map(({ section, entries }) => [section, entries]),
      );
      return new Response(JSON.stringify({ sections: menuData }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/products/featured ---
    if (path === 'products/featured') {
      const all = await dataService.getAllProductsWithDetails();
      const featured = all
        .filter((p) => p.products.featured && p.products.available)
        .map((p) => ({
          ...p.products,
          coffee_details: p.coffee_details,
          category: p.categories,
        }));
      return new Response(JSON.stringify({ products: featured }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/products/seasonal ---
    if (path === 'products/seasonal') {
      const all = await dataService.getAllProductsWithDetails();
      const seasonal = all
        .filter((p) => p.products.isSeasonal && p.products.available)
        .map((p) => ({
          ...p.products,
          coffee_details: p.coffee_details,
          category: p.categories,
        }));
      return new Response(JSON.stringify({ products: seasonal }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/products/:id ---
    const productMatch = path.match(/^products\/(\d+)$/);
    if (productMatch) {
      const id = parseInt(productMatch[1], 10);
      const [product, details] = await Promise.all([
        dataService.getProductById(id),
        dataService.getCoffeeDetails(id),
      ]);
      if (!product || !product.available) {
        return new Response(JSON.stringify({ error: 'Product not found' }), {
          status: 404,
          headers: CORS_HEADERS,
        });
      }
      const categories = await dataService.getAllCategories();
      const category = categories.find((c) => c.id === product.categoryId);
      return new Response(
        JSON.stringify({
          product: { ...product, coffee_details: details, category },
        }),
        { headers: CORS_HEADERS },
      );
    }

    // --- GET /api/public/products ---
    if (path === 'products') {
      const categoryIdParam = url.searchParams.get('categoryId');
      const categoryId = categoryIdParam ? parseInt(categoryIdParam, 10) : undefined;

      const all = await dataService.getAllProductsWithDetails();
      const available = all
        .filter((p) => {
          if (!p.products.available) return false;
          if (categoryId !== undefined && p.products.categoryId !== categoryId) return false;
          return true;
        })
        .map((p) => ({
          ...p.products,
          coffee_details: p.coffee_details,
          category: p.categories,
        }));
      return new Response(JSON.stringify({ products: available }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/categories ---
    if (path === 'categories') {
      const categories = await dataService.getAllCategories();
      return new Response(JSON.stringify({ categories }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/branches ---
    if (path === 'branches') {
      const branches = await dataService.getActiveBranches();
      return new Response(JSON.stringify({ branches }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/faq ---
    if (path === 'faq') {
      const faqs = await dataService.getAllFaqs();
      return new Response(JSON.stringify({ faqs }), { headers: CORS_HEADERS });
    }

    // --- GET /api/public/settings ---
    if (path === 'settings') {
      const db = getDb(env.DB);
      const rows = await db.select().from(settings);
      const filtered: Record<string, string> = {};
      for (const row of rows) {
        if (PUBLIC_SETTINGS_KEYS.includes(row.key)) {
          filtered[row.key] = row.value;
        }
      }
      return new Response(JSON.stringify({ settings: filtered }), { headers: CORS_HEADERS });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        operation: 'public-api-error',
        method,
        path,
        error: errMsg,
      }),
    );
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
