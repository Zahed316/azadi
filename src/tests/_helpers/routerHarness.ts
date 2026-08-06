/**
 * Router test harness.
 *
 * Mocks validateInitData, getAdminRole, and getDb so we can call
 * handleApiRequest with a real Request object and exercise the HTTP layer
 * without a real Cloudflare D1 binding or HMAC signature verification.
 */
import { vi } from 'vitest';
import type { Env } from '../../bot';

// ---------------------------------------------------------------------------
// 1. In-memory store
// ---------------------------------------------------------------------------

type TableRow = Record<string, unknown>;

const store = new Map<string, TableRow[]>();

function getRows(tableName: string): TableRow[] {
  if (!store.has(tableName)) store.set(tableName, []);
  return store.get(tableName)!;
}

function tableNameOf(table: any): string {
  return table?.[Symbol.for('drizzle:Name')] ?? String(table);
}

/** Seed a table with rows (overwrites existing). */
export function seedTable(table: any, rows: TableRow[]): void {
  store.set(
    tableNameOf(table),
    rows.map((r) => ({ ...r })),
  );
}

/** Read current rows (for assertions). */
export function readTable(table: any): TableRow[] {
  return getRows(tableNameOf(table)).map((r) => ({ ...r }));
}

/** Clear all tables between tests. */
export function clearStore(): void {
  store.clear();
  autoId = 1;
}

// ---------------------------------------------------------------------------
// 2. Drizzle eq()-condition extraction (fragile but acceptable for tests)
// ---------------------------------------------------------------------------

interface EqCondition {
  column: string;
  tableName: string;
  value: unknown;
}

function extractEq(condition: unknown): EqCondition | null {
  const c = condition as any;
  if (!c?.queryChunks) return null;
  const left = c.queryChunks[1];
  const right = c.queryChunks[3];
  if (!left || !right) return null;
  // Drizzle columns carry the SQL column name in `.name` (e.g. `telegram_id`)
  // but rows in the harness store are seeded with the JS property name
  // (camelCase, e.g. `telegramId`). Convert snake→camel so the WHERE clause
  // finds the matching key.
  const camel = String(left.name).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  return {
    column: camel,
    tableName: tableNameOf(left.table),
    value: right.value ?? right,
  };
}

function matchesCondition(row: TableRow, eqs: EqCondition[]): boolean {
  return eqs.every((eq) => row[eq.column] === eq.value);
}

// ---------------------------------------------------------------------------
// 3. Chainable query builder
// ---------------------------------------------------------------------------

let autoId = 1;

class QueryChain {
  private _op: 'select' | 'insert' | 'update' | 'delete';
  private _table: any = null;
  private _eqs: EqCondition[] = [];
  private _values: TableRow | null = null;
  private _setData: TableRow | null = null;
  private _hasReturning = false;
  private _joinCount = 0;
  private _joinTables: any[] = [];
  private _limitN: number | null = null;

  constructor(op: 'select' | 'insert' | 'update' | 'delete') {
    this._op = op;
  }

  from(t: any) {
    this._table = t;
    return this;
  }

  leftJoin(t: any, _condition: unknown) {
    this._joinCount++;
    this._joinTables.push(t);
    return this;
  }

  where(condition: unknown) {
    const eq = extractEq(condition);
    if (eq) this._eqs.push(eq);
    return this;
  }

  orderBy(..._args: unknown[]) {
    return this;
  }

  limit(n: number) {
    this._limitN = n;
    return this;
  }

  values(d: TableRow) {
    this._values = d;
    return this;
  }

  set(d: TableRow) {
    this._setData = d;
    return this;
  }

  onConflictDoUpdate(_opts: unknown) {
    return this;
  }

  /**
   * For tests: treat the insert as a no-op. The harness doesn't track
   * conflict targets, so callers using this should set up rows that
   * can't collide (or seed/clear the store around the test).
   */
  onConflictDoNothing() {
    return this;
  }

  returning() {
    this._hasReturning = true;
    return this;
  }

