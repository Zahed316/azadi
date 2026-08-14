import { StorageAdapter } from 'grammy';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Wraps D1 session storage and skips the D1 write when the session object
 * hasn't changed since the last read. Saves ~20-50 ms per request where the
 * handler does not modify session state.
 */
export class ConditionalSessionStorage<T> implements StorageAdapter<T> {
  private snapshots = new Map<string, string>();
  private readCache = new Map<string, T>();

  constructor(private db: D1Database) {}

  async read(key: string): Promise<T | undefined> {
    const cached = this.readCache.get(key);
    if (cached !== undefined) return cached;

    const result: { value: string } | null = await this.db
      .prepare('SELECT value FROM sessions WHERE key = ?')
      .bind(key)
      .first();
    if (!result) return undefined;
    try {
      const parsed = JSON.parse(result.value) as T;
      this.snapshots.set(key, result.value);
      this.readCache.set(key, parsed);
      return parsed;
    } catch {
      return undefined;
    }
  }

  async write(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    const previous = this.snapshots.get(key);
    if (previous === serialized) {
      return; // Session unchanged — skip D1 write
    }
    await this.db
      .prepare(
        'INSERT INTO sessions (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .bind(key, serialized)
      .run();
    this.snapshots.set(key, serialized);
    this.readCache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.snapshots.delete(key);
    this.readCache.delete(key);
    await this.db.prepare('DELETE FROM sessions WHERE key = ?').bind(key).run();
  }
}
