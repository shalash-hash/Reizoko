import { buildSecretRef } from '@reizoko/shared';
import { buildCommunityCapabilities } from './vk-community-token.js';
import { communityIdToOwnerId } from './vk-owner-id.js';
import { normalizeVkWallInput } from './vk-wall-input.js';
import type {
  VkCommunityInfo,
  VkCommunityTokenVerification,
  VkOAuthResult,
  VkOAuthStartRequest,
  VkPublicationCapability,
  VkPublishRequest,
  VkResolvedObject,
  VkTransport,
  VkUserInfo,
  VkWallPostResult,
} from './vk-transport.js';
import type { VkPublicationTargetType } from '@reizoko/shared';

export class FakeVkTransport implements VkTransport {
  private readonly secrets = new Map<string, string>();
  private readonly communityTokens = new Map<string, { communityId: number; permissions: string[] }>();
  private readonly users = new Map<number, VkUserInfo>();
  private readonly communities = new Map<number, VkCommunityInfo>();
  private readonly postableWalls = new Set<number>();
  private currentUserId = 1001;
  private nextPostId = 1;

  constructor() {
    this.users.set(1001, {
      id: 1001,
      firstName: 'Иван',
      lastName: 'Иванов',
      screenName: 'ivan',
      photoUrl: 'https://example.com/ivan.jpg',
    });
    this.postableWalls.add(1001);
    this.communities.set(2001, {
      id: 2001,
      name: 'Компания Альфа',
      screenName: 'alpha',
      photoUrl: 'https://example.com/alpha.jpg',
      canPost: true,
    });
    this.postableWalls.add(-2001);
  }

  registerCommunity(community: VkCommunityInfo, canPost = true): void {
    this.communities.set(community.id, community);
    if (canPost) this.postableWalls.add(-community.id);
  }

  registerUser(user: VkUserInfo, canPost = false): void {
    this.users.set(user.id, user);
    if (canPost) this.postableWalls.add(user.id);
  }

  registerCommunityToken(token: string, communityId: number, permissions: string[] = ['wall', 'photos']): void {
    this.communityTokens.set(token, { communityId, permissions });
  }

  async startOAuth(request: VkOAuthStartRequest): Promise<VkOAuthResult> {
    const secretRef = buildSecretRef(request.connectionId, 'access_token');
    this.secrets.set(secretRef, `fake-token-${request.connectionId}`);
    return { accessToken: this.secrets.get(secretRef)!, userId: this.currentUserId };
  }

  async getCurrentUser(secretRef: string): Promise<VkUserInfo> {
    this.requireSecret(secretRef);
    return this.users.get(this.currentUserId)!;
  }

  async listManageableCommunities(secretRef: string): Promise<VkCommunityInfo[]> {
    this.requireSecret(secretRef);
    return [...this.communities.values()].filter((c) => c.canPost !== false);
  }

  async resolveScreenName(secretRef: string, screenName: string): Promise<VkResolvedObject> {
    this.requireSecret(secretRef);
    return this.resolveScreenNameForCommunity(screenName);
  }

  private async resolveScreenNameForCommunity(screenName: string): Promise<VkResolvedObject> {
    if (/^\d+$/.test(screenName)) {
      const id = Number(screenName);
      if (this.communities.has(id)) return { type: 'group', objectId: id };
      return { type: 'user', objectId: id };
    }
    for (const user of this.users.values()) {
      if (user.screenName === screenName) return { type: 'user', objectId: user.id, screenName };
    }
    for (const community of this.communities.values()) {
      if (community.screenName === screenName) {
        return { type: 'group', objectId: community.id, screenName };
      }
    }
    throw new Error('VK_API:113:Invalid screen name');
  }

  async getUserInfo(secretRef: string, userId: number): Promise<VkUserInfo> {
    this.requireSecret(secretRef);
    const user = this.users.get(userId);
    if (!user) throw new Error('VK_API:113:User not found');
    return user;
  }

  async getCommunityInfo(secretRef: string, communityId: number): Promise<VkCommunityInfo> {
    this.requireSecret(secretRef);
    const community = this.communities.get(communityId);
    if (!community) throw new Error('VK_API:113:Community not found');
    return community;
  }

