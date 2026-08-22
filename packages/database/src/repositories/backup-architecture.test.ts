import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BackupService,
  PublicationService,
  SocialAccountService,
  FakeTelegramTransport,
  createBlock,
  packBackupArchive,
  parseBackupArchive,
} from '@reizoko/core';
import { BACKUP_FORMAT_VERSION } from '@reizoko/shared';
import { PlatformRegistry } from '@reizoko/platform-sdk';
import { bootstrapDatabase } from '../bootstrap.js';
import { MemoryDatabaseClient } from '../test/memory-database-client.js';
import { SqliteBackupRepository } from './backup-repository.impl.js';

function mockAdapter(id: string) {
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
    transform: (blocks: ReturnType<typeof createBlock>[]) => ({
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

async function createFixture() {
  const client = new MemoryDatabaseClient();
  const db = await bootstrapDatabase(client);
  const backupRepo = new SqliteBackupRepository(client);
  const backupService = new BackupService(backupRepo, { appVersion: '0.1.0-test' });
  const registry = new PlatformRegistry();
  registry.register({ adapter: mockAdapter('instagram'), Preview: () => null });
  const publicationService = new PublicationService(
    db.content,
    db.publicationBatches,
    db.publications,
    registry,
    db.socialAccounts,
    db.platformConnections,
    new FakeTelegramTransport(),
  );
  const socialAccountService = new SocialAccountService(db.socialAccounts, () => true);
  const mediaDir = await mkdtemp(join(tmpdir(), 'reizoko-backup-test-'));
  return { client, db, backupRepo, backupService, publicationService, socialAccountService, mediaDir };
}

async function writeMedia(mediaDir: string, filename: string, content: string) {
  const path = join(mediaDir, filename);
  await writeFile(path, content);
  return path;
}

describe('Backup architecture', () => {
  it('preserves ContentItem IDs through serialize/deserialize', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    const item = await db.content.createItem({ title: 'Backup Item' }, [
      createBlock('text', 0, { text: 'Body' }),
    ]);
    const snapshot = await new SqliteBackupRepository(client).exportSnapshot();
    expect(snapshot.contentItems[0]?.id).toBe(item.id);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
    void backupService;
  });

  it('preserves revisions and currentRevisionId', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    const item = await db.content.createItem({ title: 'Revision Item' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);
    await db.content.createManualCheckpoint(item.id);
    const snapshot = await new SqliteBackupRepository(client).exportSnapshot();
    expect(snapshot.contentRevisions.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.contentItems[0]?.currentRevisionId).toBeTruthy();
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
    void backupService;
  });

  it('preserves publication batch and publication relationships', async () => {
    const { client, db, backupService, publicationService, socialAccountService, mediaDir } =
      await createFixture();
    const account = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'Brand',
    });
    const item = await db.content.createItem({ title: 'Pub Item' }, [
      createBlock('text', 0, { text: 'Publish me' }),
    ]);
    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram', socialAccountId: account.id }],
    });
    const snapshot = await new SqliteBackupRepository(client).exportSnapshot();
    expect(snapshot.publicationBatches[0]?.id).toBe(prepared.batch.id);
    expect(snapshot.publications[0]?.socialAccountId).toBe(account.id);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
    void backupService;
  });

  it('preserves social account relationships', async () => {
    const { client, socialAccountService, mediaDir } = await createFixture();
    const account = await socialAccountService.createAccount({
      platformId: 'instagram',
      displayName: 'Company',
      handle: '@brand',
    });
    const snapshot = await new SqliteBackupRepository(client).exportSnapshot();
    expect(snapshot.socialAccounts[0]?.id).toBe(account.id);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('preserves working/checkpoint revision semantics', async () => {
    const { client, db, mediaDir } = await createFixture();
    const item = await db.content.createItem({ title: 'Kinds' }, [
      createBlock('text', 0, { text: 'A' }),
    ]);
    await db.content.createManualCheckpoint(item.id);
    const snapshot = await new SqliteBackupRepository(client).exportSnapshot();
    const kinds = new Set(snapshot.contentRevisions.map((revision) => revision.kind));
    expect(kinds.has('working')).toBe(true);
    expect(kinds.has('checkpoint')).toBe(true);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('validates SHA-256 checksum for correct media file', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    const mediaPath = await writeMedia(mediaDir, 'photo.png', 'image-bytes');
    await db.media.create({
      id: 'media-1',
      filename: 'photo.png',
      mimeType: 'image/png',
      size: 11,
      localPath: mediaPath,
    });
    const result = await backupService.createBackup({
      readFile: async (path) => new Uint8Array(await readFile(path)),
    });
    const validation = await backupService.validateBackup(result.archive);
    expect(validation.valid).toBe(true);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('detects corrupted media file checksum', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    const mediaPath = await writeMedia(mediaDir, 'photo.png', 'image-bytes');
    await db.media.create({
      id: 'media-1',
      filename: 'photo.png',
      mimeType: 'image/png',
      size: 11,
      localPath: mediaPath,
    });
    const result = await backupService.createBackup({
      readFile: async (path) => new Uint8Array(await readFile(path)),
    });
    const parsed = parseBackupArchive(result.archive);
    const entry = parsed.manifest.mediaFiles[0]!;
    const corrupted = new Uint8Array([1, 2, 3]);
    parsed.mediaFiles.set(entry.archivePath, corrupted);
    const archive = packBackupArchive(parsed.manifest, parsed.data, parsed.mediaFiles);
    const validation = await backupService.validateBackup(archive);
    expect(validation.valid).toBe(false);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('blocks restore when manifest is corrupted', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    await db.content.createItem({ title: 'X' }, [createBlock('text', 0, { text: 'x' })]);
    const created = await backupService.createBackup({ readFile: async () => null });
    const parsed = parseBackupArchive(created.archive);
    parsed.manifest.formatVersion = 999;
    const archive = packBackupArchive(parsed.manifest, parsed.data, parsed.mediaFiles);
    const validation = await backupService.validateBackup(archive);
    expect(validation.valid).toBe(false);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('blocks restore on broken foreign reference', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    await db.content.createItem({ title: 'Broken' }, [createBlock('text', 0, { text: 'x' })]);
    const created = await backupService.createBackup({ readFile: async () => null });
    const parsed = parseBackupArchive(created.archive);
    parsed.data.publications = [
      {
        id: 'pub-broken',
        batchId: 'missing-batch',
        contentRevisionId: parsed.data.contentRevisions[0]!.id,
        socialAccountId: null,
        platformId: 'instagram',
        status: 'draft',
        preparedSnapshot: {
          formatVersion: 1,
          platformId: 'instagram',
          transformedContent: { text: '', images: [], warnings: [] },
          validationIssues: [],
          preparedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const archive = packBackupArchive(parsed.manifest, parsed.data, parsed.mediaFiles);
    const validation = await backupService.validateBackup(archive);
    expect(validation.valid).toBe(false);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('returns controlled error for unknown backup formatVersion', async () => {
    const { client, backupService, mediaDir } = await createFixture();
    const created = await backupService.createBackup({ readFile: async () => null });
    const parsed = parseBackupArchive(created.archive);
    parsed.manifest.formatVersion = BACKUP_FORMAT_VERSION + 10;
    const archive = packBackupArchive(parsed.manifest, parsed.data, parsed.mediaFiles);
    const validation = await backupService.validateBackup(archive);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.includes('версия'))).toBe(true);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('restores workspace state', async () => {
    const { client, db, backupRepo, backupService, mediaDir } = await createFixture();
    await db.workspace.saveState({
      activeTabId: 'editor',
      openPlatformTargets: [],
      currentContentItemId: null,
      sidebarSection: 'library',
    });
    const created = await backupService.createBackup({ readFile: async () => null });
    await db.workspace.saveState({
      activeTabId: 'editor',
      openPlatformTargets: [],
      currentContentItemId: null,
      sidebarSection: 'settings',
    });
    const parsed = parseBackupArchive(created.archive);
    await backupService.restoreValidatedBackup(parsed, {
      writeFile: async (_id, filename) => join(mediaDir, filename),
    });
    const workspace = await db.workspace.getState();
    expect(workspace.sidebarSection).toBe('library');
    void backupRepo;
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('restores app settings', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    await db.settings.set('appearance.themeMode', 'dark');
    const created = await backupService.createBackup({ readFile: async () => null });
    await db.settings.set('appearance.themeMode', 'light');
    const parsed = parseBackupArchive(created.archive);
    await backupService.restoreValidatedBackup(parsed, {
      writeFile: async (_id, filename) => join(mediaDir, filename),
    });
    const theme = await db.settings.get('appearance.themeMode', 'system');
    expect(theme).toBe('dark');
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('excludes smoke infrastructure media from backup data', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    await db.media.create({
      id: 'smoke-media',
      filename: 'smoke.png',
      mimeType: 'image/png',
      size: 1,
      localPath: 'C:/AppData/com.reizoko.app/media-smoke/smoke.png',
    });
    const created = await backupService.createBackup({ readFile: async () => null });
    const parsed = parseBackupArchive(created.archive);
    expect(parsed.data.mediaItems.some((item) => item.id === 'smoke-media')).toBe(false);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('restores original UUIDs', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    const item = await db.content.createItem({ title: 'UUID' }, [
      createBlock('text', 0, { text: 'uuid' }),
    ]);
    const created = await backupService.createBackup({ readFile: async () => null });
    await db.content.createItem({ title: 'Other' }, [createBlock('text', 0, { text: 'other' })]);
    const parsed = parseBackupArchive(created.archive);
    await backupService.restoreValidatedBackup(parsed, {
      writeFile: async (_id, filename) => join(mediaDir, filename),
    });
    const restored = await db.content.getItem(item.id);
    expect(restored?.id).toBe(item.id);
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('serializes JSON export correctly', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    await db.content.createItem({ title: 'Export' }, [createBlock('text', 0, { text: 'export' })]);
    const exported = await backupService.exportJson();
    const parsed = JSON.parse(exported.json) as { data: { contentItems: Array<{ metadata: { title: string } }> } };
    expect(parsed.data.contentItems[0]?.metadata.title).toBe('Export');
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });

  it('creates safety backup before destructive restore', async () => {
    const { client, db, backupService, mediaDir } = await createFixture();
    const safetyDir = join(mediaDir, 'safety');
    await mkdir(safetyDir, { recursive: true });
    const item = await db.content.createItem({ title: 'Safety' }, [
      createBlock('text', 0, { text: 'before' }),
    ]);
    const created = await backupService.createBackup({ readFile: async () => null });
    await db.content.saveWorking(item.id, { title: 'Changed' }, [
      createBlock('text', 0, { text: 'after' }),
    ]);
    let safetyCreated = false;
    await backupService.restoreBackup(
      created.archive,
      { readFile: async () => null },
      {
        writeFile: async (_id, filename) => join(mediaDir, filename),
      },
      {
        createSafetyBackup: async (archive) => {
          safetyCreated = true;
          await writeFile(join(safetyDir, 'safety.reizoko-backup'), archive);
        },
      },
    );
    expect(safetyCreated).toBe(true);
    const restored = await db.content.getItem(item.id);
    expect(restored?.metadata.title).toBe('Safety');
    client.close();
    await rm(mediaDir, { recursive: true, force: true });
  });
});
