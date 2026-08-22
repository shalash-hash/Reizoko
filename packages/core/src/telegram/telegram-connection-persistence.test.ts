import { describe, expect, it, vi } from 'vitest';
import { buildSecretRef, nowIso } from '@reizoko/shared';
import {
  FakeTelegramTransport,
  TelegramConnectionService,
  TelegramPublisher,
  TelegramTransportError,
  executeTelegramPublish,
} from '@reizoko/core';
import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';
import type { PlatformConnection, Publication, SocialAccount } from '@reizoko/shared';

class MemoryPlatformConnectionRepository implements PlatformConnectionRepository {
  private readonly rows = new Map<string, PlatformConnection>();

  async create(connection: PlatformConnection): Promise<PlatformConnection> {
    this.rows.set(connection.id, connection);
    return connection;
  }

  async update(id: string, patch: Partial<PlatformConnection>): Promise<PlatformConnection> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Connection ${id} not found`);
    const updated = { ...existing, ...patch, updatedAt: nowIso() };
    this.rows.set(id, updated);
    return updated;
  }

  async getById(id: string): Promise<PlatformConnection | null> {
    return this.rows.get(id) ?? null;
  }

  async listAll(): Promise<PlatformConnection[]> {
    return [...this.rows.values()];
  }

  async listByPlatform(): Promise<PlatformConnection[]> {
    return this.listAll();
  }
}

function createServicePair() {
  const repo = new MemoryPlatformConnectionRepository();
  const transport = new FakeTelegramTransport();
  const service = new TelegramConnectionService(repo, transport);
  return { repo, transport, service };
}

describe('telegram credential persistence', () => {
  it('stores secret after connect', async () => {
    const { service, transport } = createServicePair();
    const { connection } = await service.connectBot('123:VALID', 'conn-persist-1');
    expect(await transport.hasSecret(connection.secretRef!)).toBe(true);
  });

  it('keeps secret after simulated app restart', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const firstSession = new TelegramConnectionService(repo, transport);
    const { connection } = await firstSession.connectBot('123:VALID', 'conn-persist-2');

    const restarted = new TelegramConnectionService(repo, transport);
    const healed = await restarted.verifyConnectionHealth(connection);
    expect(healed.state).toBe('connected');
    expect(await transport.hasSecret(connection.secretRef!)).toBe(true);
  });

  it('keeps connectionId stable across reload', async () => {
    const connectionId = 'conn-persist-stable';
    const { service } = createServicePair();
    const { connection } = await service.connectBot('123:VALID', connectionId);
    expect(connection.id).toBe(connectionId);
    expect(connection.secretRef).toBe(buildSecretRef(connectionId, 'bot_token'));
  });

  it('keeps secret when destination validation fails', async () => {
    const { service, transport } = createServicePair();
    const { connection } = await service.connectBot('123:VALID', 'conn-persist-3');
    const secretRef = connection.secretRef!;

    await expect(service.validateDestination(connection, '@missing_channel')).resolves.toMatchObject({
      canPublish: false,
    });
    expect(await transport.hasSecret(secretRef)).toBe(true);
  });

  it('keeps secret when publish hits a network-class transport error', async () => {
    const { service, transport } = createServicePair();
    const { connection } = await service.connectBot('123:VALID', 'conn-persist-4');
    const secretRef = connection.secretRef!;
    transport.registerChat('@channel', {
      id: -1001,
      title: 'Channel',
      username: 'channel',
      canPublish: true,
    });
    transport.tokens.set(secretRef, '123:VALID');

    const sendSpy = vi
      .spyOn(transport, 'sendMessage')
      .mockRejectedValue(new TelegramTransportError('TELEGRAM_NETWORK:connect', 'network', null, false));

    const response = await executeTelegramPublish(transport, {
      secretRef,
      chatId: '-1001',
      snapshot: {
        validationIssues: [],
        transformedContent: {
          text: 'hello',
          images: [],
          links: [],
        },
      },
      media: [],
      channelUsername: 'channel',
    });

    expect(response.success).toBe(false);
    expect(await transport.hasSecret(secretRef)).toBe(true);
    sendSpy.mockRestore();
  });

  it('keeps secret when publication fails for non-auth reasons', async () => {
    const { service, transport } = createServicePair();
    const { connection } = await service.connectBot('123:VALID', 'conn-persist-5');
    const secretRef = connection.secretRef!;
    const publisher = new TelegramPublisher(transport);

    const result = await publisher.publish({
      publication: {
        id: 'pub-1',
        batchId: 'batch-1',
        contentRevisionId: 'rev-1',
        socialAccountId: 'acc-1',
        platformId: 'telegram',
        status: 'draft',
        preparedSnapshot: {
          validationIssues: [{ severity: 'error', code: 'x', message: 'blocked' }],
          transformedContent: { text: '', images: [], links: [] },
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } satisfies Publication,
      account: {
        id: 'acc-1',
        platformId: 'telegram',
        displayName: 'Channel',
        handle: '@channel',
        externalAccountId: '-1001',
        connectionId: connection.id,
        connectionState: 'connected',
        isActive: true,
        connectedAt: nowIso(),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } satisfies SocialAccount,
      connection,
      mediaPaths: {},
    });

    expect(result.success).toBe(false);
    expect(await transport.hasSecret(secretRef)).toBe(true);
  });

  it('keeps secret after application close simulation', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const { connection } = await service.connectBot('123:VALID', 'conn-persist-6');
    const secretRef = connection.secretRef!;

    const afterClose = new TelegramConnectionService(repo, transport);
    expect(await afterClose.verifyConnectionHealth(connection)).toMatchObject({ state: 'connected' });
    expect(await transport.hasSecret(secretRef)).toBe(true);
  });

  it('removes secret only on explicit disconnect', async () => {
    const { service, transport } = createServicePair();
    const { connection } = await service.connectBot('123:VALID', 'conn-persist-7');
    const secretRef = connection.secretRef!;

    await service.disconnect(connection.id);
    expect(await transport.hasSecret(secretRef)).toBe(false);
  });

  it('marks missing secret on startup as needs_reconnect but keeps secretRef', async () => {
    const { repo, service, transport } = createServicePair();
    const connectionId = 'conn-persist-8';
    const secretRef = buildSecretRef(connectionId, 'bot_token');
    await repo.create({
      id: connectionId,
      platformId: 'telegram',
      method: 'bot_token',
      state: 'connected',
      externalIdentityId: '123',
      secretRef,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const healed = await service.verifyConnectionHealth((await repo.getById(connectionId))!);
    expect(healed.state).toBe('needs_reconnect');
    expect(healed.secretRef).toBe(secretRef);
    expect(healed.errorCode).toBe('secret_missing');
    expect(await transport.hasSecret(secretRef)).toBe(false);
  });

  it('keeps connected state on startup when secret exists', async () => {
    const { repo, service, transport } = createServicePair();
    const connectionId = 'conn-persist-9';
    const secretRef = buildSecretRef(connectionId, 'bot_token');
    transport.tokens.set(secretRef, '123:VALID');
    await repo.create({
      id: connectionId,
      platformId: 'telegram',
      method: 'bot_token',
      state: 'connected',
      externalIdentityId: '123',
      secretRef,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const healed = await service.verifyConnectionHealth((await repo.getById(connectionId))!);
    expect(healed.state).toBe('connected');
    expect(healed.secretRef).toBe(secretRef);
  });

  it('marks unauthorized without deleting stored secret', async () => {
    const { service, transport } = createServicePair();
    const { connection } = await service.connectBot('123:VALID', 'conn-persist-10');
    const secretRef = connection.secretRef!;

    const updated = await service.markCredentialInvalid(connection.id, 'telegram_unauthorized');
    expect(updated.state).toBe('needs_reconnect');
    expect(updated.secretRef).toBe(secretRef);
    expect(await transport.hasSecret(secretRef)).toBe(true);
  });
});
