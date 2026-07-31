import { StorageAdapter } from 'grammy';

/**
 * D1-backed session storage adapter for grammY.
 * Persists conversation state across Cloudflare Worker invocations.
 */
export class D1SessionStorage<T> implements StorageAdapter<T> {
  constructor(private db: any) {}

  async read(key: string): Promise<T | undefined> {
    const result = await this.db
      .prepare('SELECT value FROM sessions WHERE key = ?')
      .bind(key)
      .first() as { value: string } | null;
    if (!result) return undefined;
    try {
      return JSON.parse(result.value) as T;
    } catch {
      return undefined;
    }
  }

  async write(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.db
      .prepare(
        'INSERT INTO sessions (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .bind(key, serialized)
      .run();
  }

  async delete(key: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE key = ?')
      .bind(key)
      .run();
  }
}
