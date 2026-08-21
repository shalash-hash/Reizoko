import { nowIso } from '@reizoko/shared';
import { DatabaseClient } from '../client/database-client.js';

export class SqliteSettingsRepository {
  constructor(private readonly db: DatabaseClient) {}

  async get<T>(key: string, defaultValue: T): Promise<T> {
    const result = await this.db.select<{ value_json: string }>(
      `SELECT value_json FROM app_settings WHERE key = ?`,
      [key],
    );
    if (!result.rows[0]) return defaultValue;
    return JSON.parse(result.rows[0].value_json) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.db.execute(
      `INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), nowIso()],
    );
  }
}
