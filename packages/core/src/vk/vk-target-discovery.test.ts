import { describe, expect, it } from 'vitest';
import {
  generateId,
  nowIso,
  type CreateSocialAccountInput,
  type PlatformConnection,
  type SocialAccount,
  type UpdateSocialAccountInput,
} from '@reizoko/shared';

import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';
import type { SocialAccountRepository } from '../social-account/social-account-repository.js';
import { FakeVkTransport } from './fake-vk-transport.js';
import { VkConnectionService } from './vk-connection-service.js';
import { discoverVkPublicationTargets, resolveVkTargetEmptyState } from './vk-target-discovery.js';
import { VkTransportError } from './vk-api-errors.js';

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

class MemorySocialAccountRepository implements SocialAccountRepository {
  private readonly rows = new Map<string, SocialAccount>();
  async create(input: CreateSocialAccountInput) {
    const now = nowIso();
    const account: SocialAccount = {
      id: generateId(),
      platformId: input.platformId,
      displayName: input.displayName,
      handle: input.handle ?? null,
      externalAccountId: input.externalAccountId ?? null,
      avatarMediaId: input.avatarMediaId ?? null,
      connectionId: input.connectionId ?? null,
      platformMetadataJson: input.platformMetadataJson ?? null,
      isActive: true,
      connectionState: input.connectionId ? 'connected' : 'local',
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(account.id, account);
    return account;
  }
  async getById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async listAll() {
    return [...this.rows.values()];
  }
  async listByPlatform(platformId: string) {
    return [...this.rows.values()].filter((a) => a.platformId === platformId);
  }
  async update(id: string, input: UpdateSocialAccountInput) {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('missing');
    const updated = { ...existing, ...input, updatedAt: nowIso() } as SocialAccount;
    this.rows.set(id, updated);
    return updated;
  }
  async setActive(id: string, isActive: boolean) {
    const existing = this.rows.get(id);
    if (!existing) throw new Error('missing');
    const updated = { ...existing, isActive, updatedAt: nowIso() };
    this.rows.set(id, updated);
    return updated;
  }
  async softDelete(id: string) {
    return this.update(id, { connectionState: 'local' });
  }
  async isReferencedByPublications() {
    return false;
  }
  async listByConnectionId(connectionId: string) {
    return [...this.rows.values()].filter((a) => a.connectionId === connectionId);
  }
  async clearConnectionForAccounts(connectionId: string) {
    for (const account of this.rows.values()) {
      if (account.connectionId === connectionId) {
        this.rows.set(account.id, { ...account, connectionState: 'needs_reconnect', updatedAt: nowIso() });
      }
    }
  }
}

describe('vk target discovery', () => {
  it('returns self wall even when groups.get fails with permission error', async () => {
    const transport = new FakeVkTransport();
    const connections = new MemoryPlatformConnectionRepository();
    const service = new VkConnectionService(connections, new MemorySocialAccountRepository(), transport);

    const { connection } = await service.connectOAuth(
      {
        appId: 'app',
        serverBaseUrl: 'https://zasian.ru',
        redirectUri: 'https://zasian.ru/vk-callback.php',
      },
      ['wall', 'photos', 'groups'],
    );

    transport.listManageableCommunities = async (secretRef) => {
      await transport.hasSecret(secretRef);
      throw new VkTransportError('VK_API:5:User authorization failed', 'vk_api', 'permission', false, true);
    };

    const discovery = await discoverVkPublicationTargets(connection, transport);
    expect(discovery.discoveryState).toBe('partial');
    expect(discovery.targets.some((target) => target.targetType === 'self_wall')).toBe(true);
    expect(discovery.groups.status).toBe('failed');
    expect(discovery.groups.vkErrorCode).toBe(5);
    expect(discovery.fatalError).toBeUndefined();
    expect(discovery.notices[0]).toContain('не получил разрешение');
  });

  it('distinguishes all connected from discovery failed', () => {
    const selfTarget = {
      targetType: 'self_wall' as const,
      ownerId: 1001,
      displayName: 'Иван Иванов',
      destinationKindLabel: 'Моя страница',
      canPost: true,
    };

    const allConnected = resolveVkTargetEmptyState({
      targets: [selfTarget],
      existingOwnerIds: ['1001'],
      discovery: null,
    });
    expect(allConnected.emptyReason).toBe('ALL_TARGETS_ALREADY_CONNECTED');

    const discoveryFailed = resolveVkTargetEmptyState({
      targets: [selfTarget],
      existingOwnerIds: ['1001'],
      discovery: {
        targets: [selfTarget],
        discoveryState: 'partial',
        selfWall: { available: true },
        groups: { status: 'failed', count: 0, vkErrorCode: 5 },
        notices: ['Не удалось автоматически получить сообщества. Их можно добавить вручную.'],
        tokenMetadata: {
          userAccessTokenPresent: true,
          refreshTokenPresent: false,
          expiresAt: null,
          tokenSource: 'vk_oauth',
        },
      },
    });
    expect(discoveryFailed.emptyReason).toBe('ALL_TARGETS_ALREADY_CONNECTED');
  });
});
