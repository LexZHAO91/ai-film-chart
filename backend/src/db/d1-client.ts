import type { D1Database } from '@cloudflare/workers-types';

export class D1Client {
  constructor(private db: D1Database) {}

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const result = params ? stmt.bind(...params) : stmt;
    const { results } = await result.all<T>();
    return results || [];
  }

  async queryOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results[0] || null;
  }

  async run(sql: string, params?: unknown[]): Promise<{ success: boolean; meta?: unknown }> {
    const stmt = this.db.prepare(sql);
    const result = params ? stmt.bind(...params) : stmt;
    return await result.run();
  }

  async batch<T = unknown>(statements: { sql: string; params?: unknown[] }[]): Promise<T[][]> {
    const prepped = statements.map(s => {
      const stmt = this.db.prepare(s.sql);
      return s.params ? stmt.bind(...s.params) : stmt;
    });
    const results = await this.db.batch(prepped);
    return results.map((r: unknown) => (r as { results?: T[] }).results || []);
  }
}
