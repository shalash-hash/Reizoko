import { describe, expect, it } from 'vitest';
import type { ContentBlock } from '@reizoko/shared';
import {
  PlatformRegistry,
  type PlatformAdapter,
  type PlatformDefinition,
  type TransformedContent,
  type PlatformValidationIssue,
} from '@reizoko/platform-sdk';
import { createBlock } from '../../../core/src/content/content-service.js';
import { PublicationService } from '../../../core/src/publication/publication-service.js';
import { bootstrapDatabase } from '../bootstrap.js';
import { MemoryDatabaseClient } from '../test/memory-database-client.js';
import { runMigrations, MIGRATIONS } from '../migrations/index.js';

function createMockAdapter(
  id: string,
  options?: {
    transform?: (blocks: ContentBlock[]) => TransformedContent;
    validate?: (blocks: ContentBlock[]) => PlatformValidationIssue[];
  },
): PlatformAdapter {
  return {
    id,
    name: id,
    icon: '•',
    color: '#000',
    available: true,
    capabilities: {
      supportsHeadings: true,
      supportsMultipleImages: true,
      supportsVideo: false,
      supportsLinks: true,
    },
    transform:
      options?.transform ??
      ((blocks) => ({
        text: blocks
          .filter((block) => block.type === 'text')
          .map((block) => (block.data as { text: string }).text)
          .join('\n'),
        images: [],
        warnings: [],
      })),
    validate: options?.validate ?? (() => []),
  };
}

function registerMockPlatform(registry: PlatformRegistry, adapter: PlatformAdapter): void {
  const definition: PlatformDefinition = {
    adapter,
    Preview: () => null,
  };
  registry.register(definition);
}

async function createPublicationTestContext() {
  const client = new MemoryDatabaseClient();
  const db = await bootstrapDatabase(client);
  const registry = new PlatformRegistry();
  registerMockPlatform(registry, createMockAdapter('instagram'));
  registerMockPlatform(registry, createMockAdapter('telegram'));
  registerMockPlatform(
    registry,
    createMockAdapter('vk', {
      validate: () => [{ severity: 'warning', message: 'VK warning sample' }],
    }),
  );

  const service = new PublicationService(
    db.content,
    db.publicationBatches,
    db.publications,
    registry,
  );

  return { client, db, service };
}

