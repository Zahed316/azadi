import { Bot, InlineKeyboard } from 'grammy';
import {
  BranchRepository,
  ProductRepository,
  SettingsRepository,
  FaqRepository,
  MenuConfigRepository,
  FavoritesRepository,
  MessageRepository,
} from '../repositories';
import { formatBranch, formatProduct, formatFaq, DEFAULT_PRICE_UNIT, DEFAULT_VAT_NOTE } from '../utils/formatters';
import { buildListPage } from '../utils/faqPagination';
import { escapeHtml } from '../utils/htmlEscape';
import { buildCategoryPage } from '../menus/drinksNavMenu';
import { mainMenu, getWelcomeText } from '../menus/mainMenu';
import { MyContext } from '../types/context';

const backKeyboard = () => new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');

export function setupCallbackHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery('back:main', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const body = await getWelcomeText(ctx.env);
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: mainMenu })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu }));
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
      const [aboutText, branches] = await Promise.all([
        new SettingsRepository(ctx.env.DB).getValue('about'),
        new BranchRepository(ctx.env.DB).getActiveBranches(),
      ]);
      const page = buildListPage(branches, idx, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(`📍 ${page.items[i].name}`, `branch:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `branches:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `branches:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      const body = aboutText ? `<b>🏠 درباره ما</b>\n\n${escapeHtml(aboutText)}` : '<b>🏠 درباره ما</b>';
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
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
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `beans:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `beans:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      const body =
        page.items.length === 0
          ? `<b>دانه‌های قهوه</b> (${page.pageLabel})`
          : `<b>دانه‌های قهوه</b> (${page.pageLabel})\n\nدانه قهوه مورد نظر را انتخاب کنید:`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
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
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `cakes:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `cakes:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      const body =
        page.items.length === 0
          ? `<b>کیک و کوکی</b> (${page.pageLabel})`
          : `<b>کیک و کوکی</b> (${page.pageLabel})\n\nیک کیک یا کوکی انتخاب کنید:`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
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
      const [configs, items, priceUnitRaw] = await Promise.all([
        menuRepo.getBySection('drinks'),
        new ProductRepository(ctx.env.DB).getProductsByCategory(catId),
        new SettingsRepository(ctx.env.DB).getValue('price_unit'),
      ]);
      const config = configs.find((c: any) => c.categoryId === catId);
      if (!config) {
        await ctx.reply('دسته‌بندی مورد نظر یافت نشد.');
        return;
      }
      if (items.length === 0) {
        if (config.specialMessage) {
          await ctx.reply(config.specialMessage, { parse_mode: 'HTML' });
        } else {
          await ctx.reply(`📭 در حال حاضر ${config.categoryName} موجود نیست.`);
        }
        return;
      }
      const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
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
        const priceUnitRaw =
          await new SettingsRepository(ctx.env.DB).getValue('price_unit');
        const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
        const vatNoteRaw =
          await new SettingsRepository(ctx.env.DB).getValue('vat_note');
        const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
        const kb = backKeyboard();
        // Phase 5.2: favorite toggle
        if (ctx.from?.id) {
          const isFav = await new FavoritesRepository(ctx.env.DB).isFavorited(
            String(ctx.from.id),
            id,
          );
          if (isFav) {
            kb.row().text('💔 حذف از علاقمندی‌ها', `fav:remove:${id}`);
          } else {
            kb.row().text('⭐ ذخیره', `fav:add:${id}`);
          }
        }
        let caption = formatProduct(product, priceUnit, vatNote);
        // Show brew guide for coffee beans with details
        const details = await repo.getCoffeeDetails(id);
        if (details?.brewGuide) {
          caption += `\n\n📋 <b>راهنمای دم‌آوری:</b>\n${details.brewGuide}`;
        }
        if (product.imageUrl) {
          await ctx.replyWithPhoto(product.imageUrl, {
            caption,
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        } else {
          await ctx.reply(caption, {
            parse_mode: 'HTML',
            reply_markup: kb,
          });
        }
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
      const priceUnitRaw =
        await new SettingsRepository(ctx.env.DB).getValue('price_unit');
      const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
      const vatNoteRaw =
        await new SettingsRepository(ctx.env.DB).getValue('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(items, idx, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `featured:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `featured:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      const body =
        page.items.length === 0
          ? `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})`
          : `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;
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
      const priceUnitRaw =
        await new SettingsRepository(ctx.env.DB).getValue('price_unit');
      const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
      const vatNoteRaw =
        await new SettingsRepository(ctx.env.DB).getValue('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(items, idx, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `seasonal:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `seasonal:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      const body =
        page.items.length === 0
          ? `<b>🌿 مخصوص فصل</b> (${page.pageLabel})`
          : `<b>🌿 مخصوص فصل</b> (${page.pageLabel})\n\n${page.items.map((p: any) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;
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
      const priceUnitRaw =
        await new SettingsRepository(ctx.env.DB).getValue('price_unit');
      const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
      const vatNoteRaw =
        await new SettingsRepository(ctx.env.DB).getValue('vat_note');
      const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
      const page = buildListPage(rows, idx, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        const p = page.items[i].product;
        const origin = page.items[i].details?.origin ? ` — ${page.items[i].details.origin}` : '';
        kb.text(`${p.name}${origin}`, `product:${p.id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `passport:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `passport:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
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
          : `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})${originsLine}\n\n${page.items.map((r: any) => formatProduct(r.product, priceUnit, vatNote)).join('\n\n')}`;
      await ctx
        .editMessageText(body, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(body, { parse_mode: 'HTML', reply_markup: kb }));
    } catch (e) {
      console.error(e);
      // Telegram timeout — safe to ignore
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  // --- Phase 5.2: favorites ---

  bot.callbackQuery(/^fav:add:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      if (!ctx.from?.id) return;
      const productId = Number(ctx.match[1]);
      const repo = new FavoritesRepository(ctx.env.DB);
      const added = await repo.add(String(ctx.from.id), productId);
      const msg = added
        ? '✅ به علاقمندی‌ها اضافه شد.'
        : 'ℹ️ این محصول از قبل در علاقمندی‌های شما بود.';
      await ctx.reply(msg, {
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^fav:remove:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      if (!ctx.from?.id) return;
      const productId = Number(ctx.match[1]);
      const repo = new FavoritesRepository(ctx.env.DB);
      const removed = await repo.remove(String(ctx.from.id), productId);
      const msg = removed ? '❌ از علاقمندی‌ها حذف شد.' : 'ℹ️ این محصول در علاقمندی‌های شما نبود.';
      await ctx.reply(msg, {
        reply_markup: new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main'),
      });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  // --- Message flow: confirm send ---
  bot.callbackQuery('msg:confirm', async (ctx) => {
    try {
      const flow = ctx.session?.messageFlow;
      if (!flow?.content) {
        await ctx.answerCallbackQuery({ text: 'خطا: پیام یافت نشد.' });
        return;
      }

      const repo = new MessageRepository(ctx.env.DB);
      const message = await repo.create({
        telegramId: String(ctx.from.id),
        senderName: flow.isAnonymous ? null : (flow.name ?? null),
        senderEmail: null,
        content: flow.content,
        rating: flow.rating ?? null,
        isAnonymous: flow.isAnonymous ?? false,
      });

      ctx.session.messageFlow = undefined;

      const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      await ctx
        .editMessageText('✅ پیام شما با موفقیت ارسال شد!\nادمین به زودی پاسخ خواهد داد.', {
          reply_markup: kb,
        })
        .catch(() =>
          ctx.reply('✅ پیام شما با موفقیت ارسال شد!\nادمین به زودی پاسخ خواهد داد.', {
            reply_markup: kb,
          }),
        );

      // Notify admins (best-effort, parallel)
      if (ctx.env.TELEGRAM_BOT_TOKEN) {
        try {
          const { getDb } = await import('../database/client');
          const { admins } = await import('../database/schema');
          const db = getDb(ctx.env.DB);
          const allAdmins = await db.select().from(admins);
          const preview = flow.content.slice(0, 150) + (flow.content.length > 150 ? '...' : '');
          const senderName = flow.isAnonymous ? 'ناشناس' : flow.name || 'ناشناس';
          const msgId = message[0]?.id;
          await Promise.allSettled(
            allAdmins.map((admin) =>
              fetch(`https://api.telegram.org/bot${ctx.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: admin.telegramId,
                  text: `📬 پیام جدید (#${msgId}) از ${senderName}:\n\n${preview}`,
                }),
              }),
            ),
          );
        } catch (e) {
          console.error(
            JSON.stringify({
              ts: new Date().toISOString(),
              operation: 'admin-notification-failed',
              error: e instanceof Error ? 'fetch failed' : 'unknown error',
            }),
          );
        }
      }

      await ctx.answerCallbackQuery({ text: '✅ ارسال شد' });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطا در ارسال پیام' });
    }
  });

  // Message flow: cancel
  bot.callbackQuery('msg:cancel', async (ctx) => {
    ctx.session.messageFlow = undefined;
    const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
    await ctx
      .editMessageText('❌ ارسال پیام لغو شد.', { reply_markup: kb })
      .catch(() => ctx.reply('❌ ارسال پیام لغو شد.', { reply_markup: kb }));
    await ctx.answerCallbackQuery();
  });

  // Rating skip callback — MUST be registered before the regex handler below,
  // otherwise /^rate:(.+)$/ matches "rate:skip" first and silently no-ops.
  bot.callbackQuery('rate:skip', async (ctx) => {
    if (!ctx.session?.messageFlow) return;
    const flow = ctx.session.messageFlow;

    // If we're on the name step, skip means "send anonymously"
    if (flow.step === 'name') {
      flow.isAnonymous = true;
      flow.step = 'content';
      const kb = new InlineKeyboard().text('❌ انصراف', 'msg:cancel');
      await ctx
        .editMessageText('پیام خود را بنویسید:', { reply_markup: kb })
        .catch(() => ctx.reply('پیام خود را بنویسید:', { reply_markup: kb }));
      await ctx.answerCallbackQuery();
      return;
    }

    // Otherwise (rating step), skip means "no rating"
    flow.rating = undefined;
    flow.step = 'confirm';
    const nameLine = flow.isAnonymous ? 'ناشناس' : flow.name;
    const preview = `<b>پیش‌نمایش پیام:</b>\n\n👤 ${nameLine}\n⭐ بدون امتیاز\n\n📝 ${flow.content}`;
    const kb = new InlineKeyboard().text('✅ ارسال', 'msg:confirm').text('❌ انصراف', 'msg:cancel');
    await ctx
      .editMessageText(preview, { parse_mode: 'HTML', reply_markup: kb })
      .catch(() => ctx.reply(preview, { parse_mode: 'HTML', reply_markup: kb }));
    await ctx.answerCallbackQuery();
  });

  // Rating callback (from inline keyboard buttons) — must come after rate:skip
  bot.callbackQuery(/^rate:(.+)$/, async (ctx) => {
    const match = ctx.match;
    const value = match[1];
    if (!ctx.session?.messageFlow) return;

    const num = parseInt(value);
    if (num >= 1 && num <= 5) {
      ctx.session.messageFlow.rating = num;
      ctx.session.messageFlow.step = 'confirm';
      const flow = ctx.session.messageFlow;
      const stars = '⭐'.repeat(num);
      const nameLine = flow.isAnonymous ? 'ناشناس' : flow.name;
      const preview = `<b>پیش‌نمایش پیام:</b>\n\n👤 ${nameLine}\n⭐ ${stars}\n\n📝 ${flow.content}`;
      const kb = new InlineKeyboard()
        .text('✅ ارسال', 'msg:confirm')
        .text('❌ انصراف', 'msg:cancel');
      await ctx
        .editMessageText(preview, { parse_mode: 'HTML', reply_markup: kb })
        .catch(() => ctx.reply(preview, { parse_mode: 'HTML', reply_markup: kb }));
    }
    await ctx.answerCallbackQuery();
  });
}
