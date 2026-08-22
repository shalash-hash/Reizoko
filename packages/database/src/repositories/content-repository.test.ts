import { describe, expect, it } from 'vitest';
import { createBlock } from '@reizoko/core';
import { bootstrapDatabase } from '../bootstrap.js';
import { MemoryDatabaseClient } from '../test/memory-database-client.js';
import { runMigrations, MIGRATIONS } from '../migrations/index.js';

async function createTestDb() {
  const client = new MemoryDatabaseClient();
  const db = await bootstrapDatabase(client);
  return { client, db };
}

describe('ContentRepository revision policy', () => {
  it('does not create dozens of historical versions on rapid autosaves', async () => {
    const { client, db } = await createTestDb();
    const item = await db.content.createItem({ title: 'Title A' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);

    await db.content.saveWorking(item.id, { title: 'Title A' }, [
      createBlock('text', 0, { text: 'A1' }),
    ]);
    await db.content.saveWorking(item.id, { title: 'Title A' }, [
      createBlock('text', 0, { text: 'A2' }),
    ]);
    await db.content.saveWorking(item.id, { title: 'Title A' }, [
      createBlock('text', 0, { text: 'A3' }),
    ]);

    const revisions = await db.content.getRevisions(item.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.kind).toBe('working');
    client.close();
  });

  it('creates a new historical version on manual checkpoint', async () => {
    const { client, db } = await createTestDb();
    const item = await db.content.createItem({ title: 'Title A' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);

    await db.content.createManualCheckpoint(item.id);
    const revisions = await db.content.getRevisions(item.id);

    expect(revisions).toHaveLength(2);
    expect(revisions.some((revision) => revision.kind === 'checkpoint')).toBe(true);
    expect(revisions.find((revision) => revision.kind === 'working')?.origin).toBe('manual');
    client.close();
  });

  it('restore creates a new revision instead of rewinding history', async () => {
    const { client, db } = await createTestDb();
    const item = await db.content.createItem({ title: 'Title A' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);
    await db.content.createManualCheckpoint(item.id);
    const versionA = (await db.content.getRevisions(item.id)).find((revision) => revision.version === 1)!;
    await db.content.saveWorking(item.id, { title: 'Title B' }, [
      createBlock('text', 0, { text: 'B' }),
    ]);

    const restored = await db.content.restoreRevision(item.id, versionA.id);
    const revisions = await db.content.getRevisions(item.id);

    expect(restored.metadata.title).toBe('Title A');
    expect(restored.revision.origin).toBe('restore');
    expect(restored.revision.version).toBeGreaterThan(versionA.version);
    expect(revisions.some((revision) => revision.id === versionA.id)).toBe(true);
    client.close();
  });

  it('does not delete the current revision when restoring an older one', async () => {
    const { client, db } = await createTestDb();
    const item = await db.content.createItem({ title: 'Title A' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);
    await db.content.createManualCheckpoint(item.id);
    const versionA = (await db.content.getRevisions(item.id)).find((revision) => revision.version === 1)!;
    const beforeRestore = await db.content.getItem(item.id);
    await db.content.saveWorking(item.id, { title: 'Title B' }, [
      createBlock('text', 0, { text: 'B' }),
    ]);

    await db.content.restoreRevision(item.id, versionA.id);
    const revisions = await db.content.getRevisions(item.id);

    expect(revisions.some((revision) => revision.id === beforeRestore?.revision.id)).toBe(true);
    client.close();
  });

  it('keeps increasing version numbers after restore', async () => {
    const { client, db } = await createTestDb();
    const item = await db.content.createItem({ title: 'Title A' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);
    const v1 = item.revision.version;
    await db.content.createManualCheckpoint(item.id);
    const versionA = (await db.content.getRevisions(item.id)).find((revision) => revision.version === 1)!;
    await db.content.saveWorking(item.id, { title: 'Title B' }, [
      createBlock('text', 0, { text: 'B' }),
    ]);
    const restored = await db.content.restoreRevision(item.id, versionA.id);

    expect(restored.revision.version).toBeGreaterThan(v1 + 1);
    client.close();
  });

  it('restores title together with blocks', async () => {
    const { client, db } = await createTestDb();
    const item = await db.content.createItem({ title: 'Title A' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);
    await db.content.createManualCheckpoint(item.id);
    const versionA = (await db.content.getRevisions(item.id)).find((revision) => revision.version === 1)!;
    await db.content.saveWorking(item.id, { title: 'Title B' }, [
      createBlock('text', 0, { text: 'B' }),
    ]);

    const restored = await db.content.restoreRevision(item.id, versionA.id);
    expect(restored.metadata.title).toBe('Title A');
    expect(restored.revision.blocks[0]?.type === 'text'
      ? (restored.revision.blocks[0].data as { text: string }).text
      : '').toBe('A');
    client.close();
  });

  it('keeps historical revisions immutable after checkpoint', async () => {
    const { client, db } = await createTestDb();
    const item = await db.content.createItem({ title: 'Title A' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);
    await db.content.createManualCheckpoint(item.id);
    const versionA = (await db.content.getRevisions(item.id)).find((revision) => revision.version === 1)!;
    expect(versionA.kind).toBe('checkpoint');

    await db.content.saveWorking(item.id, { title: 'Title B' }, [
      createBlock('text', 0, { text: 'B' }),
    ]);
    const afterEdit = await db.content.getRevision(versionA.id);
    expect(afterEdit?.metadata.title).toBe('Title A');
    expect(afterEdit?.blocks[0]?.type === 'text'
      ? (afterEdit.blocks[0].data as { text: string }).text
      : '').toBe('A');
    client.close();
  });
});

describe('Migration v2', () => {
  it('applies revision metadata migration to an existing v1 database', async () => {
    const client = new MemoryDatabaseClient();
    await runMigrations(client);

    const v1Only = MIGRATIONS.filter((migration) => migration.version === 1);
    const freshClient = new MemoryDatabaseClient();
    await freshClient.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
    await freshClient.batch([
      { sql: v1Only[0]!.up },
      {
        sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        params: [1, 'initial_schema', new Date().toISOString()],
      },
    ]);

    await freshClient.execute(
      `INSERT INTO content_items (id, created_at, updated_at, current_revision_id, metadata_json, sync_state)
       VALUES ('item-1', '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z', 'rev-1', '{"title":"Old title"}', 'local')`,
    );
    await freshClient.execute(
      `INSERT INTO content_revisions (id, content_item_id, created_at, blocks_json, version)
       VALUES ('rev-1', 'item-1', '2026-01-01T10:00:00.000Z', '[{"id":"b1","type":"text","order":0,"data":{"text":"hello"}}]', 1)`,
    );

    await runMigrations(freshClient);
    const row = await freshClient.select<{ metadata_json: string; kind: string; origin: string }>(
      `SELECT metadata_json, kind, origin FROM content_revisions WHERE id = 'rev-1'`,
    );

    expect(JSON.parse(row.rows[0]?.metadata_json ?? '{}').title).toBe('Old title');
    expect(row.rows[0]?.kind).toBe('working');
    expect(row.rows[0]?.origin).toBe('legacy');
    freshClient.close();
    client.close();
  });
});
