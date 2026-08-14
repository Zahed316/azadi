import { Bot, InlineKeyboard } from 'grammy';
import {
  formatBranch,
  formatProduct,
  formatFaq,
  DEFAULT_PRICE_UNIT,
  DEFAULT_VAT_NOTE,
} from '../utils/formatters';
import { products as productsTable, coffeeDetails, faq as faqTable } from '../database/schema';
import { buildListPage } from '../utils/faqPagination';
import { escapeHtml } from '../utils/htmlEscape';
import { buildCategoryPage } from '../menus/drinksNavMenu';
import { mainMenu, getWelcomeText } from '../menus/mainMenu';
import { MyContext } from '../types/context';
import {
  pushMessage,
  popMessage,
  getActiveMessage,
  handleEditFailure,
} from '../utils/menuLifecycle';
import { editOrSend } from '../utils/editOrSend';

const backKeyboard = () => new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');

export function setupCallbackHandlers(bot: Bot<MyContext>): void {
  bot.callbackQuery('back:main', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const body = await getWelcomeText(ctx.dataService);

      // Always pop and delete the current message from Telegram
      const active = getActiveMessage(ctx.session);
      if (active) {
        popMessage(ctx.session);
        await ctx.api.deleteMessage(active.chatId, active.messageId).catch(() => {});
      }

      // Send fresh main menu
      const sent = await ctx.reply(body, { parse_mode: 'HTML', reply_markup: mainMenu });
      const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'main');
      if (evicted) {
        await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  });

  bot.callbackQuery(/^faq:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const faqs = await ctx.dataService.getAllFaqs();
      const page = buildListPage(faqs, idx, 5);
      const text = page.items.map((f: typeof faqTable.$inferSelect) => formatFaq(f)).join('\n\n');
      const kb = new InlineKeyboard();
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `faq:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `faq:page:${idx + 1}`);
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body = `<b>سوالات متداول</b> (${page.pageLabel})\n\n${text}`;
      const newState = `faq:${idx}`;
      const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
      await editOrSend(ctx, body, msgOpts, newState);
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
        ctx.dataService.getSetting('about'),
        ctx.dataService.getActiveBranches(),
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
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body = aboutText
        ? `<b>🏠 درباره ما</b>\n\n${escapeHtml(aboutText)}`
        : '<b>🏠 درباره ما</b>';
      const newState = `branches:${idx}`;
      const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
      await editOrSend(ctx, body, msgOpts, newState);
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^beans:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const configs = await ctx.dataService.getBySection('beans');
      const products =
        configs.length > 0
          ? await ctx.dataService.getProductsByCategory(configs[0].categoryId)
          : [];
      const page = buildListPage(products, idx, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `beans:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `beans:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body =
        page.items.length === 0
          ? `<b>دانه‌های قهوه</b> (${page.pageLabel})`
          : `<b>دانه‌های قهوه</b> (${page.pageLabel})\n\nدانه قهوه مورد نظر را انتخاب کنید:`;
      const newState = `beans:${idx}`;
      const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
      await editOrSend(ctx, body, msgOpts, newState);
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^cakes:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const configs = await ctx.dataService.getBySection('cakes');
      const products =
        configs.length > 0
          ? await ctx.dataService.getProductsByCategory(configs[0].categoryId)
          : [];
      const page = buildListPage(products, idx, 5);
      const kb = new InlineKeyboard();
      for (let i = 0; i < page.items.length; i++) {
        kb.text(page.items[i].name, `product:${page.items[i].id}`);
        if (i % 2 === 1 || i === page.items.length - 1) kb.row();
      }
      if (page.hasPrev) kb.text('صفحه قبل ▶️', `cakes:page:${idx - 1}`);
      if (page.hasNext) kb.text('◀️ صفحه بعد', `cakes:page:${idx + 1}`);
      if (page.hasPrev || page.hasNext) kb.row();
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body =
        page.items.length === 0
          ? `<b>کیک و کوکی</b> (${page.pageLabel})`
          : `<b>کیک و کوکی</b> (${page.pageLabel})\n\nیک کیک یا کوکی انتخاب کنید:`;
      const newState = `cakes:${idx}`;
      const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
      await editOrSend(ctx, body, msgOpts, newState);
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
      const [configs, items, priceUnitRaw] = await Promise.all([
        ctx.dataService.getBySection('drinks'),
        ctx.dataService.getProductsByCategory(catId),
        ctx.dataService.getSetting('price_unit'),
      ]);
      const config = configs.find((c) => c.categoryId === catId);
      if (!config) {
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(
              active.chatId,
              active.messageId,
              'دسته‌بندی مورد نظر یافت نشد.',
              {
                parse_mode: 'HTML',
                reply_markup: backKeyboard(),
              },
            );
            active.state = 'error';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              'دسته‌بندی مورد نظر یافت نشد.',
              { parse_mode: 'HTML', reply_markup: backKeyboard() },
              e,
            );
            return;
          }
        }
        await ctx.reply('دسته‌بندی مورد نظر یافت نشد.');
        return;
      }
      if (items.length === 0) {
        const backKb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        const emptyText = config.specialMessage
          ? config.specialMessage
          : `📭 در حال حاضر ${config.categoryName} موجود نیست.`;
        const active = getActiveMessage(ctx.session);
        if (active) {
          try {
            await ctx.api.editMessageText(active.chatId, active.messageId, emptyText, {
              parse_mode: 'HTML',
              reply_markup: backKb,
            });
            active.state = 'empty:drinks';
            return;
          } catch (e) {
            await handleEditFailure(
              ctx,
              emptyText,
              { parse_mode: 'HTML', reply_markup: backKb },
              e,
            );
            return;
          }
        }
        await ctx.reply(emptyText, { parse_mode: 'HTML', reply_markup: backKb });
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
      const branch = await ctx.dataService.getBranchById(id);
      if (branch) {
        const body = formatBranch(branch);
        const kb = backKeyboard();
        await editOrSend(ctx, body, { parse_mode: 'HTML', reply_markup: kb }, `branch:${id}`);
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
      const product = await ctx.dataService.getProductById(id);
      if (product) {
        const priceUnitRaw = await ctx.dataService.getSetting('price_unit');
        const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
        const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
        const vatNote = vatNoteRaw ? escapeHtml(vatNoteRaw) : DEFAULT_VAT_NOTE;
        const kb = backKeyboard();
        // Phase 5.2: favorite toggle
        if (ctx.from?.id) {
          const isFav = await ctx.dataService.isFavorited(String(ctx.from.id), id);
          if (isFav) {
            kb.row().text('💔 حذف از علاقمندی‌ها', `fav:remove:${id}`);
          } else {
            kb.row().text('⭐ ذخیره', `fav:add:${id}`);
          }
        }
        let caption = formatProduct(product, priceUnit, vatNote);
        // Show brew guide for coffee beans with details
        const details = await ctx.dataService.getCoffeeDetails(id);
        if (details?.brewGuide) {
          caption += `\n\n📋 <b>راهنمای دم‌آوری:</b>\n${details.brewGuide}`;
        }
        if (product.imageUrl) {
          // Photo — can't edit text → photo, so pop + delete the active message
          // first, then create the photo message and track it.
          const active = getActiveMessage(ctx.session);
          if (active) {
            popMessage(ctx.session);
            await ctx.api.deleteMessage(active.chatId, active.messageId).catch(() => {});
          }
          const sent = await ctx.replyWithPhoto(product.imageUrl, {
            caption,
            parse_mode: 'HTML',
            reply_markup: kb,
          });
          if (sent && 'message_id' in sent) {
            const evicted = pushMessage(
              ctx.session,
              ctx.chat!.id,
              (sent as { message_id: number }).message_id,
              `product:${id}`,
            );
            if (evicted) {
              await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
            }
          }
        } else {
          // Text-only — try to edit active message first
          await editOrSend(ctx, caption, { parse_mode: 'HTML', reply_markup: kb }, `product:${id}`);
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
      const items = await ctx.dataService.getByFlag('featured');
      const priceUnitRaw = await ctx.dataService.getSetting('price_unit');
      const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
      const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
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
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body =
        page.items.length === 0
          ? `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})`
          : `<b>⭐ پیشنهاد ویژه</b> (${page.pageLabel})\n\n${page.items.map((p: typeof productsTable.$inferSelect) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;
      const newState = `featured:${idx}`;
      const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
      await editOrSend(ctx, body, msgOpts, newState);
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^seasonal:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const items = await ctx.dataService.getByFlag('isSeasonal');
      const priceUnitRaw = await ctx.dataService.getSetting('price_unit');
      const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
      const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
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
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const body =
        page.items.length === 0
          ? `<b>🌿 مخصوص فصل</b> (${page.pageLabel})`
          : `<b>🌿 مخصوص فصل</b> (${page.pageLabel})\n\n${page.items.map((p: typeof productsTable.$inferSelect) => formatProduct(p, priceUnit, vatNote)).join('\n\n')}`;
      const newState = `seasonal:${idx}`;
      const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
      await editOrSend(ctx, body, msgOpts, newState);
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
  });

  bot.callbackQuery(/^passport:page:(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
      const idx = parseInt(ctx.match[1]);
      const rows = await ctx.dataService.getBeansWithCoffeeDetails();
      const priceUnitRaw = await ctx.dataService.getSetting('price_unit');
      const priceUnit = priceUnitRaw ? escapeHtml(priceUnitRaw) : DEFAULT_PRICE_UNIT;
      const vatNoteRaw = await ctx.dataService.getSetting('vat_note');
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
      kb.row();
      kb.text('🔙 بازگشت به منو', 'back:main');
      const origins = Array.from(
        new Set(
          page.items
            .map(
              (r: {
                product: typeof productsTable.$inferSelect;
                details: typeof coffeeDetails.$inferSelect;
              }) => r.details?.origin,
            )
            .filter(Boolean),
        ),
      );
      const originsLine =
        origins.length > 0
          ? `\n\n🗺 <b>${origins.length} کشور مبدا در این صفحه:</b> ${origins.join(' · ')}`
          : '';
      const body =
        page.items.length === 0
          ? `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})`
          : `<b>📖 پاسپورت قهوه</b> (${page.pageLabel})${originsLine}\n\n${page.items.map((r: { product: typeof productsTable.$inferSelect; details: typeof coffeeDetails.$inferSelect }) => formatProduct(r.product, priceUnit, vatNote)).join('\n\n')}`;
      const newState = `passport:${idx}`;
      const msgOpts = { parse_mode: 'HTML' as const, reply_markup: kb };
      await editOrSend(ctx, body, msgOpts, newState);
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
      const uid = String(ctx.from.id);
      const alreadyFav = await ctx.dataService.isFavorited(uid, productId);
      if (alreadyFav) {
        const body = 'ℹ️ این محصول از قبل در علاقمندی‌های شما بود.';
        const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        await editOrSend(ctx, body, { reply_markup: kb }, 'fav');
        return;
      }
      await ctx.dataService.toggleFavorite(uid, productId);
      const body = '✅ به علاقمندی‌ها اضافه شد.';
      const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      await editOrSend(ctx, body, { reply_markup: kb }, 'fav');
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
      const uid = String(ctx.from.id);
      const isFav = await ctx.dataService.isFavorited(uid, productId);
      if (!isFav) {
        const body = 'ℹ️ این محصول در علاقمندی‌های شما نبود.';
        const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
        await editOrSend(ctx, body, { reply_markup: kb }, 'fav');
        return;
      }
      await ctx.dataService.toggleFavorite(uid, productId);
      const body = '❌ از علاقمندی‌ها حذف شد.';
      const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      await editOrSend(ctx, body, { reply_markup: kb }, 'fav');
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

      const message = await ctx.dataService.createMessage({
        telegramId: String(ctx.from.id),
        senderName: flow.isAnonymous ? undefined : (flow.name ?? undefined),
        content: flow.content,
        rating: flow.rating ?? undefined,
        isAnonymous: flow.isAnonymous ?? false,
      });

      ctx.session.messageFlow = undefined;

      const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const body = '✅ پیام شما با موفقیت ارسال شد!\nادمین به زودی پاسخ خواهد داد.';
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, body, {
            reply_markup: kb,
          });
          active.state = 'sent';
          // fall through to admin notifications
        } catch (e) {
          await handleEditFailure(ctx, body, { reply_markup: kb }, e, 'sent');
          // fall through to admin notifications
        }
      } else {
        const sent = await ctx.reply(body, { reply_markup: kb });
        const evicted = pushMessage(ctx.session, ctx.chat!.id, sent.message_id, 'sent');
        if (evicted) {
          await ctx.api.deleteMessage(evicted.chatId, evicted.messageId).catch(() => {});
        }
      }

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
    try {
      ctx.session.messageFlow = undefined;
      const kb = new InlineKeyboard().text('🔙 بازگشت به منو', 'back:main');
      const body = '❌ ارسال پیام لغو شد.';
      await editOrSend(ctx, body, { reply_markup: kb }, 'cancelled');
      await ctx.answerCallbackQuery();
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: '❌ خطایی رخ داد' }).catch(() => {});
    }
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
      const body = 'پیام خود را بنویسید:';
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, body, {
            reply_markup: kb,
          });
          await ctx.answerCallbackQuery();
          return;
        } catch (e) {
          await handleEditFailure(ctx, body, { reply_markup: kb }, e);
          await ctx.answerCallbackQuery();
          return;
        }
      }
      await ctx.reply(body, { reply_markup: kb });
      await ctx.answerCallbackQuery();
      return;
    }

    // Otherwise (rating step), skip means "no rating"
    flow.rating = undefined;
    flow.step = 'confirm';
    const nameLine = flow.isAnonymous ? 'ناشناس' : flow.name;
    const preview = `<b>پیش‌نمایش پیام:</b>\n\n👤 ${nameLine}\n⭐ بدون امتیاز\n\n📝 ${flow.content}`;
    const kb = new InlineKeyboard().text('✅ ارسال', 'msg:confirm').text('❌ انصراف', 'msg:cancel');
    const active = getActiveMessage(ctx.session);
    if (active) {
      try {
        await ctx.api.editMessageText(active.chatId, active.messageId, preview, {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        await ctx.answerCallbackQuery();
        return;
      } catch (e) {
        await handleEditFailure(ctx, preview, { parse_mode: 'HTML', reply_markup: kb }, e);
        await ctx.answerCallbackQuery();
        return;
      }
    }
    await ctx.reply(preview, { parse_mode: 'HTML', reply_markup: kb });
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
      const active = getActiveMessage(ctx.session);
      if (active) {
        try {
          await ctx.api.editMessageText(active.chatId, active.messageId, preview, {
            parse_mode: 'HTML',
            reply_markup: kb,
          });
          await ctx.answerCallbackQuery();
          return;
        } catch (e) {
          await handleEditFailure(ctx, preview, { parse_mode: 'HTML', reply_markup: kb }, e);
          await ctx.answerCallbackQuery();
          return;
        }
      }
      await ctx.reply(preview, { parse_mode: 'HTML', reply_markup: kb });
    }
    await ctx.answerCallbackQuery();
  });
}