  /* Make the chain thenable so `await chain` works without .returning(). */
  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this._exec()).then(onfulfilled, onrejected);
  }

  /* ---- execution ---- */

  private _exec(): unknown[] {
    if (!this._table) return [];
    const tableName = tableNameOf(this._table);
    const rows = getRows(tableName);

    switch (this._op) {
      case 'select': {
        let matched =
          this._eqs.length > 0
            ? rows.filter((r) => matchesCondition(r, this._eqs))
            : rows.map((r) => ({ ...r }));

        if (this._limitN !== null) matched = matched.slice(0, this._limitN);

        if (this._joinCount > 0) {
          return matched.map((row) => {
            const result: Record<string, unknown> = {};
            result[tableName] = { ...row };
            for (const jt of this._joinTables) {
              result[tableNameOf(jt)] = null;
            }
            return result;
          });
        }
        return matched.map((r) => ({ ...r }));
      }

      case 'insert': {
        if (!this._values) return [];
        const row: TableRow = { id: autoId++, ...this._values };
        rows.push(row);
        return this._hasReturning ? [{ ...row }] : [];
      }

      case 'update': {
        const updated: TableRow[] = [];
        for (const row of rows) {
          if (this._eqs.length === 0 || matchesCondition(row, this._eqs)) {
            Object.assign(row, this._setData);
            updated.push({ ...row });
            break; // update first match only (matches drizzle behaviour)
          }
        }
        return this._hasReturning ? updated : [];
      }

      case 'delete': {
        const removed: TableRow[] = [];
        for (let i = rows.length - 1; i >= 0; i--) {
          if (this._eqs.length === 0 || matchesCondition(rows[i], this._eqs)) {
            removed.unshift(rows.splice(i, 1)[0]);
          }
        }
        return this._hasReturning ? removed : [];
      }

      default:
        return [];
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Fake Drizzle database
// ---------------------------------------------------------------------------

class FakeDb {
  select() {
    return new QueryChain('select');
  }
  insert(table: any) {
    const c = new QueryChain('insert');
    c.from(table);
    return c;
  }
  update(table: any) {
    const c = new QueryChain('update');
    c.from(table);
    return c;
  }
  delete(table: any) {
    const c = new QueryChain('delete');
    c.from(table);
    return c;
  }
}

// ---------------------------------------------------------------------------
// 5. Module mocks
// ---------------------------------------------------------------------------

const fakeDb = new FakeDb();

vi.mock('../../database/client', () => ({
  getDb: vi.fn(() => fakeDb),
}));

let mockValidateResult: any = { id: 12345, first_name: 'Test' };

vi.mock('../../api/auth', () => ({
  validateInitData: vi.fn(() => Promise.resolve(mockValidateResult)),
}));

const defaultAdminRole = { telegramId: 12345, role: 'super_admin', categoryId: null };
let mockAdminRole: any = { ...defaultAdminRole };

vi.mock('../../middlewares/auth', () => ({
  getAdminRole: vi.fn(() => Promise.resolve(mockAdminRole)),
}));

// ---------------------------------------------------------------------------
// 6. Public helpers
// ---------------------------------------------------------------------------

/** Override the value returned by validateInitData (null = invalid initData). */
export function setValidateResult(result: any) {
  mockValidateResult = result;
}

/** Override the admin role returned by getAdminRole (null = not an admin). */
export function setAdminRole(role: any) {
  mockAdminRole = role;
}

/** Reset auth mocks to their defaults. */
export function resetAuthDefaults() {
  mockValidateResult = { id: 12345, first_name: 'Test' };
  mockAdminRole = { ...defaultAdminRole };
}

export interface CallRouterOpts {
  method: string;
  path: string;
  body?: unknown;
  auth?: string | null; // null = no Authorization header; undefined = default Telegram initData
  env?: Record<string, unknown>;
}

/**
 * Build a real Request and call handleApiRequest.
 * Returns { status, body } for easy assertions.
 */
export async function callRouter({
  method,
  path,
  body,
  auth,
  env: envOverrides,
}: CallRouterOpts): Promise<{ status: number; body: any; headers: Headers }> {
  // Dynamically import so vi.mock above has taken effect.
  const { handleApiRequest } = await import('../../api/router');

  const url = `https://bot.test/api/${path}`;
  const headers: Record<string, string> = {};

  if (auth !== null) {
    headers['Authorization'] = auth ?? 'Telegram fake-init-data';
  }

  const init: RequestInit = { method, headers };

  if (body !== undefined && method !== 'GET' && method !== 'OPTIONS') {
    init.body = JSON.stringify(body);
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }

  const request = new Request(url, init);

  const fakeEnv: Env = {
    TELEGRAM_BOT_TOKEN: 'test-token',
    SECRET_TOKEN: 'test-secret',
    DB: fakeDb as unknown as import('@cloudflare/workers-types').D1Database,
    OPENCODE_API_KEY: 'test-key',
    ...envOverrides,
  };

  const ctx = {} as ExecutionContext; // stub — not used by the router
  const response = await handleApiRequest(request, fakeEnv, ctx);
  const responseBody = await response.json().catch(() => null);

  return { status: response.status, body: responseBody, headers: response.headers };
}

