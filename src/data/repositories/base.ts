import { eq, desc, type SQL } from 'drizzle-orm';
import { getDb } from '../../database/client';

export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected db: ReturnType<typeof getDb>;

  constructor(d1Binding: any) {
    this.db = getDb(d1Binding);
  }

  abstract getTable(): any;

  async findAll(): Promise<T[]> {
    const table = this.getTable();
    return (this.db.select().from(table) as any) as Promise<T[]>;
  }

  async findById(id: number): Promise<T | undefined> {
    const table = this.getTable();
    const result = (await (this.db
      .select()
      .from(table)
      .where(eq(table.id, id)) as any)) as T[];
    return result[0];
  }

  async create(data: Partial<T>): Promise<T> {
    const table = this.getTable();
    const result = (await (this.db
      .insert(table)
      .values(data as any)
      .returning() as any)) as T[];
    return result[0];
  }

  async update(id: number, data: Partial<T>): Promise<T> {
    const table = this.getTable();
    const result = (await (this.db
      .update(table)
      .set(data as any)
      .where(eq(table.id, id))
      .returning() as any)) as T[];
    return result[0];
  }

  async delete(id: number): Promise<void> {
    const table = this.getTable();
    await this.db.delete(table).where(eq(table.id, id));
  }

  protected async findByCondition(condition: SQL, orderBy?: SQL): Promise<T[]> {
    const table = this.getTable();
    let query: any = this.db.select().from(table).where(condition);
    if (orderBy) {
      query = query.orderBy(orderBy);
    }
    return (query as any) as Promise<T[]>;
  }

  protected async findMany(options: {
    where?: SQL;
    orderBy?: SQL;
    limit?: number;
    offset?: number;
  }): Promise<T[]> {
    const table = this.getTable();
    let query: any = this.db.select().from(table);
    if (options.where) query = query.where(options.where);
    if (options.orderBy) query = query.orderBy(options.orderBy);
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.offset(options.offset);
    return (query as any) as Promise<T[]>;
  }
}
