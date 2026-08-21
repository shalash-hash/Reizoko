import Database from '@tauri-apps/plugin-sql';
import type { DatabaseClient, QueryResult } from '@reizoko/database';

export class TauriDatabaseClient implements DatabaseClient {
  private constructor(private readonly db: Database) {}

  static async connect(dbPath = 'sqlite:reizoko.db'): Promise<TauriDatabaseClient> {
    const db = await Database.load(dbPath);
    return new TauriDatabaseClient(db);
  }

  async execute(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ rowsAffected: number; lastInsertId?: number }> {
    const result = await this.db.execute(sql, params);
    return { rowsAffected: result.rowsAffected ?? 0, lastInsertId: result.lastInsertId };
  }

  async select<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const rows = await this.db.select<T[]>(sql, params);
    return { rows: rows ?? [] };
  }

  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    for (const statement of statements) {
      await this.db.execute(statement.sql, statement.params ?? []);
    }
  }
}
