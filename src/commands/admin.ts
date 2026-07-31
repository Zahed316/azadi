import { Bot } from 'grammy';
import { adminAuth } from '../middlewares/auth';
import { MyContext } from '../types/context';
import { Env } from '../bot';
import { Conversation, createConversation } from '@grammyjs/conversations';
import { ProductRepository, CategoryRepository, BranchRepository, FaqRepository } from '../repositories';

type MyConversation = Conversation<MyContext>;

async function addProductConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('📦 Product name?');
  const nameMsg = await conversation.waitFor('message:text');
  const name = nameMsg.message.text;

  await ctx.reply('💰 Price (in Tomans)?');
  const priceMsg = await conversation.waitFor('message:text');
  const price = parseFloat(priceMsg.message.text);
  if (isNaN(price)) {
    await ctx.reply('❌ Invalid price. Aborting.');
    return;
  }

  const categoryRepo = new CategoryRepository(ctx.env.DB);
  const categories = await categoryRepo.getAllCategories();
  const catText = categories.map((c: any) => `${c.id} for ${c.name}`).join(', ');

  await ctx.reply(`📂 Category ID? (${catText})`);
  const catMsg = await conversation.waitFor('message:text');
  const categoryId = parseInt(catMsg.message.text);
  if (isNaN(categoryId)) {
    await ctx.reply('❌ Invalid category ID. Aborting.');
    return;
  }

  await ctx.reply('📝 Description?');
  const descMsg = await conversation.waitFor('message:text');
  const description = descMsg.message.text;

  await ctx.reply('📦 Initial Stock?');
  const stockMsg = await conversation.waitFor('message:text');
  const stock = parseInt(stockMsg.message.text);
  if (isNaN(stock)) {
    await ctx.reply('❌ Invalid stock quantity. Aborting.');
    return;
  }

  await ctx.reply('💰 Is price on request? (y/n)');
  const porMsg = await conversation.waitFor('message:text');
  const priceOnRequest = porMsg.message.text.toLowerCase() === 'y';

  await ctx.reply('🌿 Is this a seasonal item? (y/n)');
  const seasonalMsg = await conversation.waitFor('message:text');
  const isSeasonal = seasonalMsg.message.text.toLowerCase() === 'y';

  const repo = new ProductRepository(ctx.env.DB);
  await repo.addProduct({ 
    name, price, categoryId, description, stock,
    unit: 'item', available: true, featured: false,
    priceOnRequest, isSeasonal,
    createdAt: new Date(), updatedAt: new Date()
  });
  
  await ctx.reply(`✅ Product "${name}" added successfully!`);
}

async function updateStockConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('🆔 Enter Product ID to update stock:');
  const idMsg = await conversation.waitFor('message:text');
  const productId = parseInt(idMsg.message.text);
  if (isNaN(productId)) {
    await ctx.reply('❌ Invalid Product ID. Aborting.');
    return;
  }

  await ctx.reply('📦 Enter new stock quantity:');
  const stockMsg = await conversation.waitFor('message:text');
  const newStock = parseInt(stockMsg.message.text);
  if (isNaN(newStock)) {
    await ctx.reply('❌ Invalid stock quantity. Aborting.');
    return;
  }

  const repo = new ProductRepository(ctx.env.DB);
  await repo.updateStock(productId, newStock);
  await ctx.reply(`✅ Stock updated for Product ${productId} to ${newStock}.`);
}

async function addFaqConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('❓ Enter the FAQ question:');
  const qMsg = await conversation.waitFor('message:text');
  const question = qMsg.message.text;

  await ctx.reply('💬 Enter the FAQ answer:');
  const aMsg = await conversation.waitFor('message:text');
  const answer = aMsg.message.text;

  const repo = new FaqRepository(ctx.env.DB);
  await repo.add(question, answer);
  await ctx.reply('✅ FAQ added successfully!');
}

