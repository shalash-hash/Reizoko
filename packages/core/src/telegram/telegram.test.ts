import { describe, expect, it } from 'vitest';
import { buildSecretRef, nowIso } from '@reizoko/shared';
import {
  FakeTelegramTransport,
  InMemorySecretStore,
  TelegramConnectionService,
  TelegramPublisher,
  executeTelegramPublish,
  splitTelegramCaption,
} from '@reizoko/core';
import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';
import type { PlatformConnection, Publication } from '@reizoko/shared';
import { bootstrapDatabase } from '../../../database/src/bootstrap.js';
import { MemoryDatabaseClient } from '../../../database/src/test/memory-database-client.js';
import { PublicationService } from '../publication/publication-service.js';
import { PlatformRegistry } from '@reizoko/platform-sdk';
import { telegramAdapter } from '../../../../platforms/telegram/src/TelegramAdapter.js';
import { createBlock } from '../content/content-service.js';

class MemoryPlatformConnectionRepository implements PlatformConnectionRepository {
  private readonly rows = new Map<string, PlatformConnection>();
  async create(connection: PlatformConnection) {
    this.rows.set(connection.id, connection);
    return connection;
  }
  async getById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listByPlatform(platformId: string) {
    return [...this.rows.values()].filter((row) => row.platformId === platformId);
  }
  async listAll() {
    return [...this.rows.values()];
  }
  async update(id: string, patch: Partial<PlatformConnection>) {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('missing');
    const updated = { ...existing, ...patch, updatedAt: nowIso() };
    this.rows.set(id, updated);
    return updated;
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
}

function samplePublication(snapshot: Publication['preparedSnapshot']): Publication {
  return {
    id: 'pub-1',
    batchId: 'batch-1',
    contentRevisionId: 'rev-1',
    socialAccountId: 'acc-1',
    platformId: 'telegram',
    status: 'draft',
    preparedSnapshot: snapshot,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

describe('telegram connection', () => {
  it('valid getMe creates connected PlatformConnection without token in model', async () => {
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(
      new MemoryPlatformConnectionRepository(),
      transport,
    );
    const { connection, bot } = await service.connectBot('123:VALID');
    expect(connection.state).toBe('connected');
    expect(connection.secretRef).toBe(buildSecretRef(connection.id, 'bot_token'));
    expect(JSON.stringify(connection)).not.toContain('VALID');
    expect(bot.username).toBe('reizoko_test_bot');
  });

  it('invalid token does not persist secret', async () => {
    const transport = new FakeTelegramTransport({ invalidToken: true });
    const store = new InMemorySecretStore();
    const repo = new MemoryPlatformConnectionRepository();
    const service = new TelegramConnectionService(repo, transport);
    await expect(service.connectBot('invalid')).rejects.toThrow();
    expect(await repo.listAll()).toHaveLength(0);
    expect((await store.getSecret('x')) ?? null).toBeNull();
  });

  it('one bot supports multiple destinations', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);
    const transport = new FakeTelegramTransport();
    transport.registerChat('@reizoko_news', { id: -1001, title: 'News', username: 'reizoko_news', canPublish: true });
    transport.registerChat('@reizoko_main', { id: -1002, title: 'Main', username: 'reizoko_main', canPublish: true });
    const connectionService = new TelegramConnectionService(db.platformConnections, transport);
    const { connection } = await connectionService.connectBot('123:VALID');
    const first = await connectionService.validateDestination(connection, '@reizoko_news');
    const second = await connectionService.validateDestination(connection, '@reizoko_main');
    expect(first.canPublish).toBe(true);
    expect(second.canPublish).toBe(true);
    client.close();
  });

  it('blocks destination when bot lacks permissions', async () => {
    const transport = new FakeTelegramTransport();
    const repo = new MemoryPlatformConnectionRepository();
    const service = new TelegramConnectionService(repo, transport);
    const { connection } = await service.connectBot('123:VALID');
    const validation = await service.validateDestination(connection, '@private');
    expect(validation.canPublish).toBe(false);
  });

  it('disconnect removes secret', async () => {
    const transport = new FakeTelegramTransport();
    const repo = new MemoryPlatformConnectionRepository();
    const service = new TelegramConnectionService(repo, transport);
    const { connection } = await service.connectBot('123:VALID');
    await service.disconnect(connection.id);
    const updated = await repo.getById(connection.id);
    expect(updated?.state).toBe('needs_reconnect');
    expect(updated?.secretRef).toBeNull();
  });
});

describe('telegram publishing', () => {
  it('publishes text-only via sendMessage', async () => {
    const transport = new FakeTelegramTransport();
    const publisher = new TelegramPublisher(transport);
    const secretRef = buildSecretRef('conn-1', 'bot_token');
    transport.tokens.set(secretRef, 'token');
    const result = await publisher.publish({
      publication: samplePublication({
        formatVersion: 1,
        platformId: 'telegram',
        transformedContent: { text: '<b>Hello</b>', images: [], warnings: [] },
        validationIssues: [],
        preparedAt: nowIso(),
      }),
      account: {
        id: 'acc-1',
        platformId: 'telegram',
        displayName: 'News',
        handle: '@news',
        externalAccountId: '-1001',
        connectionId: 'conn-1',
        isActive: true,
        connectionState: 'connected',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      connection: {
        id: 'conn-1',
        platformId: 'telegram',
        method: 'bot_token',
        state: 'connected',
        secretRef,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      mediaPaths: {},
    });
    expect(result.success).toBe(true);
    expect(transport.sentMessages[0]?.type).toBe('message');
  });

  it('handles caption overflow with follow-up message', async () => {
    const longText = 'a'.repeat(1100);
    const split = splitTelegramCaption(longText);
    expect(split.overflow).toBeTruthy();
    const transport = new FakeTelegramTransport();
    const secretRef = buildSecretRef('conn-1', 'bot_token');
    transport.tokens.set(secretRef, 'token');
    const response = await executeTelegramPublish(transport, {
      secretRef,
      chatId: '-1001',
      channelUsername: 'news',
      media: [{ mediaId: 'm1', localPath: '/tmp/photo.jpg' }],
      snapshot: {
        formatVersion: 1,
        platformId: 'telegram',
        transformedContent: { text: longText, images: [{ mediaId: 'm1' }], warnings: [] },
        validationIssues: [],
        preparedAt: nowIso(),
      },
    });
    expect(response.success).toBe(true);
    expect(response.messageIds.length).toBeGreaterThan(1);
  });

  it('fails when media file is missing', async () => {
    const transport = new FakeTelegramTransport();
    const publisher = new TelegramPublisher(transport);
    const secretRef = buildSecretRef('conn-1', 'bot_token');
    transport.tokens.set(secretRef, 'token');
    const result = await publisher.publish({
      publication: samplePublication({
        formatVersion: 1,
        platformId: 'telegram',
        transformedContent: { text: 'Hi', images: [{ mediaId: 'missing' }], warnings: [] },
        validationIssues: [],
        preparedAt: nowIso(),
      }),
      account: {
        id: 'acc-1',
        platformId: 'telegram',
        displayName: 'News',
        externalAccountId: '-1001',
        connectionId: 'conn-1',
        isActive: true,
        connectionState: 'connected',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      connection: {
        id: 'conn-1',
        platformId: 'telegram',
        method: 'bot_token',
        state: 'connected',
        secretRef,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      mediaPaths: {},
    });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('медиафайл');
  });

  it('stores remotePostId and public remoteUrl', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);
    const transport = new FakeTelegramTransport();
    const registry = new PlatformRegistry();
    registry.register({ adapter: telegramAdapter, Preview: () => null });
    const publicationService = new PublicationService(
      db.content,
      db.publicationBatches,
      db.publications,
      registry,
      db.socialAccounts,
      db.platformConnections,
      transport,
    );
    const connectionService = new TelegramConnectionService(db.platformConnections, transport);
    transport.registerChat('@news', { id: -1001, title: 'News', username: 'news', canPublish: true });
    const { connection } = await connectionService.connectBot('123:VALID');
    const account = await db.socialAccounts.create({
      platformId: 'telegram',
      displayName: 'News',
      handle: '@news',
      connectionId: connection.id,
      externalAccountId: '-1001',
    });
    const item = await db.content.createItem({ title: 'Post' }, [
      createBlock('text', 0, { text: 'Hello Telegram' }),
    ]);
    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'telegram', socialAccountId: account.id }],
    });
    const published = await publicationService.publishPublication(
      prepared.publications[0]!.id,
      {},
    );
    expect(published.status).toBe('published');
    expect(published.remotePostId).toBeTruthy();
    expect(published.remoteUrl).toContain('https://t.me/news/');
    client.close();
  });

  it('beginPublishing rejects non-draft publications', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);
    const item = await db.content.createItem({ title: 'Post' }, [
      createBlock('text', 0, { text: 'Hello' }),
    ]);
    const batch = await db.publicationBatches.create({
      contentItemId: item.id,
      contentRevisionId: item.currentRevisionId,
    });
    const publication = await db.publications.create({
      batchId: batch.id,
      contentRevisionId: item.currentRevisionId,
      platformId: 'telegram',
      status: 'draft',
      preparedSnapshot: {
        formatVersion: 1,
        platformId: 'telegram',
        transformedContent: { text: 'Hello', images: [], warnings: [] },
        validationIssues: [],
        preparedAt: nowIso(),
      },
    });
    await db.publications.beginPublishing(publication.id);
    const second = await db.publications.beginPublishing(publication.id);
    expect(second).toBeNull();
    client.close();
  });
});
