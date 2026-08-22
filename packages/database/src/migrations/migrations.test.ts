import { describe, expect, it } from 'vitest';
import { MemoryDatabaseClient } from '../test/memory-database-client.js';
import { runMigrations, MIGRATIONS } from './index.js';

describe('database migrations', () => {
  it('applies v1 through latest on a fresh database', async () => {
    const client = new MemoryDatabaseClient();
    await runMigrations(client);

    const applied = await client.select<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version',
    );
    expect(applied.rows.map((row) => row.version)).toEqual(MIGRATIONS.map((migration) => migration.version));

    const tables = await client.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    expect(tables.rows.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'app_settings',
        'content_items',
        'content_revisions',
        'media_items',
        'publication_batches',
        'publications',
        'schema_migrations',
        'social_accounts',
        'workspace_state',
      ]),
    );
    client.close();
  });

  it('is idempotent on an already migrated database', async () => {
    const client = new MemoryDatabaseClient();
    await runMigrations(client);
    const first = await client.select<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');

    await runMigrations(client);
    const second = await client.select<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');

    expect(second.rows).toEqual(first.rows);
    client.close();
  });
});
