import { describe, expect, it } from 'vitest';

import {
  assertCommunityVerificationReady,
  describeVkCommunityPermissions,
  buildCommunityCapabilities,
  buildOwnerIdFromCommunityId,
  validateCommunityAccessTokenFormat,
} from './vk-community-token.js';
import { FakeVkTransport } from './fake-vk-transport.js';
import { VkConnectionService } from './vk-connection-service.js';
import { parseVkPublicationTargetMetadata } from '@reizoko/shared';

function createMemoryRepo<T extends { id: string }>() {
  const items = new Map<string, T>();
  return {
    async create(item: T) {
      items.set(item.id, item);
      return item;
    },
    async getById(id: string) {
      return items.get(id) ?? null;
    },
    async update(id: string, patch: Partial<T>) {
      const existing = items.get(id);
      if (!existing) throw new Error('missing');
      const updated = { ...existing, ...patch };
      items.set(id, updated);
      return updated;
    },
    async listByPlatform() {
      return [...items.values()];
    },
    async listByConnectionId() {
      return [];
    },
  };
}

describe('vk community token', () => {
  it('maps communityId to negative owner_id', () => {
    expect(buildOwnerIdFromCommunityId(123456)).toBe(-123456);
  });

  it('requires wall permission for ready connection', () => {
    const verification = {
      communityId: 2001,
      ownerId: -2001,
      displayName: 'Компания Альфа',
      permissions: ['photos'],
      tokenMatchesCommunity: true,
      capabilities: buildCommunityCapabilities({
        permissions: ['photos'],
        canUploadPhotos: false,
        photoUploadVia: 'none',
      }),
    };
    expect(assertCommunityVerificationReady(verification)).toContain('Стена');
  });

  it('rejects mismatched token and community', () => {
    const verification = {
      communityId: 2001,
      ownerId: -2001,
      displayName: 'Компания Альфа',
      permissions: ['wall'],
      tokenMatchesCommunity: false,
      capabilities: buildCommunityCapabilities({
        permissions: ['wall'],
        canUploadPhotos: false,
        photoUploadVia: 'none',
      }),
    };
    expect(assertCommunityVerificationReady(verification)).toContain('не относится');
  });

  it('reuses existing community connection for the same community', async () => {
    const transport = new FakeVkTransport();
    transport.registerCommunityToken('community-token-alpha', 2001, ['wall', 'photos']);
    const connections = createMemoryRepo<any>();
    const socialAccounts = createMemoryRepo<any>();
    const service = new VkConnectionService(connections as any, socialAccounts as any, transport);

    const verification = await service.verifyCommunityToken({
      communityInput: 'alpha',
      accessToken: 'community-token-alpha',
    });
    const first = await service.connectCommunityToken({
      verification,
      accessToken: 'community-token-alpha',
    });
    const second = await service.connectCommunityToken({
      verification,
      accessToken: 'community-token-alpha',
    });

    expect(second.connection.id).toBe(first.connection.id);
    expect(second.account.id).toBe(first.account.id);
    expect((await connections.listByPlatform('vk')).filter((c) => c.method === 'manual_secret')).toHaveLength(1);
  });

  it('connects community target with community credential', async () => {
    const transport = new FakeVkTransport();
    transport.registerCommunityToken('community-token-alpha', 2001, ['wall', 'photos']);
    const connections = createMemoryRepo<any>();
    const socialAccounts = createMemoryRepo<any>();
    const service = new VkConnectionService(connections as any, socialAccounts as any, transport);

    const verification = await service.verifyCommunityToken({
      communityInput: 'alpha',
      accessToken: 'community-token-alpha',
    });
    const { connection, account } = await service.connectCommunityToken({
      verification,
      accessToken: 'community-token-alpha',
    });

    expect(connection.method).toBe('manual_secret');
    expect(connection.secretRef).toContain('/community_token');
    const metadata = parseVkPublicationTargetMetadata(account.platformMetadataJson);
    expect(metadata?.credentialKind).toBe('community_token');
    expect(metadata?.ownerId).toBe(-2001);
    expect(metadata?.capabilities?.canPublishText).toBe(true);
  });

  it('validates token format', () => {
    expect(validateCommunityAccessTokenFormat('')).toBeTruthy();
    expect(validateCommunityAccessTokenFormat('short')).toBeTruthy();
    expect(validateCommunityAccessTokenFormat('x'.repeat(20))).toBeNull();
  });

  it('treats photos permission as publish-ready even when upload probe failed', () => {
    const capabilities = buildCommunityCapabilities({
      permissions: ['wall', 'photos'],
      canUploadPhotos: false,
      photoUploadVia: 'community_token',
    });
    expect(capabilities.canPublishPhotos).toBe(true);
    expect(capabilities.canUploadPhotos).toBe(true);
    expect(capabilities.photoUploadVia).toBe('community_token');
  });

  it('lists all known community permissions with grant state', () => {
    const items = describeVkCommunityPermissions(['wall', 'photos', 'manage']);
    expect(items.find((item) => item.key === 'photos')?.granted).toBe(true);
    expect(items.find((item) => item.key === 'wall')?.granted).toBe(true);
    expect(items.find((item) => item.key === 'messages')?.granted).toBe(false);
    expect(items.length).toBeGreaterThanOrEqual(7);
  });

  it('refreshes stored community token status without pasting the key again', async () => {
    const transport = new FakeVkTransport();
    transport.registerCommunityToken('community-token-alpha', 2001, ['wall', 'photos']);
    const connections = createMemoryRepo<any>();
    const socialAccounts = createMemoryRepo<any>();
    const service = new VkConnectionService(connections as any, socialAccounts as any, transport);

    const verification = await service.verifyCommunityToken({
      communityInput: 'alpha',
      accessToken: 'community-token-alpha',
    });
    const { connection, account } = await service.connectCommunityToken({
      verification,
      accessToken: 'community-token-alpha',
    });

    const refreshed = await service.refreshCommunityTokenStatus(connection.id);
    expect(refreshed.capabilities.canPublishPhotos).toBe(true);
    const updatedAccount = await socialAccounts.getById(account.id);
    const metadata = parseVkPublicationTargetMetadata(updatedAccount?.platformMetadataJson);
    expect(metadata?.capabilities?.canPublishPhotos).toBe(true);
  });
});
