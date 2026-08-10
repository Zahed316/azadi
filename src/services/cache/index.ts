/**
 * KV-backed cache service for the Azadi Coffee Bot.
 *
 * Implements {@link ICacheService} using Cloudflare Workers KV.
 * All values are stored as JSON strings with an optional TTL.
 *
 * @module services/cache
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type { ICacheService } from '../types';
import { DEFAULT_TTL } from './keys';

/** Maximum number of keys returned per KV list call. */
const LIST_PAGE_SIZE = 1000;

export class CacheService implements ICacheService {
  constructor(private readonly kv: KVNamespace) {}

  /**
   * Get a cached value by key.
   * Returns `null` when the key is missing, expired, or on error.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = await this.kv.get(key, 'json');
      return (raw as T) ?? null;
    } catch (error) {
      console.error(`[CacheService] get error for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Store a value in the cache.
   * @param ttlSeconds Time-to-live in seconds (default: 300 = 5 min).
   */
  async set<T = unknown>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL): Promise<void> {
    try {
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttlSeconds,
      });
    } catch (error) {
      console.error(`[CacheService] set error for key "${key}":`, error);
    }
  }

  /**
   * Delete a single cached value by key.
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error(`[CacheService] delete error for key "${key}":`, error);
    }
  }

  /**
   * Delete all keys whose name starts with `prefix`.
   *
   * KV does not support prefix deletion natively, so we page through
   * `kv.list({ prefix })` and delete each key individually.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      let cursor: string | undefined;
      do {
        const page = await this.kv.list({ prefix, limit: LIST_PAGE_SIZE, cursor });
        await Promise.all(page.keys.map((k) => this.kv.delete(k.name)));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
    } catch (error) {
      console.error(`[CacheService] deleteByPrefix error for prefix "${prefix}":`, error);
    }
  }

  /**
   * Check whether a key exists in the cache without fetching its value.
   *
   * KV `getMetadata()` is used instead of `get()` to avoid transferring
   * the full value payload.
   */
  async has(key: string): Promise<boolean> {
    try {
      const metadata = await this.kv.getWithMetadata(key);
      return metadata.value !== null;
    } catch (error) {
      console.error(`[CacheService] has error for key "${key}":`, error);
      return false;
    }
  }
}