  async checkPublicationTarget(
    secretRef: string,
    _targetType: VkPublicationTargetType,
    ownerId: number,
    options?: { communityId?: number | null; postAsGroup?: boolean },
  ): Promise<VkPublicationCapability> {
    this.requireSecret(secretRef);
    const canPost = this.postableWalls.has(ownerId);
    if (!canPost) {
      return {
        canPost: false,
        reason: 'На эту стену нельзя публиковать через подключённый аккаунт ВКонтакте.',
      };
    }
    if (ownerId < 0) {
      return { canPost: true, canPostAsGroup: options?.postAsGroup ?? true };
    }
    return { canPost: true };
  }

  async publishWallPost(secretRef: string, request: VkPublishRequest): Promise<VkWallPostResult> {
    this.requireSecret(secretRef);
    if (!this.postableWalls.has(request.ownerId)) {
      throw new Error('VK_API:15:Access denied');
    }
    const postId = this.nextPostId++;
    return { postId, ownerId: request.ownerId };
  }

  async verifyCommunityToken(input: {
    communityInput: string;
    accessToken: string;
  }): Promise<VkCommunityTokenVerification> {
    const token = input.accessToken.trim();
    const record = this.communityTokens.get(token);
    if (!record) {
      throw new Error('VK_API:5:Invalid access token');
    }
    const normalized = normalizeVkWallInput(input.communityInput);
    let communityId = Number(normalized);
    if (!Number.isFinite(communityId) || communityId <= 0) {
      const resolved = await this.resolveScreenNameForCommunity(normalized);
      communityId = resolved.objectId;
    }
    const community = this.communities.get(communityId) ?? this.communities.get(record.communityId);
    if (!community) {
      throw new Error('VK_API:113:Community not found');
    }
    const tokenMatchesCommunity = record.communityId === communityId;
    const permissions = record.permissions;
    const capabilities = buildCommunityCapabilities({
      permissions,
      canUploadPhotos: permissions.includes('photos'),
      photoUploadVia: permissions.includes('photos') ? 'community_token' : 'none',
    });
    return {
      communityId,
      ownerId: communityIdToOwnerId(communityId),
      displayName: community.name,
      screenName: community.screenName,
      avatarUrl: community.photoUrl,
      permissions,
      tokenGroupId: record.communityId,
      tokenMatchesCommunity,
      capabilities,
    };
  }

  async probeCommunityPhotoUpload(input: {
    accessToken: string;
    communityId: number;
  }): Promise<{ available: boolean; errorCode?: number; errorMessage?: string }> {
    const record = this.communityTokens.get(input.accessToken.trim());
    if (!record) {
      return { available: false, errorCode: 5, errorMessage: 'Invalid access token' };
    }
    const available = record.permissions.includes('photos');
    return available
      ? { available: true }
      : { available: false, errorCode: 27, errorMessage: 'Group authorization failed' };
  }

  async probeCommunityPhotoUploadBySecretRef(input: {
    secretRef: string;
    communityId: number;
  }): Promise<{ available: boolean; errorCode?: number; errorMessage?: string }> {
    const token = this.secrets.get(input.secretRef);
    if (!token) {
      return { available: false, errorCode: 5, errorMessage: 'Invalid access token' };
    }
    return this.probeCommunityPhotoUpload({ accessToken: token, communityId: input.communityId });
  }

  async storeSecret(secretRef: string, value: string): Promise<void> {
    this.secrets.set(secretRef, value);
  }

  async deleteSecret(secretRef: string): Promise<void> {
    this.secrets.delete(secretRef);
  }

  async hasSecret(secretRef: string): Promise<boolean> {
    return this.secrets.has(secretRef);
  }

  async getSecret(secretRef: string): Promise<string | null> {
    return this.secrets.get(secretRef) ?? null;
  }

  private requireSecret(secretRef: string): void {
    if (!this.secrets.has(secretRef)) {
      throw new Error('SECRET_MISSING');
    }
  }
}
