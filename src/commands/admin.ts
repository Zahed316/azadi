import { Bot } from 'grammy';
import { adminAuth } from '../middlewares/auth';
import { MyContext } from '../types/context';
import { Env } from '../bot';
import { Conversation, createConversation } from '@grammyjs/conversations';
import { ProductRepository, CategoryRepository, BranchRepository, FaqRepository } from '../repositories';

type MyConversation = Conversation<MyContext>;

async function addProductConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('📦 نام محصول؟');
  const nameMsg = await conversation.waitFor('message:text');
  const name = nameMsg.message.text;

  await ctx.reply('💰 قیمت (به تومان)؟');
  const priceMsg = await conversation.waitFor('message:text');
  const price = parseFloat(priceMsg.message.text);
  if (isNaN(price)) {
    await ctx.reply('❌ قیمت نامعتبر است. عملیات لغو شد.');
    return;
  }

  const categoryRepo = new CategoryRepository(ctx.env.DB);
  const categories = await categoryRepo.getAllCategories();
  const catText = categories.map((c: any) => `${c.id} for ${c.name}`).join(', ');

  await ctx.reply(`📂 شناسه دسته‌بندی؟ (${catText})`);
  const catMsg = await conversation.waitFor('message:text');
  const categoryId = parseInt(catMsg.message.text);
  if (isNaN(categoryId)) {
    await ctx.reply('❌ شناسه دسته‌بندی نامعتبر است. عملیات لغو شد.');
    return;
  }

  await ctx.reply('📝 توضیحات؟');
  const descMsg = await conversation.waitFor('message:text');
  const description = descMsg.message.text;

  await ctx.reply('📦 موجودی اولیه؟');
  const stockMsg = await conversation.waitFor('message:text');
  const stock = parseInt(stockMsg.message.text);
  if (isNaN(stock)) {
    await ctx.reply('❌ مقدار موجودی نامعتبر است. عملیات لغو شد.');
    return;
  }

  await ctx.reply('💰 آیا قیمت توافقی/سوال در کافه است؟ (ب/خ)');
  const porMsg = await conversation.waitFor('message:text');
  const priceOnRequest = ['ب', 'y', 'yes', 'بله'].includes(porMsg.message.text.toLowerCase());

  await ctx.reply('🌿 آیا این محصول مخصوص این فصل است؟ (ب/خ)');
  const seasonalMsg = await conversation.waitFor('message:text');
  const isSeasonal = ['ب', 'y', 'yes', 'بله'].includes(seasonalMsg.message.text.toLowerCase());

  const repo = new ProductRepository(ctx.env.DB);
  await repo.addProduct({ 
    name, price, categoryId, description, stock,
    unit: 'item', available: true, featured: false,
    priceOnRequest, isSeasonal,
    createdAt: new Date(), updatedAt: new Date()
  });
  
  await ctx.reply(`✅ محصول "${name}" با موفقیت اضافه شد!`);
}

async function updateStockConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('🆔 شناسه محصول برای به‌روزرسانی موجودی را وارد کنید:');
  const idMsg = await conversation.waitFor('message:text');
  const productId = parseInt(idMsg.message.text);
  if (isNaN(productId)) {
    await ctx.reply('❌ شناسه محصول نامعتبر است. عملیات لغو شد.');
    return;
  }

  await ctx.reply('📦 مقدار موجودی جدید را وارد کنید:');
  const stockMsg = await conversation.waitFor('message:text');
  const newStock = parseInt(stockMsg.message.text);
  if (isNaN(newStock)) {
    await ctx.reply('❌ مقدار موجودی نامعتبر است. عملیات لغو شد.');
    return;
  }

  const repo = new ProductRepository(ctx.env.DB);
  await repo.updateStock(productId, newStock);
  await ctx.reply(`✅ موجودی محصول ${productId} به ${newStock} به‌روزرسانی شد.`);
}

async function addFaqConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('❓ متن سوال را وارد کنید:');
  const qMsg = await conversation.waitFor('message:text');
  const question = qMsg.message.text;

  await ctx.reply('💬 متن پاسخ را وارد کنید:');
  const aMsg = await conversation.waitFor('message:text');
  const answer = aMsg.message.text;

  const repo = new FaqRepository(ctx.env.DB);
  await repo.add(question, answer);
  await ctx.reply('✅ سوال متداول با موفقیت اضافه شد!');
}

async function deleteFaqConversation(conversation: MyConversation, ctx: MyContext) {
  const repo = new FaqRepository(ctx.env.DB);
  const faqs = await repo.getAll();
  if (faqs.length === 0) {
    await ctx.reply('هیچ سوال متداولی برای حذف وجود ندارد.');
    return;
  }
  const text = faqs.map((f: any) => `🆔 ${f.id} - ${f.question}`).join('\n');
  await ctx.reply(`❓ سوالات متداول:\n\n${text}\n\n🆔 شناسه سوال برای حذف را وارد کنید:`);
  const idMsg = await conversation.waitFor('message:text');
  const id = parseInt(idMsg.message.text);
  if (isNaN(id)) {
    await ctx.reply('❌ شناسه نامعتبر است. عملیات لغو شد.');
    return;
  }
  await repo.delete(id);
  await ctx.reply('✅ سوال متداول با موفقیت حذف شد!');
}

