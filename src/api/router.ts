import { Env } from '../bot';
import { validateInitData } from './auth';
import {
  ProductRepository,
  BranchRepository,
  FaqRepository,
  CategoryRepository,
  SettingsRepository,
  MenuConfigRepository,
  UserStateRepository,
  FavoritesRepository,
} from '../repositories';
import { getAdminRole } from '../middlewares/auth';
import { getDb } from '../database/client';
import { admins } from '../database/schema';
import { eq } from 'drizzle-orm';

export async function handleApiRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', ''); // e.g. "products"
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Telegram ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const initData = authHeader.replace('Telegram ', '');
  const user = await validateInitData(initData, env.TELEGRAM_BOT_TOKEN);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const adminRole = await getAdminRole(user.id, env.DB);
  if (!adminRole) {
    return new Response(JSON.stringify({ error: 'Forbidden: Not an admin' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  const isSuperAdmin = adminRole.role === 'super_admin';
  const allowedCategoryId = adminRole.categoryId;

  try {
    const db = env.DB;
    const dbClient = getDb(db);

    // Current User Info
    if (path === 'currentUser' && method === 'GET') {
      return new Response(JSON.stringify({ user: adminRole }), { headers: corsHeaders });
    }

    // Admins (Super Admin Only)
    if (path === 'admins') {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      if (method === 'GET') {
        const allAdmins = await dbClient.select().from(admins);
        return new Response(JSON.stringify({ admins: allAdmins }), { headers: corsHeaders });
      } else if (method === 'POST') {
        const body: any = await request.json();
        await dbClient.insert(admins).values({
          telegramId: parseInt(body.telegramId),
          role: body.role || 'category_admin',
          categoryId: body.categoryId ? parseInt(body.categoryId) : null,
        });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    if (path.startsWith('admins/') && method === 'DELETE') {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const id = parseInt(path.split('/')[1]);
      await dbClient.delete(admins).where(eq(admins.telegramId, id));
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Settings
    if (path === 'settings') {
      const repo = new SettingsRepository(db);
      if (method === 'GET') {
        const allSettings = await repo.getAllSettings();
        return new Response(JSON.stringify({ settings: allSettings }), { headers: corsHeaders });
      } else if (method === 'POST') {
        if (!isSuperAdmin)
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: corsHeaders,
          });
        const body: any = await request.json(); // Array of { key, value }
        for (const item of body.settings) {
          await repo.setValue(item.key, item.value);
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    if (path.startsWith('settings/') && method === 'DELETE') {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const key = decodeURIComponent(path.split('/')[1]);
      const repo = new SettingsRepository(db);
      await repo.deleteSetting(key);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Categories
    if (path === 'categories') {
      const repo = new CategoryRepository(db);
      if (method === 'GET') {
        const categoriesList = await repo.getAllCategories();
        return new Response(JSON.stringify({ categories: categoriesList }), {
          headers: corsHeaders,
        });
      } else if (method === 'POST') {
        if (!isSuperAdmin)
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: corsHeaders,
          });
        const body: any = await request.json();
        await repo.addCategory({
          name: body.name,
          description: body.description || null,
          emoji: body.emoji || null,
          sortOrder: body.sortOrder || 0,
        });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    if (path.startsWith('categories/')) {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const id = parseInt(path.split('/')[1]);
      const repo = new CategoryRepository(db);

      if (method === 'PUT') {
        const body: any = await request.json();
        await repo.updateCategory(id, {
          name: body.name,
          description: body.description || null,
          emoji: body.emoji || null,
          sortOrder: body.sortOrder || 0,
        });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } else if (method === 'DELETE') {
        await repo.deleteCategory(id);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    // --- Menu Config Routes ---
    if (path === 'menu-config') {
      const repo = new MenuConfigRepository(db);
      if (method === 'GET') {
        const configs = await repo.getAll();
        return new Response(JSON.stringify({ menuConfigs: configs }), { headers: corsHeaders });
      } else if (method === 'POST') {
        if (!isSuperAdmin)
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: corsHeaders,
          });
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
          headers: corsHeaders,
        });
      }
    }

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

    if (path.startsWith('menu-config/') && path.split('/').length === 2) {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const id = parseInt(path.split('/')[1]);
      const repo = new MenuConfigRepository(db);
      if (method === 'PUT') {
        const body: any = await request.json();
        await repo.update(id, {
          menuSection: body.menuSection,
          displayOrder: body.displayOrder,
          isVisible: body.isVisible,
          buttonLabel: body.buttonLabel ?? null,
          specialMessage: body.specialMessage ?? null,
        });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } else if (method === 'DELETE') {
        await repo.delete(id);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    // Products
    if (path === 'products') {
      const repo = new ProductRepository(db);
      if (method === 'GET') {
        const rows = await repo.getAllProductsWithDetails();
        // Flatten Drizzle join result into a single product object
        const products = rows.map((row) => ({
          ...row.products,
          coffee_details: row.coffee_details || null,
          category_name: row.categories?.name || null,
          category_emoji: row.categories?.emoji || null,
        }));
        return new Response(JSON.stringify({ products }), { headers: corsHeaders });
      } else if (method === 'POST') {
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
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    // Products Batch
    if (path === 'products/batch' && method === 'POST') {
      const repo = new ProductRepository(db);
      const body: { ids: number[]; updateData?: any; action: 'update' | 'delete' } =
        await request.json();

      for (const id of body.ids) {
        const product = await repo.getProductById(id);
        if (!product) continue;
        if (!isSuperAdmin && product.categoryId !== allowedCategoryId) continue; // Skip unauthorized

        if (body.action === 'delete') {
          await repo.deleteProduct(id);
        } else if (body.action === 'update' && body.updateData) {
          // If changing category, check permission
          if (
            body.updateData.categoryId &&
            !isSuperAdmin &&
            body.updateData.categoryId !== allowedCategoryId
          ) {
            continue; // Skip changing to unauthorized category
          }
          await repo.updateProduct(id, body.updateData);
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (path.startsWith('products/') && path.split('/').length === 2) {
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

      if (method === 'PUT') {
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
          calories: body.calories !== undefined ? body.calories : undefined,
          allergens: body.allergens !== undefined ? body.allergens : undefined,
          caffeineMg: body.caffeineMg !== undefined ? body.caffeineMg : undefined,
        });
        // Update coffee details: if coffeeDetails is present in body, set it (null deletes)
        if (body.coffeeDetails !== undefined) {
          await repo.setCoffeeDetails(id, body.coffeeDetails);
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } else if (method === 'DELETE') {
        await repo.deleteProduct(id);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    // Image upload: PUT /products/:id/image (multipart/form-data)
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
        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('multipart/form-data')) {
          return new Response(
            JSON.stringify({ error: 'فقط فایل‌های JPG، PNG و WebP پشتیبانی می‌شوند' }),
            { status: 400, headers: corsHeaders },
          );
        }

        const formData = await request.formData();
        const file = formData.get('file');
        if (!file || !(file instanceof Blob)) {
          return new Response(JSON.stringify({ error: 'No file provided' }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const fileContentType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        const { ImageService } = await import('../services/imageService');
        const imageUrl = await ImageService.uploadImage(
          env.PRODUCT_IMAGES,
          id,
          arrayBuffer,
          fileContentType,
        );

        await repo.updateProduct(id, { imageUrl });
        return new Response(JSON.stringify({ success: true, imageUrl }), { headers: corsHeaders });
      } catch (e: any) {
        if (e.name === 'ImageError') {
          return new Response(JSON.stringify({ error: e.message }), {
            status: 400,
            headers: corsHeaders,
          });
        }
        console.error(e);
        return new Response(JSON.stringify({ error: 'خطا در آپلود تصویر' }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Image delete: DELETE /products/:id/image
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
        const { ImageService } = await import('../services/imageService');
        await ImageService.deleteImage(env.PRODUCT_IMAGES, id);
        await repo.updateProduct(id, { imageUrl: null });
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: 'خطا در حذف تصویر' }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Fallback old PUT methods (stock/toggle)
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

    // --- FAQs CRUD ---
    if (path === 'faqs') {
      const repo = new FaqRepository(db);
      if (method === 'GET') {
        const faqs = await repo.getAll();
        return new Response(JSON.stringify({ faqs }), { headers: corsHeaders });
      } else if (method === 'POST') {
        if (!isSuperAdmin)
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: corsHeaders,
          });
        const body: any = await request.json();
        if (!body.question || !body.answer) {
          return new Response(JSON.stringify({ error: 'question and answer required' }), {
            status: 400,
            headers: corsHeaders,
          });
        }
        await repo.add(body.question, body.answer);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    if (path.startsWith('faqs/') && path.split('/').length === 2) {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const id = parseInt(path.split('/')[1]);
      const repo = new FaqRepository(db);
      if (method === 'PUT') {
        const body: any = await request.json();
        if (!body.question || !body.answer) {
          return new Response(JSON.stringify({ error: 'question and answer required' }), {
            status: 400,
            headers: corsHeaders,
          });
        }
        await repo.update(id, body.question, body.answer);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } else if (method === 'DELETE') {
        await repo.delete(id);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    // --- Branches CRUD ---
    if (path === 'branches') {
      const repo = new BranchRepository(db);
      if (method === 'GET') {
        const branchesList = await repo.getAllBranches();
        return new Response(JSON.stringify({ branches: branchesList }), { headers: corsHeaders });
      } else if (method === 'POST') {
        if (!isSuperAdmin)
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: corsHeaders,
          });
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
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    if (path.startsWith('branches/') && path.split('/').length === 2) {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const id = parseInt(path.split('/')[1]);
      const repo = new BranchRepository(db);
      if (method === 'PUT') {
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
      } else if (method === 'DELETE') {
        await repo.deleteBranch(id);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }
    }

    // --- Engagement: Streaks (super_admin only) ---
    if (path === 'streaks' && method === 'GET') {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const repo = new UserStateRepository(db);
      const users = await repo.listAll();
      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // --- Engagement: Favorites admin read (super_admin only) ---
    if (path === 'favorites' && method === 'GET') {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const groupBy = url.searchParams.get('groupBy') ?? 'user';
      if (groupBy !== 'user' && groupBy !== 'product') {
        return new Response(JSON.stringify({ error: 'Invalid groupBy' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const repo = new FavoritesRepository(db);
      const favorites = await repo.listAllGrouped();
      return new Response(JSON.stringify({ favorites }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // --- Engagement: Favorites admin remove (super_admin only) ---
    const favDeleteMatch = url.pathname.match(/^\/api\/favorites\/([^/]+)\/([^/]+)$/);
    if (favDeleteMatch && method === 'DELETE') {
      if (!isSuperAdmin)
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: corsHeaders,
        });
      const [, telegramId, productIdStr] = favDeleteMatch;
      const productId = parseInt(productIdStr, 10);
      if (Number.isNaN(productId)) {
        return new Response(JSON.stringify({ error: 'Invalid productId' }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const repo = new FavoritesRepository(db);
      const ok = await repo.remove(telegramId, productId);
      if (!ok) {
        return new Response(JSON.stringify({ ok: false }), { status: 404, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
