/** VK publication destination kind — stored in social account platform metadata. */
export type VkPublicationTargetType = 'self_wall' | 'community_wall' | 'user_wall';

export type VkCredentialKind = 'user_oauth' | 'community_token';

export interface VkPublicationCapabilities {
  canPublishText: boolean;
  canUploadPhotos: boolean;
  canPublishPhotos: boolean;
  canPublishAsCommunity: boolean;
  /** Where photo upload is expected to work for this target. */
  photoUploadVia?: 'community_token' | 'user_oauth' | 'none';
  permissions?: string[];
}

export interface VkPublicationTargetMetadata {
  targetType: VkPublicationTargetType;
  /** VK wall owner_id (positive user id or negative community id). */
  ownerId: number;
  /** Positive community id when targetType is community_wall. */
  communityId?: number;
  /** Publish community posts from_group=1 when true. */
  postAsGroup?: boolean;
  avatarUrl?: string | null;
  /** Human-readable destination kind for UI, e.g. «Моя страница», «Сообщество». */
  destinationKindLabel?: string;
  credentialKind?: VkCredentialKind;
  capabilities?: VkPublicationCapabilities;
}

export interface VkOAuthConfig {
  appId: string;
  clientSecret?: string | null;
  serviceToken?: string | null;
  serverBaseUrl?: string | null;
  redirectUri?: string | null;
}

export {
  REIZOKO_SERVER_URL,
  REIZOKO_SERVER_ENDPOINTS,
  VK_CANONICAL_REDIRECT_URI,
  VK_DEFAULT_SERVER_BASE_URL,
  buildReizokoServerUrl,
} from './reizoko-server.js';

export const VK_OAUTH_SCOPES = ['vkid.personal_info', 'groups', 'wall', 'photos', 'offline'] as const;

export function parseVkPublicationTargetMetadata(
  raw: string | Record<string, unknown> | null | undefined,
): VkPublicationTargetMetadata | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : raw;
    const vk = (parsed.vk ?? parsed) as Partial<VkPublicationTargetMetadata>;
    if (
      !vk.targetType ||
      typeof vk.ownerId !== 'number' ||
      !['self_wall', 'community_wall', 'user_wall'].includes(vk.targetType)
    ) {
      return null;
    }
    return {
      targetType: vk.targetType,
      ownerId: vk.ownerId,
      communityId: typeof vk.communityId === 'number' ? vk.communityId : undefined,
      postAsGroup: vk.postAsGroup ?? undefined,
      avatarUrl: typeof vk.avatarUrl === 'string' ? vk.avatarUrl : null,
      destinationKindLabel:
        typeof vk.destinationKindLabel === 'string' ? vk.destinationKindLabel : undefined,
      credentialKind:
        vk.credentialKind === 'community_token' || vk.credentialKind === 'user_oauth'
          ? vk.credentialKind
          : undefined,
      capabilities:
        vk.capabilities && typeof vk.capabilities === 'object'
          ? (vk.capabilities as VkPublicationCapabilities)
          : undefined,
    };
  } catch {
    return null;
  }
}

export function serializeVkPublicationTargetMetadata(
  metadata: VkPublicationTargetMetadata,
): string {
  return JSON.stringify({ vk: metadata });
}
