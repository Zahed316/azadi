/**
 * Cache key constants for the Azadi Coffee Bot.
 *
 * All keys follow the pattern `cache:<namespace>:<qualifier>` so that
 * prefix-based invalidation (`deleteByPrefix('cache:products:')`) works
 * predictably.
 *
 * @module services/cache/keys
 */

export const CACHE_KEYS = {
  products: {
    all: 'cache:products:all',
    byCategory: (id: number) => `cache:products:category:${id}`,
    withDetails: 'cache:products:with-details',
    popular: 'cache:products:popular',
  },
  branches: {
    all: 'cache:branches:all',
    active: 'cache:branches:active',
  },
  faq: {
    all: 'cache:faq:all',
  },
  menu: {
    config: 'cache:menu:config',
    bySection: (section: string) => `cache:menu:section:${section}`,
  },
  settings: {
    key: (key: string) => `cache:settings:${key}`,
    all: 'cache:settings:all',
  },
  visibleCategories: 'cache:visible-categories',
} as const;

/** Default TTL for cached values: 5 minutes. */
export const DEFAULT_TTL = 300;

/** Stale-while-revalidate window: 10 minutes. */
export const STALE_WHILE_REVALIDATE = 600;
