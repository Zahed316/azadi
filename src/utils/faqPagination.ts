import { toPersianDigits } from './numbers';

/**
 * Generic pagination slice for any list of items rendered as an inline keyboard
 * (FAQ, products, branches, etc). The page label is a single-line Persian string
 * ("صفحه ۳") so callers can drop it directly into a `<b>سوالات متداول</b> (صفحه N)` style header.
 */
export interface ListPage<T> {
  items: T[];
  hasPrev: boolean;
  hasNext: boolean;
  pageLabel: string;
}

export function buildListPage<T>(items: T[], pageIndex: number, pageSize: number): ListPage<T> {
  const start = pageIndex * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    hasPrev: pageIndex > 0,
    hasNext: start + pageSize < items.length,
    pageLabel: `صفحه ${toPersianDigits(pageIndex + 1)}`,
  };
}
