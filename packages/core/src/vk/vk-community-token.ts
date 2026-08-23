import type { VkPublicationCapabilities } from '@reizoko/shared';

import { communityIdToOwnerId } from './vk-owner-id.js';
import { normalizeVkWallInput, isNumericVkId } from './vk-wall-input.js';

export type VkCommunityTokenVerifyState = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

export interface VkCommunityTokenVerification {
  communityId: number;
  ownerId: number;
  displayName: string;
  screenName?: string | null;
  avatarUrl?: string | null;
  permissions: string[];
  tokenGroupId?: number | null;
  tokenMatchesCommunity: boolean;
  capabilities: VkPublicationCapabilities;
  photoUploadErrorCode?: number | null;
  photoUploadErrorMessage?: string | null;
}

const VK_COMMUNITY_TOKEN_MIN_LENGTH = 16;

export function validateCommunityAccessTokenFormat(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return 'Введите ключ доступа сообщества.';
  if (trimmed.length < VK_COMMUNITY_TOKEN_MIN_LENGTH) {
    return 'Ключ доступа слишком короткий. Проверьте, что скопировали ключ полностью.';
  }
  return null;
}

export function normalizeVkCommunityInput(value: string): string {
  return normalizeVkWallInput(value);
}

export function buildCommunityCapabilities(input: {
  permissions: string[];
  canUploadPhotos: boolean;
  photoUploadVia: VkPublicationCapabilities['photoUploadVia'];
  photoUploadErrorCode?: number | null;
  photoUploadErrorMessage?: string | null;
}): VkPublicationCapabilities {
  const permissionSet = new Set(input.permissions.map((item) => item.toLowerCase()));
  const hasWall = permissionSet.has('wall');
  const hasPhotos = permissionSet.has('photos');

  return {
    canPublishText: hasWall,
    canUploadPhotos: input.canUploadPhotos || hasPhotos,
    canPublishPhotos: hasPhotos,
    canPublishAsCommunity: hasWall,
    photoUploadVia:
      input.photoUploadVia && input.photoUploadVia !== 'none'
        ? input.photoUploadVia
        : hasPhotos
          ? 'community_token'
          : 'none',
    permissions: [...input.permissions],
  };
}

export function mapVerificationToTarget(input: VkCommunityTokenVerification): {
  ownerId: number;
  communityId: number;
  displayName: string;
  screenName?: string | null;
  avatarUrl?: string | null;
  capabilities: VkPublicationCapabilities;
} {
  return {
    ownerId: input.ownerId,
    communityId: input.communityId,
    displayName: input.displayName,
    screenName: input.screenName,
    avatarUrl: input.avatarUrl,
    capabilities: input.capabilities,
  };
}

export function assertCommunityVerificationReady(
  verification: VkCommunityTokenVerification,
): string | null {
  if (!verification.tokenMatchesCommunity) {
    return 'Этот ключ доступа не относится к указанному сообществу.';
  }
  if (!verification.capabilities.canPublishText) {
    return 'У ключа нет права «Стена». Создайте новый ключ с доступом к стене в настройках сообщества VK.';
  }
  return null;
}

export function resolveNumericCommunityId(normalized: string): number | null {
  if (!isNumericVkId(normalized)) return null;
  const id = Number(normalized);
  return id > 0 ? id : null;
}

export function buildOwnerIdFromCommunityId(communityId: number): number {
  return communityIdToOwnerId(communityId);
}

export function formatVkCommunityPermissionLabel(permission: string): string {
  const labels: Record<string, string> = {
    wall: 'Стена',
    photos: 'Фотографии',
    docs: 'Файлы',
    messages: 'Сообщения',
    manage: 'Управление',
    stories: 'Истории',
    market: 'Товары',
    app_widget: 'Виджет',
  };
  return labels[permission.toLowerCase()] ?? permission;
}

/** Known community token scopes, in the order shown in VK admin UI. */
export const VK_COMMUNITY_KNOWN_PERMISSIONS = [
  'manage',
  'messages',
  'photos',
  'docs',
  'stories',
  'wall',
  'market',
  'app_widget',
] as const;

export type VkCommunityPermissionKey = (typeof VK_COMMUNITY_KNOWN_PERMISSIONS)[number];

export interface VkCommunityPermissionStatus {
  key: string;
  label: string;
  granted: boolean;
}

export function describeVkCommunityPermissions(permissions: string[]): VkCommunityPermissionStatus[] {
  const granted = new Set(permissions.map((item) => item.toLowerCase()));
  const known = VK_COMMUNITY_KNOWN_PERMISSIONS.map((key) => ({
    key,
    label: formatVkCommunityPermissionLabel(key),
    granted: granted.has(key),
  }));
  const extras = [...granted].filter(
    (key) => !VK_COMMUNITY_KNOWN_PERMISSIONS.includes(key as VkCommunityPermissionKey),
  );
  return [
    ...known,
    ...extras.map((key) => ({
      key,
      label: formatVkCommunityPermissionLabel(key),
      granted: true,
    })),
  ];
}

export function communityConnectionInputFromHandle(
  handle: string | null | undefined,
  communityId?: string | null,
): string {
  if (handle?.trim()) {
    return normalizeVkWallInput(handle) || handle.trim();
  }
  if (communityId) return communityId;
  return '';
}

export type VkCommunityReadinessItem = {
  key: 'text' | 'photos';
  tone: 'ok' | 'warn';
  message: string;
};

/** @deprecated Use describeVkCommunityPermissions for UI. */
export function describeVkCommunityPublicationReadiness(input: {
  capabilities: VkPublicationCapabilities;
  photoUploadErrorCode?: number | null;
}): VkCommunityReadinessItem[] {
  const { capabilities, photoUploadErrorCode } = input;
  const items: VkCommunityReadinessItem[] = [
    {
      key: 'text',
      tone: capabilities.canPublishText ? 'ok' : 'warn',
      message: capabilities.canPublishText
        ? '✓ Текстовые записи'
        : '⚠ Текстовые записи недоступны',
    },
  ];

  let photosMessage: string;
  if (capabilities.canPublishPhotos) {
    if (capabilities.photoUploadVia === 'user_oauth') {
      photosMessage = '✓ Изображения (загрузка через подключённый VK ID)';
    } else if (photoUploadErrorCode != null) {
      photosMessage =
        '✓ Изображения (право «Фотографии» в ключе; при публикации используется ключ или VK ID)';
    } else {
      photosMessage = '✓ Изображения';
    }
  } else {
    photosMessage = '⚠ Изображения недоступны — добавьте право «Фотографии» при создании ключа';
  }

  items.push({
    key: 'photos',
    tone: capabilities.canPublishPhotos ? 'ok' : 'warn',
    message: photosMessage,
  });

  return items;
}

export function isCommunityCredentialConnection(connection: {
  method: string;
  secretRef?: string | null;
}): boolean {
  if (connection.method !== 'manual_secret') return false;
  return Boolean(connection.secretRef?.endsWith('/community_token'));
}
