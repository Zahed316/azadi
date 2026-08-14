import { InlineKeyboard } from 'grammy';

export interface PaginationOpts {
  callbackPrefix: string; // e.g. 'cat', 'fav'
  page: number;
  totalPages: number;
}

export function buildPaginationKeyboard(opts: PaginationOpts): InlineKeyboard {
  const { callbackPrefix, page, totalPages } = opts;
  const kb = new InlineKeyboard();
  if (page > 1) {
    kb.text('◀️', `${callbackPrefix}:page:${page - 1}`);
  }
  kb.text(`${page}/${totalPages}`, 'noop');
  if (page < totalPages) {
    kb.text('▶️', `${callbackPrefix}:page:${page + 1}`);
  }
  return kb;
}
