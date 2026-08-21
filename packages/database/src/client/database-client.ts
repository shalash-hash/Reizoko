export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface DatabaseClient {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void>;
}