describe('PublicationService', () => {
  it('creates 1 batch and 3 publications for 3 targets', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Batch test' }, [
      createBlock('text', 0, { text: 'Hello world' }),
    ]);

    const result = await service.prepareBatch({
      contentItemId: item.id,
      targets: [
        { platformId: 'instagram' },
        { platformId: 'telegram' },
        { platformId: 'vk' },
      ],
    });

    expect(result.batch.contentItemId).toBe(item.id);
    expect(result.publications).toHaveLength(3);
    expect(result.publications.every((publication) => publication.status === 'draft')).toBe(true);
    client.close();
  });

  it('assigns the same batchId to all publications in a batch', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Batch id test' }, [
      createBlock('text', 0, { text: 'Same batch' }),
    ]);

    const result = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram' }, { platformId: 'telegram' }, { platformId: 'vk' }],
    });

    const batchIds = new Set(result.publications.map((publication) => publication.batchId));
    expect(batchIds.size).toBe(1);
    expect(batchIds.has(result.batch.id)).toBe(true);
    client.close();
  });

  it('links the batch to an immutable publication checkpoint', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Checkpoint test' }, [
      createBlock('text', 0, { text: 'Checkpoint content' }),
    ]);

    const result = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram' }],
    });

    const checkpoint = await db.content.getRevision(result.batch.contentRevisionId);
    expect(checkpoint?.kind).toBe('checkpoint');
    expect(checkpoint?.origin).toBe('publication');

    const working = await db.content.getItem(item.id);
    expect(working?.revision.id).not.toBe(checkpoint?.id);
    expect(working?.revision.kind).toBe('working');
    client.close();
  });

  it('does not change prepared publications when master post is edited afterwards', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Immutable test' }, [
      createBlock('text', 0, { text: 'Original text' }),
    ]);

    const prepared = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram' }],
    });
    const snapshotText = prepared.publications[0]?.preparedSnapshot.transformedContent.text;

    await db.content.saveWorking(item.id, { title: 'Immutable test' }, [
      createBlock('text', 0, { text: 'Edited after prepare' }),
    ]);

    const stored = await db.publications.getById(prepared.publications[0]!.id);
    expect(stored?.preparedSnapshot.transformedContent.text).toBe(snapshotText);
    expect(stored?.preparedSnapshot.transformedContent.text).toBe('Original text');

    const checkpoint = await db.content.getRevision(prepared.batch.contentRevisionId);
    expect(checkpoint?.blocks[0]?.type === 'text'
      ? (checkpoint.blocks[0].data as { text: string }).text
      : '').toBe('Original text');
    client.close();
  });

  it('creates a new batch on repeated prepare', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Repeat test' }, [
      createBlock('text', 0, { text: 'First prepare' }),
    ]);

    const first = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram' }],
    });

    await db.content.saveWorking(item.id, { title: 'Repeat test' }, [
      createBlock('text', 0, { text: 'Second prepare' }),
    ]);

    const second = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'telegram' }],
    });

    const batches = await service.listBatchesByContentItem(item.id);
    expect(batches).toHaveLength(2);
    expect(first.batch.id).not.toBe(second.batch.id);
    client.close();
  });

  it('stores transformed content in publication snapshots', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Snapshot test' }, [
      createBlock('text', 0, { text: 'Snapshot body' }),
    ]);

    const result = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'telegram' }],
    });

    expect(result.publications[0]?.preparedSnapshot.transformedContent.text).toBe('Snapshot body');
    expect(result.publications[0]?.preparedSnapshot.formatVersion).toBe(1);
    client.close();
  });

  it('stores validation issues separately per target', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Validation test' }, [
      createBlock('text', 0, { text: 'Validation body' }),
    ]);

    const result = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram' }, { platformId: 'vk' }],
    });

    const instagram = result.publications.find((publication) => publication.platformId === 'instagram');
    const vk = result.publications.find((publication) => publication.platformId === 'vk');

    expect(instagram?.preparedSnapshot.validationIssues).toEqual([]);
    expect(vk?.preparedSnapshot.validationIssues.some((issue) => issue.severity === 'warning')).toBe(true);
    client.close();
  });

  it('cancels draft publications in a batch', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Cancel test' }, [
      createBlock('text', 0, { text: 'Cancel me' }),
    ]);

    const prepared = await service.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram' }, { platformId: 'telegram' }],
    });

    const cancelled = await service.cancelBatch(prepared.batch.id);
    expect(cancelled.every((publication) => publication.status === 'cancelled')).toBe(true);
    client.close();
  });

  it('supports multiple targets on the same platform with different socialAccountId', async () => {
    const { client, db, service } = await createPublicationTestContext();
    const item = await db.content.createItem({ title: 'Multi account test' }, [
      createBlock('text', 0, { text: 'Multi account body' }),
    ]);

    const result = await service.prepareBatch({
      contentItemId: item.id,
      targets: [
        { platformId: 'instagram', socialAccountId: 'acc-personal' },
        { platformId: 'instagram', socialAccountId: 'acc-company' },
      ],
    });

    expect(result.publications).toHaveLength(2);
    expect(result.publications[0]?.socialAccountId).not.toBe(result.publications[1]?.socialAccountId);
    client.close();
  });
});

describe('Migration v3', () => {
  it('applies publication architecture migration to an existing v2 database', async () => {
    const client = new MemoryDatabaseClient();
    await runMigrations(client);

    const v1AndV2 = MIGRATIONS.filter((migration) => migration.version <= 2);
    const freshClient = new MemoryDatabaseClient();
    await freshClient.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    for (const migration of v1AndV2) {
      await freshClient.batch([
        { sql: migration.up },
        {
          sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          params: [migration.version, migration.name, new Date().toISOString()],
        },
      ]);
    }

    await runMigrations(freshClient);

    const tables = await freshClient.select<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'publication_batches'`,
    );
    expect(tables.rows).toHaveLength(1);

    const columns = await freshClient.select<{ name: string }>(`PRAGMA table_info(publications)`);
    const columnNames = columns.rows.map((row) => row.name);
    expect(columnNames).toContain('batch_id');
    expect(columnNames).toContain('prepared_snapshot_json');

    freshClient.close();
    client.close();
  });
});
