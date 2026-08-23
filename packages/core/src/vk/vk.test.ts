import { describe, expect, it } from 'vitest';
import {
  communityIdToOwnerId,
  userIdToOwnerId,
  buildVkRemotePostId,
} from './vk-owner-id.js';
import { mapVkApiError } from './vk-api-errors.js';
import { FakeVkTransport } from './fake-vk-transport.js';
import { VkConnectionService } from './vk-connection-service.js';
import { VkPublisher } from './vk-publisher.js';
import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';
import type { SocialAccountRepository } from '../social-account/social-account-repository.js';
import {
  generateId,
  serializeVkPublicationTargetMetadata,
  nowIso,
  type PlatformConnection,
  type SocialAccount,
  type CreateSocialAccountInput,
  type UpdateSocialAccountInput,
  type Publication,
} from '@reizoko/shared';

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

describe('vk owner id mapping', () => {
  it('maps self user to positive owner_id', () => {
    expect(userIdToOwnerId(123)).toBe(123);
  });

  it('maps community to negative owner_id', () => {
    expect(communityIdToOwnerId(456)).toBe(-456);
  });

  it('builds remote post id', () => {
    expect(buildVkRemotePostId(-456, 789)).toBe('wall-456_789');
  });

  it('normalizes club and public aliases', async () => {
    const { normalizeVkWallInput } = await import('./vk-wall-input.js');
    expect(normalizeVkWallInput('club123456')).toBe('123456');
    expect(normalizeVkWallInput('public42')).toBe('42');
    expect(normalizeVkWallInput('https://vk.com/example')).toBe('example');
    expect(normalizeVkWallInput('https://vk.ru/alephmap')).toBe('alephmap');
    expect(normalizeVkWallInput('vk.ru/club123456')).toBe('123456');
  });
});

describe('vk api errors', () => {
  it('maps permission error', () => {
    const mapped = mapVkApiError(15, 'Access denied');
    expect(mapped.userMessage).toContain('Недостаточно прав');
    expect(mapped.permissionDenied).toBe(true);
  });

  it('maps community token errors', async () => {
    const { mapCommunityTokenError, toUserFacingVkError, VkTransportError } = await import('./vk-api-errors.js');
    const { ConnectionSecretMissingError } = await import('../telegram/connection-errors.js');
    expect(mapCommunityTokenError('VK_COMMUNITY_TOKEN:not_a_community')).toContain('сообществом');
    expect(toUserFacingVkError(new Error('VK_COMMUNITY_TOKEN:too_short'))).toContain('короткий');
    expect(
      toUserFacingVkError(
        new VkTransportError('VK_API:5:User authorization failed', 'vk_api', 'x', true),
        { credentialKind: 'community_token' },
      ),
    ).toContain('Ключ доступа');
    expect(toUserFacingVkError(new ConnectionSecretMissingError('vk'))).toContain('ВКонтакте');
    expect(toUserFacingVkError(new ConnectionSecretMissingError('vk'))).not.toContain('Telegram');
  });

  it('maps auth error only for expired token', () => {
    const mapped = mapVkApiError(5, 'User authorization failed: access_token has expired');
    expect(mapped.unauthorized).toBe(true);
    expect(mapped.userMessage).toContain('устарела');
  });

  it('does not treat generic error 5 as expired token', () => {
    const mapped = mapVkApiError(5, 'User authorization failed');
    expect(mapped.unauthorized).toBe(false);
  });
});

describe('vk connection targets', () => {
  it('reuses existing oauth connection for the same vk user', async () => {
    const transport = new FakeVkTransport();
    const connections = new MemoryPlatformConnectionRepository();
    const accounts = new MemorySocialAccountRepository();
    const service = new VkConnectionService(connections, accounts, transport);

    const first = await service.connectOAuth(
      {
        appId: 'app',
        serverBaseUrl: 'https://zasian.ru',
        redirectUri: 'https://zasian.ru/vk-callback.php',
      },
      ['wall', 'photos', 'groups'],
    );
    const second = await service.connectOAuth(
      {
        appId: 'app',
        serverBaseUrl: 'https://zasian.ru',
        redirectUri: 'https://zasian.ru/vk-callback.php',
      },
      ['wall', 'photos', 'groups'],
    );

    expect(second.connection.id).toBe(first.connection.id);
    expect((await connections.listByPlatform('vk')).filter((c) => c.method === 'oauth_system_browser')).toHaveLength(1);
  });

  it('one connection supports multiple targets', async () => {
    const transport = new FakeVkTransport();
    const connections = new MemoryPlatformConnectionRepository();
    const accounts = new MemorySocialAccountRepository();
    const service = new VkConnectionService(connections, accounts, transport);

    const { connection } = await service.connectOAuth(
      {
        appId: 'app',
        serverBaseUrl: 'https://zasian.ru',
        redirectUri: 'https://zasian.ru/vk-callback.php',
      },
      ['wall', 'photos', 'groups'],
    );
    const discovery = await service.listAvailableTargets(connection.id);
    expect(discovery.targets.length).toBeGreaterThanOrEqual(2);

    const created = await service.addPublicationTargets({
      connectionId: connection.id,
      targets: discovery.targets.filter((t) => t.canPost).slice(0, 2),
    });
    expect(created).toHaveLength(2);
    expect(created.every((a) => a.connectionId === connection.id)).toBe(true);
  });
});

describe('vk publishing', () => {
  it('publishes community post with from_group semantics via metadata', async () => {
    const transport = new FakeVkTransport();
    const publisher = new VkPublisher(transport);
    const { connection } = await new VkConnectionService(
      new MemoryPlatformConnectionRepository(),
      new MemorySocialAccountRepository(),
      transport,
    ).connectOAuth(
      {
        appId: 'app',
        serverBaseUrl: 'https://zasian.ru',
        redirectUri: 'https://zasian.ru/vk-callback.php',
      },
      ['wall'],
    );

    const publication: Publication = {
      id: 'pub-1',
      batchId: 'batch-1',
      contentRevisionId: 'rev-1',
      platformId: 'vk',
      socialAccountId: 'acc-1',
      status: 'draft',
      preparedSnapshot: {
        formatVersion: 2,
        platformId: 'vk',
        transformedContent: { text: 'Hello VK', images: [], warnings: [] },
        validationIssues: [],
        preparedAt: nowIso(),
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const account = {
      id: 'acc-1',
      platformId: 'vk',
      displayName: 'Компания Альфа',
      connectionId: connection.id,
      externalAccountId: '-2001',
      platformMetadataJson: serializeVkPublicationTargetMetadata({
        targetType: 'community_wall',
        ownerId: -2001,
        communityId: 2001,
        postAsGroup: true,
        destinationKindLabel: 'Сообщество',
      }),
      isActive: true,
      connectionState: 'connected' as const,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const result = await publisher.publish({
      publication,
      account,
      connection,
      mediaPaths: {},
    });
    expect(result.success).toBe(true);
    expect(result.remotePostId).toMatch(/^wall-2001_/);
  });
});
