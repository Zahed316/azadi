import { expect, test, vi, beforeEach } from 'vitest';
import { ConditionalSessionStorage } from '../database/conditionalSessionStorage';

function createMockDB() {
  const store = new Map<string, string>();
  const prepare = vi.fn((sql: string) => {
    const bind = vi.fn((...args: string[]) => ({
      first: vi.fn(() => {
        if (sql.startsWith('SELECT')) {
          const key = args[0];
          const value = store.get(key);
          return value ? { value } : null;
        }
        return null;
      }),
      run: vi.fn(() => {
        if (sql.includes('INSERT')) {
          store.set(args[0], args[1]);
        } else if (sql.includes('DELETE')) {
          store.delete(args[0]);
        }
        return { success: true };
      }),
    }));
    return { bind };
  });
  return { prepare, _store: store };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test('write is called when session changes after read', async () => {
  const db = createMockDB();
  db._store.set('key1', JSON.stringify({ count: 1 }));
  const storage = new ConditionalSessionStorage(db as any);

  await storage.read('key1');
  await storage.write('key1', { count: 2 });

  // The INSERT statement should have been prepared
  expect(db.prepare).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO sessions'),
  );
});

test('write is skipped when session is unchanged after read', async () => {
  const db = createMockDB();
  db._store.set('key1', JSON.stringify({ count: 1 }));
  const storage = new ConditionalSessionStorage(db as any);

  await storage.read('key1');
  await storage.write('key1', { count: 1 });

  // Only SELECT should have been called, no INSERT
  const calls = db.prepare.mock.calls.map((c: string[]) => c[0]);
  expect(calls).toEqual([expect.stringContaining('SELECT')]);
});

test('write is always called when there was no prior read', async () => {
  const db = createMockDB();
  const storage = new ConditionalSessionStorage(db as any);

  await storage.write('new-key', { foo: 'bar' });

  expect(db.prepare).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO sessions'),
  );
});

test('delete clears the snapshot', async () => {
  const db = createMockDB();
  db._store.set('key1', JSON.stringify({ count: 1 }));
  const storage = new ConditionalSessionStorage(db as any);

  await storage.read('key1');
  await storage.delete('key1');

  expect(db.prepare).toHaveBeenCalledWith(
    expect.stringContaining('DELETE FROM sessions'),
  );

  // Now write should always go to D1 (no snapshot to compare against)
  await storage.write('key1', { count: 1 });
  expect(db.prepare).toHaveBeenCalledWith(
    expect.stringContaining('INSERT INTO sessions'),
  );
});

test('read returns parsed value from D1', async () => {
  const db = createMockDB();
  db._store.set('key1', JSON.stringify({ foo: 'bar' }));
  const storage = new ConditionalSessionStorage(db as any);

  const result = await storage.read('key1');
  expect(result).toEqual({ foo: 'bar' });
});

test('read returns undefined for missing key', async () => {
  const db = createMockDB();
  const storage = new ConditionalSessionStorage(db as any);

  const result = await storage.read('missing');
  expect(result).toBeUndefined();
});

test('multiple keys tracked independently', async () => {
  const db = createMockDB();
  db._store.set('k1', JSON.stringify({ a: 1 }));
  db._store.set('k2', JSON.stringify({ b: 2 }));
  const storage = new ConditionalSessionStorage(db as any);

  await storage.read('k1');
  await storage.read('k2');

  // k1 unchanged — write skipped
  await storage.write('k1', { a: 1 });
  // k2 changed — write goes to D1
  await storage.write('k2', { b: 99 });

  // Verify: only one INSERT prepared (for k2)
  const insertCalls = db.prepare.mock.calls.filter((c: string[]) =>
    c[0].includes('INSERT INTO sessions'),
  );
  expect(insertCalls.length).toBe(1);

  // Verify: store was updated for k2 only
  expect(db._store.get('k2')).toBe(JSON.stringify({ b: 99 }));
  expect(db._store.get('k1')).toBe(JSON.stringify({ a: 1 }));
});
