import { describe, expect, it } from 'vitest';
import type { PlatformConnection, SocialAccount } from '@reizoko/shared';
import { buildSecretRef } from '@reizoko/shared';
import { getConnectionCapabilities, getDesktopFeasibilityLabel } from './platform-capabilities.js';
import { PlatformConnectionService } from './platform-connection-service.js';
import type { PlatformConnectionRepository } from './platform-connection-repository.js';
import { InMemorySecretStore } from '../security/secret-store.js';

class MemoryPlatformConnectionRepository implements PlatformConnectionRepository {
  private readonly rows = new Map<string, PlatformConnection>();

  async create(connection: PlatformConnection): Promise<PlatformConnection> {
    this.rows.set(connection.id, connection);
    return connection;
  }

  async getById(id: string): Promise<PlatformConnection | null> {
    return this.rows.get(id) ?? null;
  }

  async listByPlatform(platformId: string): Promise<PlatformConnection[]> {
    return [...this.rows.values()].filter((row) => row.platformId === platformId);
  }

  async listAll(): Promise<PlatformConnection[]> {
    return [...this.rows.values()];
  }

  async update(
    id: string,
    patch: Partial<PlatformConnection>,
  ): Promise<PlatformConnection> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('missing');
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

function sampleAccount(connectionId?: string): SocialAccount {
  return {
    id: 'acc-1',
    platformId: 'telegram',
    displayName: 'Test',
    connectionId: connectionId ?? null,
    isActive: true,
    connectionState: connectionId ? 'connected' : 'local',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('platform-connection foundation', () => {
  it('exposes per-platform capabilities including media delivery modes', () => {
    const telegram = getConnectionCapabilities('telegram');
    expect(telegram?.desktopFeasibility).toBe('fully_desktop');
    expect(telegram?.mediaDeliveryModes).toContain('direct_binary');

    const instagram = getConnectionCapabilities('instagram');
    expect(instagram?.requiresPublicMediaUrl).toBe(true);
    expect(getDesktopFeasibilityLabel(instagram!.desktopFeasibility)).toContain('external');
  });

  it('stores secrets only via secretRef, not on PlatformConnection value fields', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const store = new InMemorySecretStore();
    const service = new PlatformConnectionService(repo, store);
    const connectionId = 'conn-1';
    const secretRef = await service.storeSecret(connectionId, 'bot_token', '123:TOKEN');

    const connection: PlatformConnection = {
      id: connectionId,
      platformId: 'telegram',
      method: 'bot_token',
      state: 'connected',
      secretRef,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await repo.create(connection);

    expect(connection.secretRef).toBe(buildSecretRef(connectionId, 'bot_token'));
    expect(JSON.stringify(connection)).not.toContain('123:TOKEN');
  });

  it('resolves account state from connection source of truth', () => {
    const repo = new MemoryPlatformConnectionRepository();
    const service = new PlatformConnectionService(repo, new InMemorySecretStore());
    const account = sampleAccount('conn-1');
    expect(
      service.resolveAccountConnectionState(account, {
        state: 'connected',
        secretRef: buildSecretRef('conn-1', 'bot_token'),
      }),
    ).toBe('connected');
    expect(
      service.resolveAccountConnectionState(account, {
        state: 'needs_reconnect',
        secretRef: null,
      }),
    ).toBe('needs_reconnect');
  });

  it('disconnect clears secret but keeps connection row', async () => {
    const repo = new MemoryPlatformConnectionRepository();
    const store = new InMemorySecretStore();
    const service = new PlatformConnectionService(repo, store);
    const connectionId = 'conn-3';
    const secretRef = await service.storeSecret(connectionId, 'bot_token', 'secret');
    await repo.create({
      id: connectionId,
      platformId: 'telegram',
      method: 'bot_token',
      state: 'connected',
      secretRef,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await service.disconnect(connectionId);
    expect(await store.getSecret(secretRef)).toBeNull();
    const updated = await repo.getById(connectionId);
    expect(updated?.state).toBe('needs_reconnect');
    expect(updated?.secretRef).toBeNull();
  });
});

describe('backup safety', () => {
  it('serializes SocialAccount without token fields', () => {
    const account = sampleAccount();
    const json = JSON.stringify(account);
    expect(json).not.toMatch(/token/i);
    expect(account.connectionState).toBe('local');
  });

  it('PlatformConnection backup shape strips secretRef for export', () => {
    const exported = {
      id: 'conn-1',
      platformId: 'telegram',
      method: 'bot_token',
      state: 'needs_reconnect',
      secretRef: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(exported.secretRef).toBeNull();
    expect(JSON.stringify(exported)).not.toContain('123:');
  });
});
