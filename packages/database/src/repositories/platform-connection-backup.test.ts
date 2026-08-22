import { describe, expect, it } from 'vitest';
import { buildSecretRef, nowIso } from '@reizoko/shared';
import { InMemorySecretStore, PlatformConnectionService } from '@reizoko/core';
import { bootstrapDatabase } from '../bootstrap.js';
import { MemoryDatabaseClient } from '../test/memory-database-client.js';
import { SqliteBackupRepository } from './backup-repository.impl.js';

describe('platform connection persistence & backup', () => {
  it('stores only secretRef in SQLite, not token values', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);
    const repo = db.platformConnections;
    const store = new InMemorySecretStore();
    const service = new PlatformConnectionService(repo, store);
    const connectionId = 'conn-backup-1';
    const secretRef = await service.storeSecret(connectionId, 'bot_token', '123:SECRET_TOKEN');
    const now = nowIso();

    await repo.create({
      id: connectionId,
      platformId: 'telegram',
      method: 'bot_token',
      state: 'connected',
      secretRef,
      displayName: 'Telegram Bot',
      handle: '@bot',
      createdAt: now,
      updatedAt: now,
    });

    const row = await client.select<{ secret_ref: string | null }>(
      'SELECT secret_ref FROM platform_connections WHERE id = ?',
      [connectionId],
    );
    expect(row.rows[0]?.secret_ref).toBe(buildSecretRef(connectionId, 'bot_token'));
    expect(JSON.stringify(row.rows)).not.toContain('SECRET_TOKEN');

    client.close();
  });

  it('excludes secrets from backup export and restores as needs_reconnect', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);
    const backupRepo = new SqliteBackupRepository(client);
    const repo = db.platformConnections;
    const store = new InMemorySecretStore();
    const service = new PlatformConnectionService(repo, store);
    const connectionId = 'conn-backup-2';
    const now = nowIso();
    const secretRef = await service.storeSecret(connectionId, 'bot_token', 'vk-access-token');

    await repo.create({
      id: connectionId,
      platformId: 'telegram',
      method: 'bot_token',
      state: 'connected',
      secretRef,
      createdAt: now,
      updatedAt: now,
    });

    const destination = await db.socialAccounts.create({
      platformId: 'telegram',
      displayName: 'News',
      connectionId,
      externalAccountId: '-100123',
      handle: '@news',
    });
    await db.socialAccounts.update(destination.id, { connectionState: 'connected' });

    const snapshot = await backupRepo.exportSnapshot();
    const archiveJson = JSON.stringify(snapshot);
    expect(archiveJson).not.toContain('vk-access-token');
    expect(snapshot.platformConnections?.[0]?.secretRef).toBeNull();
    expect(snapshot.platformConnections?.[0]?.state).toBe('needs_reconnect');

    const freshClient = new MemoryDatabaseClient();
    const freshDb = await bootstrapDatabase(freshClient);
    const freshBackup = new SqliteBackupRepository(freshClient);
    await freshBackup.restoreSnapshot(snapshot);

    const restored = await freshDb.platformConnections.getById(connectionId);
    expect(restored?.state).toBe('needs_reconnect');
    expect(restored?.secretRef).toBeNull();

    const restoredAccount = await freshDb.socialAccounts.getById(destination.id);
    expect(restoredAccount?.connectionState).toBe('needs_reconnect');
    expect(restoredAccount?.connectionId).toBe(connectionId);

    client.close();
    freshClient.close();
  });

  it('migrates Stage 1 social accounts without platform_connections rows', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);

    await db.socialAccounts.create({
      platformId: 'instagram',
      displayName: 'Legacy',
    });

    const connections = await db.platformConnections.listAll();
    expect(connections).toHaveLength(0);

    const accounts = await db.socialAccounts.listAll();
    expect(accounts[0]?.connectionState).toBe('local');

    client.close();
  });
});
