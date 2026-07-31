import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(d1Binding: any) {
  return drizzle(d1Binding, { schema });
}