async function deleteFaqConversation(conversation: MyConversation, ctx: MyContext) {
  const repo = new FaqRepository(ctx.env.DB);
  const faqs = await repo.getAll();
  if (faqs.length === 0) {
    await ctx.reply('No FAQs to delete.');
    return;
  }
  const text = faqs.map((f: any) => `🆔 ${f.id} - ${f.question}`).join('\n');
  await ctx.reply(`❓ FAQs:\n\n${text}\n\n🆔 Enter FAQ ID to delete:`);
  const idMsg = await conversation.waitFor('message:text');
  const id = parseInt(idMsg.message.text);
  if (isNaN(id)) {
    await ctx.reply('❌ Invalid FAQ ID. Aborting.');
    return;
  }
  await repo.delete(id);
  await ctx.reply('✅ FAQ deleted successfully!');
}

async function addBranchConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('📍 Enter the branch name:');
  const nameMsg = await conversation.waitFor('message:text');
  const name = nameMsg.message.text;

  await ctx.reply('🏢 Enter the address:');
  const addressMsg = await conversation.waitFor('message:text');
  const address = addressMsg.message.text;

  await ctx.reply('📞 Enter the phone number (or skip by typing -):');
  const phoneMsg = await conversation.waitFor('message:text');
  const phone = phoneMsg.message.text !== '-' ? phoneMsg.message.text : null;

  await ctx.reply('⏰ Enter the opening hours (or skip by typing -):');
  const hoursMsg = await conversation.waitFor('message:text');
  const openingHours = hoursMsg.message.text !== '-' ? hoursMsg.message.text : null;

  const repo = new BranchRepository(ctx.env.DB);
  await repo.addBranch({ name, address, phone, openingHours, isActive: true });
  await ctx.reply(`✅ Branch "${name}" added successfully!`);
}

async function toggleProductConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('🆔 Enter Product ID to toggle availability:');
  const idMsg = await conversation.waitFor('message:text');
  const productId = parseInt(idMsg.message.text);
  if (isNaN(productId)) {
    await ctx.reply('❌ Invalid Product ID. Aborting.');
    return;
  }

  const repo = new ProductRepository(ctx.env.DB);
  const product = await repo.getProductById(productId);
  if (!product) {
    await ctx.reply('❌ Product not found.');
    return;
  }

  await repo.toggleAvailability(productId, !product.available);
  await ctx.reply(`✅ Product availability changed to ${!product.available ? 'AVAILABLE' : 'UNAVAILABLE'}.`);
}

async function deleteProductConversation(conversation: MyConversation, ctx: MyContext) {
  await ctx.reply('🆔 Enter Product ID to delete:');
  const idMsg = await conversation.waitFor('message:text');
  const productId = parseInt(idMsg.message.text);
  if (isNaN(productId)) {
    await ctx.reply('❌ Invalid Product ID. Aborting.');
    return;
  }

  const repo = new ProductRepository(ctx.env.DB);
  await repo.deleteProduct(productId);
  await ctx.reply(`✅ Product deleted.`);
}

export function setupAdminCommands(bot: Bot<MyContext>, env: Env) {
  bot.use(createConversation(addProductConversation));
  bot.use(createConversation(updateStockConversation));
  bot.use(createConversation(toggleProductConversation));
  bot.use(createConversation(deleteProductConversation));
  bot.use(createConversation(addFaqConversation));
  bot.use(createConversation(deleteFaqConversation));
  bot.use(createConversation(addBranchConversation));

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
      await ctx.reply("No products found.");
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

  bot.command('list_branches', adminAuth, async (ctx) => {
    const repo = new BranchRepository(ctx.env.DB);
    const branches = await repo.getAllBranches();
    if (branches.length === 0) {
      await ctx.reply("No branches found.");
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
      await ctx.reply("✅ Commands registered successfully.");
    } catch (e: any) {
      await ctx.reply(`❌ Error setting commands: ${e.message}`);
    }
  });
}
