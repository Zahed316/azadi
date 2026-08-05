import { Bot, InlineKeyboard } from 'grammy';
import {
  BranchRepository,
  ProductRepository,
  SettingsRepository,
  FaqRepository,
  MenuConfigRepository,
} from '../repositories';
import { formatBranch, formatProduct, formatFaq, DEFAULT_PRICE_UNIT } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { buildCategoryPage } from '../menus/drinksNavMenu';
import { mainMenu } from '../menus/mainMenu';
import { MyContext } from '../types/context';

const backKeyboard = () => new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');

export function setupCallbackHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery('back:main', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      await ctx.reply('منوی اصلی:', { reply_markup: mainMenu });
    } catch (e) {
      console.error(e);
    }
  });

  bot.callbackQuery(/^faq:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const faqs = await new FaqRepository(ctx.env.DB).getAll();
      const page = buildListPage(faqs, idx, 5);
      const text = page.items.map((f: any) => formatFaq(f)).join('\n\n');
      const kb = new InlineKeyboard();
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `faq:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `faq:page:${idx + 1}`);
      const body = `<b>سوالات متداول</b> (${page.pageLabel})\n\n${text}`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  // --- Paginated lists (5 per page) ---

  bot.callbackQuery(/^branches:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const branches = await new BranchRepository(ctx.env.DB).getAllBranches();
      const page = buildListPage(branches, idx, 5);
      const kb = new InlineKeyboard();
      for (const b of page.items) {
        kb.text(b.name, `branch:${b.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `branches:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `branches:page:${idx + 1}`);
      const body =
        page.items.length === 0
          ? `<b>شعب</b> (${page.pageLabel})`
          : `<b>شعب</b> (${page.pageLabel})\n\nیک شعبه انتخاب کنید:`;
      await ctx
        .editMessageText(body, { reply_markup: kb })
        .catch(() => ctx.reply(body, { reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^beans:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const repo = new ProductRepository(ctx.env.DB);
      const menuRepo = new MenuConfigRepository(ctx.env.DB);
      const configs = await menuRepo.getBySection('beans');
      const products =
        configs.length > 0 ? await repo.getProductsByCategory(configs[0].categoryId) : [];
      const page = buildListPage(products, idx, 5);
      const kb = new InlineKeyboard();
      for (const p of page.items) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `beans:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `beans:page:${idx + 1}`);
      const body =
        page.items.length === 0
          ? `<b>دانه‌های قهوه</b> (${page.pageLabel})`
          : `<b>دانه‌های قهوه</b> (${page.pageLabel})\n\nدانه قهوه مورد نظر را انتخاب کنید:`;
      await ctx
        .editMessageText(body, { reply_markup: kb })
        .catch(() => ctx.reply(body, { reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^cakes:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const repo = new ProductRepository(ctx.env.DB);
      const menuRepo = new MenuConfigRepository(ctx.env.DB);
      const configs = await menuRepo.getBySection('cakes');
      const products =
        configs.length > 0 ? await repo.getProductsByCategory(configs[0].categoryId) : [];
      const page = buildListPage(products, idx, 5);
      const kb = new InlineKeyboard();
      for (const p of page.items) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `cakes:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `cakes:page:${idx + 1}`);
      const body =
        page.items.length === 0
          ? `<b>کیک و کوکی</b> (${page.pageLabel})`
          : `<b>کیک و کوکی</b> (${page.pageLabel})\n\nیک کیک یا کوکی انتخاب کنید:`;
      await ctx
        .editMessageText(body, { reply_markup: kb })
        .catch(() => ctx.reply(body, { reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^drinks:cat:(\d+):page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const catId = parseInt(ctx.match[1]);
      const idx = parseInt(ctx.match[2]);
      const menuRepo = new MenuConfigRepository(ctx.env.DB);
      const configs = await menuRepo.getBySection('drinks');
      const config = configs.find((c: any) => c.categoryId === catId);
      if (!config) {
        await ctx.reply('دسته‌بندی مورد نظر یافت نشد.');
        return;
      }
      const items = await new ProductRepository(ctx.env.DB).getProductsByCategory(catId);
      if (items.length === 0) {
        if (config.specialMessage) {
          await ctx.reply(config.specialMessage, { parse_mode: 'HTML' });
        } else {
          await ctx.reply(`📭 در حال حاضر ${config.categoryName} موجود نیست.`);
        }
        return;
      }
      const priceUnit =
        (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
      await buildCategoryPage(ctx, config, items, idx, priceUnit);
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  // --- Single-resource callbacks ---

  bot.callbackQuery(/^branch:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: '⏳ در حال بارگذاری...' });
      const id = parseInt(ctx.match[1]);
      const repo = new BranchRepository(ctx.env.DB);
      const branch = await repo.getBranchById(id);
      if (branch) {
        await ctx.reply(formatBranch(branch), { parse_mode: 'HTML', reply_markup: backKeyboard() });
      } else {
        await ctx.reply('شعبه مورد نظر یافت نشد.');
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
      await ctx.reply('❌ خطایی در دریافت اطلاعات شعبه رخ داد.');
    }
  });

  bot.callbackQuery(/^product:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery({ text: '⏳ در حال بارگذاری...' });
      const id = parseInt(ctx.match[1]);
      const repo = new ProductRepository(ctx.env.DB);
      const product = await repo.getProductById(id);
      if (product) {
        const priceUnit =
          (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
        await ctx.reply(formatProduct(product, priceUnit), {
          parse_mode: 'HTML',
          reply_markup: backKeyboard(),
        });
      } else {
        await ctx.reply('محصول مورد نظر یافت نشد.');
      }
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
      await ctx.reply('❌ خطایی در دریافت اطلاعات محصول رخ داد.');
    }
  });

  // --- Phase 3 surfaces: paginated lists (5 per page) ---

  bot.callbackQuery(/^featured:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const items = await new ProductRepository(ctx.env.DB).getByFlag('featured');
      const priceUnit =
        (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
      const page = buildListPage(items, idx, 5);
      const kb = new InlineKeyboard();
      for (const p of page.items) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `featured:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `featured:page:${idx + 1}`);
      const body =
        page.items.length === 0
          ? `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})`
          : `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit)).join('\n\n')}`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^seasonal:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const items = await new ProductRepository(ctx.env.DB).getByFlag('isSeasonal');
      const priceUnit =
        (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
      const page = buildListPage(items, idx, 5);
      const kb = new InlineKeyboard();
      for (const p of page.items) {
        kb.text(p.name, `product:${p.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `seasonal:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `seasonal:page:${idx + 1}`);
      const body =
        page.items.length === 0
          ? `<b>🌿 مخصوص فصل</b> (${page.pageLabel})`
          : `<b>🌿 مخصوص فصل</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit)).join('\n\n')}`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^passport:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const rows = await new ProductRepository(ctx.env.DB).getBeansWithCoffeeDetails();
      const priceUnit =
        (await new SettingsRepository(ctx.env.DB).getValue('price_unit')) || DEFAULT_PRICE_UNIT;
      const page = buildListPage(rows, idx, 5);
      const kb = new InlineKeyboard();
      for (const r of page.items) {
        const p = r.product;
        const origin = r.details?.origin ? ` — ${r.details.origin}` : '';
        kb.text(`${p.name}${origin}`, `product:${p.id}`).row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `passport:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `passport:page:${idx + 1}`);
      const origins = Array.from(
        new Set(page.items.map((r: any) => r.details?.origin).filter(Boolean)),
      );
      const originsLine =
        origins.length > 0
          ? `\n\n🗺 <b>${origins.length} کشور مبدا در این صفحه:</b> ${origins.join(' · ')}`
          : '';
      const body =
        page.items.length === 0
          ? `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})`
          : `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})${originsLine}\n\n${page.items.map((r: any) => formatProduct(r.product, priceUnit)).join('\n\n')}`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });
}
