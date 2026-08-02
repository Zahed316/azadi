import { toPersianDigits } from './numbers';

export interface FaqPage {
  items: any[];
  hasPrev: boolean;
  hasNext: boolean;
  pageLabel: string;
}

export function buildFaqPage(faqs: any[], pageIndex: number, pageSize: number): FaqPage {
  const start = pageIndex * pageSize;
  const items = faqs.slice(start, start + pageSize);
  return {
    items,
    hasPrev: pageIndex > 0,
    hasNext: start + pageSize < faqs.length,
    pageLabel: `صفحه ${toPersianDigits(pageIndex + 1)}`,
  };
}
