export interface Migration {
  version: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        current_revision_id TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        sync_state TEXT DEFAULT 'local',
        device_id TEXT
      );

      CREATE TABLE IF NOT EXISTS content_revisions (
        id TEXT PRIMARY KEY,
        content_item_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        blocks_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (content_item_id) REFERENCES content_items(id)
      );

      CREATE TABLE IF NOT EXISTS publications (
        id TEXT PRIMARY KEY,
        content_revision_id TEXT NOT NULL,
        social_account_id TEXT,
        platform_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        scheduled_at TEXT,
        published_at TEXT,
        remote_post_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (content_revision_id) REFERENCES content_revisions(id)
      );

      CREATE TABLE IF NOT EXISTS media_items (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        local_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS workspace_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS social_accounts (
        id TEXT PRIMARY KEY,
        platform_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        connected_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_content_items_updated ON content_items(updated_at);
      CREATE INDEX IF NOT EXISTS idx_content_revisions_item ON content_revisions(content_item_id);
      CREATE INDEX IF NOT EXISTS idx_publications_revision ON publications(content_revision_id);
    `,
  },
];

import type { DatabaseClient } from '../client/database-client.js';

export async function runMigrations(db: DatabaseClient): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = await db.select<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version',
  );
  const appliedVersions = new Set(applied.rows.map((r: { version: number }) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;
    await db.batch([
      { sql: migration.up },
      {
        sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        params: [migration.version, migration.name, new Date().toISOString()],
      },
    ]);
  }
}
