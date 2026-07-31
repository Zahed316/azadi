import { drizzle } from 'drizzle-orm/d1';
try {
  drizzle(undefined as any);
} catch (e) {
  console.log(e.message);
}
