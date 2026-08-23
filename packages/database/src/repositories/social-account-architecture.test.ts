import { describe, expect, it } from 'vitest';
import {
  PlatformRegistry,
  type PlatformAdapter,
  type PlatformDefinition,
} from '@reizoko/platform-sdk';
import {
  PublicationService,
  SocialAccountService,
  FakeTelegramTransport,
  FakeVkTransport,
  addPlatformTarget,
  createPlatformTarget,
  normalizeWorkspaceState,
  toPreviewAccountContext,
} from '@reizoko/core';
import { createBlock } from '../../../core/src/content/content-service.js';
import { bootstrapDatabase } from '../bootstrap.js';
import { MemoryDatabaseClient } from '../test/memory-database-client.js';
import { runMigrations, MIGRATIONS } from '../migrations/index.js';

function mockAdapter(id: string): PlatformAdapter {
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
    transform: (blocks) => ({
      text: blocks
        .filter((block) => block.type === 'text')
        .map((block) => (block.data as { text: string }).text)
        .join('\n'),
      images: [],
      warnings: [],
    }),
    validate: () => [],
  };
}

async function createContext() {
  const client = new MemoryDatabaseClient();
  const db = await bootstrapDatabase(client);
  const registry = new PlatformRegistry();
  for (const id of ['instagram', 'telegram', 'vk']) {
    const definition: PlatformDefinition = { adapter: mockAdapter(id), Preview: () => null };
    registry.register(definition);
  }

  const socialAccountService = new SocialAccountService(db.socialAccounts, (platformId) =>
    ['instagram', 'telegram', 'vk', 'threads'].includes(platformId),
  );
  const publicationService = new PublicationService(
    db.content,
    db.publicationBatches,
    db.publications,
    registry,
    db.socialAccounts,
    db.platformConnections,
    new FakeTelegramTransport(),
    new FakeVkTransport(),
  );

  return { client, db, socialAccountService, publicationService };
}

describe('SocialAccount architecture', () => {
  it('allows creating two accounts on the same platform', async () => {
    const { client, socialAccountService } = await createContext();
    const first = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'Личный',
    });
    const second = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'Компания',
    });
    expect(first.id).not.toBe(second.id);
    client.close();
  });

  it('lists both accounts by platform', async () => {
    const { client, socialAccountService } = await createContext();
    await socialAccountService.createAccount({ platformId: 'instagram', displayName: 'A' });
    await socialAccountService.createAccount({ platformId: 'instagram', displayName: 'B' });
    const accounts = await socialAccountService.listAccountsByPlatform('instagram');
    expect(accounts).toHaveLength(2);
    client.close();
  });

  it('does not list inactive accounts in default selectable list', async () => {
    const { client, socialAccountService } = await createContext();
    const account = await socialAccountService.createAccount({
      platformId: 'telegram',
      displayName: 'Канал',
    });
    await socialAccountService.setAccountActive(account.id, false);
    const selectable = await socialAccountService.listSelectableAccountsByPlatform('telegram');
    expect(selectable).toHaveLength(0);
    client.close();
  });

  it('stores socialAccountId on publication', async () => {
    const { client, db, socialAccountService, publicationService } = await createContext();
    const account = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'Компания',
    });
    const item = await db.content.createItem({ title: 'Post' }, [
      createBlock('text', 0, { text: 'Body' }),
    ]);
    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram', socialAccountId: account.id }],
    });
    expect(prepared.publications[0]?.socialAccountId).toBe(account.id);
    client.close();
  });

  it('supports one batch with two instagram account targets', async () => {
    const { client, db, socialAccountService, publicationService } = await createContext();
    const accountA = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'A',
    });
    const accountB = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'B',
    });
    const item = await db.content.createItem({ title: 'Post' }, [
      createBlock('text', 0, { text: 'Body' }),
    ]);
    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [
        { platformId: 'instagram', socialAccountId: accountA.id },
        { platformId: 'instagram', socialAccountId: accountB.id },
      ],
    });
    expect(prepared.publications).toHaveLength(2);
    client.close();
  });

  it('prevents duplicate exact account targets in workspace helpers', async () => {
    let targets = addPlatformTarget([], 'instagram', 'acc-1');
    targets = addPlatformTarget(targets, 'instagram', 'acc-1');
    expect(targets).toHaveLength(1);
  });

  it('keeps platform-only target working', async () => {
    const { client, db, publicationService } = await createContext();
    const item = await db.content.createItem({ title: 'Post' }, [
      createBlock('text', 0, { text: 'Body' }),
    ]);
    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'vk' }],
    });
    expect(prepared.publications[0]?.socialAccountId).toBeNull();
    client.close();
  });

  it('migrates legacy workspace platform tabs', async () => {
    const normalized = normalizeWorkspaceState({
      activeTabId: 'platform-vk',
      openPlatformTabs: ['instagram', 'vk'],
      currentContentItemId: 'item-1',
      sidebarSection: 'editor',
    });
    expect(normalized.openPlatformTargets.map((target) => target.platformId)).toEqual([
      'instagram',
      'vk',
    ]);
  });

  it('persists account-specific targets in workspace state shape', async () => {
    const targets = [
      createPlatformTarget('instagram', 'acc-a'),
      createPlatformTarget('telegram', 'acc-c'),
    ];
    const normalized = normalizeWorkspaceState({
      activeTabId: 'platform-instagram',
      openPlatformTargets: targets,
      currentContentItemId: 'item-1',
      sidebarSection: 'editor',
    });
    expect(normalized.openPlatformTargets[0]?.socialAccountId).toBe('acc-a');
    expect(normalized.openPlatformTargets[1]?.platformId).toBe('telegram');
  });

  it('keeps deleted account available for publication history lookup', async () => {
    const { client, db, socialAccountService, publicationService } = await createContext();
    const account = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'Компания',
    });
    const item = await db.content.createItem({ title: 'Post' }, [
      createBlock('text', 0, { text: 'Body' }),
    ]);
    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram', socialAccountId: account.id }],
    });
    await socialAccountService.removeAccount(account.id);
    const stored = await db.publications.getById(prepared.publications[0]!.id);
    const deletedAccount = await socialAccountService.getAccount(account.id);
    expect(stored?.socialAccountId).toBe(account.id);
    expect(deletedAccount?.deletedAt).toBeTruthy();
    client.close();
  });

  it('applies migration v4 on top of v3 database', async () => {
    const client = new MemoryDatabaseClient();
    await runMigrations(client);

    const v1ToV3 = MIGRATIONS.filter((migration) => migration.version <= 3);
    const freshClient = new MemoryDatabaseClient();
    await freshClient.execute(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
    for (const migration of v1ToV3) {
      await freshClient.batch([
        { sql: migration.up },
        {
          sql: 'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          params: [migration.version, migration.name, new Date().toISOString()],
        },
      ]);
    }

    await runMigrations(freshClient);
    const columns = await freshClient.select<{ name: string }>(`PRAGMA table_info(social_accounts)`);
    const names = columns.rows.map((row) => row.name);
    expect(names).toContain('handle');
    expect(names).toContain('connection_state');
    expect(names).toContain('deleted_at');
    freshClient.close();
    client.close();
  });

  it('passes preview account context with displayName and handle', async () => {
    const context = toPreviewAccountContext({
      id: 'acc-1',
      platformId: 'telegram',
      displayName: 'Основной канал',
      handle: '@channel',
      isActive: true,
      connectionState: 'local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(context?.displayName).toBe('Основной канал');
    expect(context?.handle).toBe('@channel');
  });
});
