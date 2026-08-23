import type { VkPublicationTargetType } from '@reizoko/shared';

import type { VkCommunityTokenVerification } from './vk-community-token.js';
import type { VkOAuthConnectionMeta } from './vk-scopes.js';

export type { VkCommunityTokenVerification };

export const VK_WALL_ATTACHMENTS_MAX = 10;

export interface VkUserInfo {
  id: number;
  firstName: string;
  lastName: string;
  screenName?: string | null;
  photoUrl?: string | null;
}

export interface VkCommunityInfo {
  id: number;
  name: string;
  screenName?: string | null;
  photoUrl?: string | null;
  canPost?: boolean;
}

export interface VkPublicationCapability {
  canPost: boolean;
  canPostAsGroup?: boolean;
  reason?: string;
  canUploadPhotos?: boolean;
}

export interface VkOAuthResult {
  accessToken: string;
  userId: number;
  expiresIn?: number | null;
  profile?: VkUserInfo | null;
  oauthMeta?: VkOAuthConnectionMeta;
}

export interface VkWallPostResult {
  postId: number;
  ownerId: number;
}

export interface VkPublishPhotoItem {
  mediaId: string;
  localPath: string;
}

export interface VkResolvedObject {
  type: 'user' | 'group' | 'page';
  objectId: number;
  screenName?: string | null;
}

export interface VkPublishRequest {
  secretRef: string;
  ownerId: number;
  message: string;
  fromGroup?: boolean;
  groupId?: number | null;
  photos?: VkPublishPhotoItem[];
  /** Use user OAuth token for photo upload when community token cannot upload. */
  photoUploadSecretRef?: string | null;
}

export interface VkOAuthStartRequest {
  connectionId: string;
  appId: string;
  serverBaseUrl: string;
  redirectUri: string;
  scopes: string[];
  /** Re-request user consent — use when upgrading permissions. */
  forceConsent?: boolean;
}

export interface VkTransport {
  startOAuth(request: VkOAuthStartRequest): Promise<VkOAuthResult>;

  getCurrentUser(secretRef: string): Promise<VkUserInfo>;

  listManageableCommunities(secretRef: string): Promise<VkCommunityInfo[]>;

  resolveScreenName(secretRef: string, screenName: string): Promise<VkResolvedObject>;

  getUserInfo(secretRef: string, userId: number): Promise<VkUserInfo>;

  getCommunityInfo(secretRef: string, communityId: number): Promise<VkCommunityInfo>;

  checkPublicationTarget(
    secretRef: string,
    targetType: VkPublicationTargetType,
    ownerId: number,
    options?: { communityId?: number | null; postAsGroup?: boolean },
  ): Promise<VkPublicationCapability>;

  publishWallPost(secretRef: string, request: VkPublishRequest): Promise<VkWallPostResult>;

  verifyCommunityToken(input: {
    communityInput: string;
    accessToken: string;
  }): Promise<VkCommunityTokenVerification>;

  probeCommunityPhotoUpload(input: {
    accessToken: string;
    communityId: number;
  }): Promise<{ available: boolean; errorCode?: number; errorMessage?: string }>;

  probeCommunityPhotoUploadBySecretRef(input: {
    secretRef: string;
    communityId: number;
  }): Promise<{ available: boolean; errorCode?: number; errorMessage?: string }>;

  storeSecret(secretRef: string, value: string): Promise<void>;

  deleteSecret(secretRef: string): Promise<void>;

  hasSecret(secretRef: string): Promise<boolean>;

  getSecret(secretRef: string): Promise<string | null>;
}
