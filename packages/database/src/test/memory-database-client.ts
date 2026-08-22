import { DatabaseSync } from 'node:sqlite';
import type { DatabaseClient, QueryResult } from './client/database-client.js';

export class MemoryDatabaseClient implements DatabaseClient {
  private readonly db: DatabaseSync;

  constructor(filename = ':memory:') {
    this.db = new DatabaseSync(filename);
  }

  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rowsAffected: number; lastInsertId?: number }> {
    if (params.length === 0) {
      this.db.exec(sql);
      return { rowsAffected: 0 };
    }
    const statement = this.db.prepare(sql);
    const result = statement.run(...params);
    return { rowsAffected: result.changes, lastInsertId: Number(result.lastInsertRowid) || undefined };
  }

  async select<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const statement = this.db.prepare(sql);
    const rows = statement.all(...params) as T[];
    return { rows };
  }

  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    this.db.exec('BEGIN');
    try {
      for (const item of statements) {
        if (item.params?.length) {
          this.db.prepare(item.sql).run(...item.params);
        } else {
          this.db.exec(item.sql);
        }
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}
