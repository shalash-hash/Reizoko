import { describe, expect, it, vi } from 'vitest';
import { buildSecretRef } from '@reizoko/shared';
import {
  ConnectionSecretMissingError,
  FakeTelegramTransport,
  InMemorySecretStore,
  PlatformConnectionService,
  TelegramConnectionService,
  isConnectionSecretMissingError,
  toUserFacingConnectionError,
} from '@reizoko/core';
import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';
import type { PlatformConnection } from '@reizoko/shared';
import { nowIso } from '@reizoko/shared';

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

describe('telegram connection health', () => {
  it('marks connected row as needs_reconnect when secret is missing', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-1';
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

    const healed = await service.verifyConnectionHealth(await repo.getById(connectionId)!);
    expect(healed.state).toBe('needs_reconnect');
    expect(healed.secretRef).toBe(secretRef);
    expect(healed.errorCode).toBe('secret_missing');
  });

  it('keeps connected row when secret exists', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-2';
    const secretRef = buildSecretRef(connectionId, 'bot_token');
    transport.tokens.set(secretRef, '123:TOKEN');

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

    const healed = await service.verifyConnectionHealth(await repo.getById(connectionId)!);
    expect(healed.state).toBe('connected');
    expect(healed.secretRef).toBe(secretRef);
  });

  it('throws controlled error when destination validation has no secret', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-3';
    const secretRef = buildSecretRef(connectionId, 'bot_token');

    const connection = await repo.create({
      id: connectionId,
      platformId: 'telegram',
      method: 'bot_token',
      state: 'connected',
      externalIdentityId: '123',
      secretRef,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await expect(service.validateDestination(connection, '@channel')).rejects.toBeInstanceOf(
      ConnectionSecretMissingError,
    );
  });

  it('reconnects same bot on existing connection id', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-4';

    const first = await service.connectBot('123:VALID', connectionId);
    await transport.deleteSecret(first.connection.secretRef!);
    await repo.update(connectionId, { state: 'needs_reconnect', errorCode: 'secret_missing' });

    const restored = await service.connectBot('123:VALID', connectionId);
    expect(restored.connection.id).toBe(connectionId);
    expect(restored.connection.state).toBe('connected');
    expect(await transport.hasSecret(buildSecretRef(connectionId, 'bot_token'))).toBe(true);
  });

  it('rejects reconnect with different bot identity', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-5';

    await service.connectBot('123:VALID', connectionId);
    transport.tokens.clear();

    await expect(service.connectBot('456:OTHER', connectionId)).rejects.toThrow(/другой бот/i);
  });

  it('keeps connectionId stable across connect flow', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-stable';

    const result = await service.connectBot('123:VALID', connectionId);
    expect(result.connection.id).toBe(connectionId);
    expect(result.connection.secretRef).toBe(buildSecretRef(connectionId, 'bot_token'));
  });

  it('does not persist connected state when post-connect secret verification fails', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-no-persist';
    const secretRef = buildSecretRef(connectionId, 'bot_token');
    const hasSecretSpy = vi
      .spyOn(transport, 'hasSecret')
      .mockResolvedValueOnce(false)
      .mockResolvedValue(false);

    await expect(service.connectBot('123:VALID', connectionId)).rejects.toThrow(
      'SECRET_STORE_VERIFY_FAILED',
    );
    expect(await repo.getById(connectionId)).toBeNull();
    expect(await transport.hasSecret(secretRef)).toBe(false);
    hasSecretSpy.mockRestore();
  });

  it('cleans up secret when post-connect verification fails', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const transport = new FakeTelegramTransport();
    const service = new TelegramConnectionService(repo, transport);
    const connectionId = 'conn-health-cleanup';
    const secretRef = buildSecretRef(connectionId, 'bot_token');
    const deleteSpy = vi.spyOn(transport, 'deleteSecret');
    vi.spyOn(transport, 'hasSecret').mockResolvedValue(false);

    await expect(service.connectBot('123:VALID', connectionId)).rejects.toThrow(
      'SECRET_STORE_VERIFY_FAILED',
    );
    expect(deleteSpy).toHaveBeenCalledWith(secretRef);
    deleteSpy.mockRestore();
  });

  it('does not expose bot token text in user-facing errors', async () => {
    const secretToken = '123456789:SUPER_SECRET_BOT_TOKEN';
    const message = toUserFacingConnectionError(new Error('SECRET_STORE_VERIFY_FAILED'));
    expect(message).not.toContain(secretToken);
    expect(message).not.toContain('123456789');
  });
});

describe('connection error mapping', () => {
  it('maps raw secure storage errors to user-facing reconnect message', () => {
    const message = toUserFacingConnectionError(new Error('No matching entry found in secure storage'));
    expect(message).toContain('повторного входа');
    expect(message).not.toContain('secure storage');
  });

  it('maps secret store verify failure to user-facing Windows message', () => {
    const message = toUserFacingConnectionError(new Error('SECRET_STORE_VERIFY_FAILED'));
    expect(message).toContain('защищённом хранилище Windows');
    expect(message).not.toContain('SECRET_STORE_VERIFY_FAILED');
  });

  it('maps telegram unauthorized to botfather guidance', () => {
    const message = toUserFacingConnectionError(new Error('TELEGRAM_UNAUTHORIZED'));
    expect(message).toContain('BotFather');
    expect(message).not.toContain('TELEGRAM_UNAUTHORIZED');
  });

  it('detects secret missing errors without exposing token text', () => {
    expect(isConnectionSecretMissingError(new ConnectionSecretMissingError())).toBe(true);
    expect(isConnectionSecretMissingError(new Error('SECRET_MISSING'))).toBe(true);
  });
});

describe('PlatformConnectionService secret verification', () => {
  it('fails storeSecret when credential cannot be verified', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const store = new InMemorySecretStore();
    const service = new PlatformConnectionService(repo, store);
    const hasSecretSpy = vi.spyOn(store, 'hasSecret').mockResolvedValue(false);

    await expect(service.storeSecret('conn-1', 'bot_token', '123:TOKEN')).rejects.toThrow(
      'SECRET_STORE_VERIFY_FAILED',
    );
    hasSecretSpy.mockRestore();
  });
});