async function addBranchConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('📍 نام شعبه را وارد کنید:');
  const nameMsg = await conversation.waitFor('message:text');
  const name = nameMsg.message.text;

  await ctx.reply('🏢 آدرس را وارد کنید:');
  const addressMsg = await conversation.waitFor('message:text');
  const address = addressMsg.message.text;

  await ctx.reply('📞 شماره تلفن را وارد کنید (برای رد کردن - بزنید):');
  const phoneMsg = await conversation.waitFor('message:text');
  const phone = phoneMsg.message.text !== '-' ? phoneMsg.message.text : null;

  await ctx.reply('⏰ ساعت کاری را وارد کنید (برای رد کردن - بزنید):');
  const hoursMsg = await conversation.waitFor('message:text');
  const openingHours = hoursMsg.message.text !== '-' ? hoursMsg.message.text : null;

  const repo = new BranchRepository(ctx.env.DB);
  await repo.addBranch({ name, address, phone, openingHours, isActive: true });
  await ctx.reply(`✅ شعبه "${name}" با موفقیت اضافه شد!`);
}

async function toggleProductConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('🆔 شناسه محصول برای تغییر وضعیت را وارد کنید:');
  const idMsg = await conversation.waitFor('message:text');
  const productId = parseInt(idMsg.message.text);
  if (isNaN(productId)) {
    await ctx.reply('❌ شناسه محصول نامعتبر است. عملیات لغو شد.');
    return;
  }

  const repo = new ProductRepository(ctx.env.DB);
  const product = await repo.getProductById(productId);
  if (!product) {
    await ctx.reply('❌ محصول یافت نشد.');
    return;
  }

  await repo.toggleAvailability(productId, !product.available);
  await ctx.reply(`✅ وضعیت محصول به ${!product.available ? 'موجود' : 'ناموجود'} تغییر یافت.`);
}

async function deleteProductConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('🆔 شناسه محصول برای حذف را وارد کنید:');
  const idMsg = await conversation.waitFor('message:text');
  const productId = parseInt(idMsg.message.text);
  if (isNaN(productId)) {
    await ctx.reply('❌ شناسه محصول نامعتبر است. عملیات لغو شد.');
    return;
  }

  const repo = new ProductRepository(ctx.env.DB);
  await repo.deleteProduct(productId);
  await ctx.reply(`✅ محصول با موفقیت حذف شد.`);
}

async function deleteBranchConversation(conversation: MyConversation, ctx: MyContext) {
  const repo = new BranchRepository(ctx.env.DB);
  const branches = await repo.getAllBranches();
  if (branches.length === 0) {
    await ctx.reply('هیچ شعبه‌ای برای حذف وجود ندارد.');
    return;
  }
  const text = branches.map((b: any) => `🆔 ${b.id} - ${b.name}`).join('\n');
  await ctx.reply(`📍 شعب:\n\n${text}\n\n🆔 شناسه شعبه برای حذف را وارد کنید:`);
  const idMsg = await conversation.waitFor('message:text');
  const id = parseInt(idMsg.message.text);
  if (isNaN(id)) {
    await ctx.reply('❌ شناسه نامعتبر است. عملیات لغو شد.');
    return;
  }
  await repo.deleteBranch(id);
  await ctx.reply('✅ شعبه با موفقیت حذف شد!');
}

export function setupAdminCommands(bot: Bot<MyContext>, env: Env) {
  bot.use(createConversation(addProductConversation));
  bot.use(createConversation(updateStockConversation));
  bot.use(createConversation(toggleProductConversation));
  bot.use(createConversation(deleteProductConversation));
  bot.use(createConversation(addFaqConversation));
  bot.use(createConversation(deleteFaqConversation));
  bot.use(createConversation(addBranchConversation));
  bot.use(createConversation(deleteBranchConversation));

  bot.command('add_product', adminAuth, async (ctx) => {
    await ctx.conversation.enter('addProductConversation');
  });

  bot.command('update_stock', adminAuth, async (ctx) => {
    await ctx.conversation.enter('updateStockConversation');
  });

  bot.command('toggle_product', adminAuth, async (ctx) => {
    await ctx.conversation.enter('toggleProductConversation');
  });

  bot.command('list_products', adminAuth, async (ctx) => {
    const repo = new ProductRepository(ctx.env.DB);
    const products = await repo.getAllProducts();
    if (products.length === 0) {
      await ctx.reply("هیچ محصولی یافت نشد.");
      return;
    }
    const text = products.map((p: any) => `🆔 ${p.id} - ${p.name} (${p.stock} in stock)`).join('\n');
    await ctx.reply(`📦 Products:\n\n${text}`);
  });

  bot.command('delete_product', adminAuth, async (ctx) => {
    await ctx.conversation.enter('deleteProductConversation');
  });

  bot.command('add_faq', adminAuth, async (ctx) => {
    await ctx.conversation.enter('addFaqConversation');
  });

  bot.command('delete_faq', adminAuth, async (ctx) => {
    await ctx.conversation.enter('deleteFaqConversation');
  });

  bot.command('add_branch', adminAuth, async (ctx) => {
    await ctx.conversation.enter('addBranchConversation');
  });

  bot.command('delete_branch', adminAuth, async (ctx) => {
    await ctx.conversation.enter('deleteBranchConversation');
  });

  bot.command('list_branches', adminAuth, async (ctx) => {
    const repo = new BranchRepository(ctx.env.DB);
    const branches = await repo.getAllBranches();
    if (branches.length === 0) {
      await ctx.reply("هیچ شعبه‌ای یافت نشد.");
      return;
    }
    const text = branches.map((b: any) => `🆔 ${b.id} - ${b.name}`).join('\n');
    await ctx.reply(`📍 Branches:\n\n${text}`);
  });

  bot.command('setup_bot', adminAuth, async (ctx) => {
    try {
      await ctx.api.setMyCommands([
        { command: 'start', description: 'Open main menu' },
        { command: 'help', description: 'Show help' }
      ]);
      await ctx.reply("✅ دستورات با موفقیت ثبت شدند.");
    } catch (e: any) {
      await ctx.reply(`❌ خطا در ثبت دستورات: ${e.message}`);
    }
  });
}
