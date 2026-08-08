import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';

export function getDb(d1Binding: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1Binding, { schema });
}
