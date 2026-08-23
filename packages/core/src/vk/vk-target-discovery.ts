import { buildSecretRef, type PlatformConnection } from '@reizoko/shared';

import { parseVkApiErrorFromMessage, VkTransportError } from './vk-api-errors.js';
import { communityIdToOwnerId, userIdToOwnerId } from './vk-owner-id.js';
import {
  analyzeVkScopeCoverage,
  type VkOAuthConnectionMeta,
  type VkScopeAnalysis,
} from './vk-scopes.js';
import type { VkPublicationCapability, VkTransport, VkUserInfo } from './vk-transport.js';
import type { VkPublicationTargetType } from '@reizoko/shared';

export interface VkTargetCandidate {
  targetType: VkPublicationTargetType;
  ownerId: number;
  communityId?: number;
  displayName: string;
  screenName?: string | null;
  avatarUrl?: string | null;
  destinationKindLabel: string;
  canPost: boolean;
  canPostAsGroup?: boolean;
  postAsGroup?: boolean;
}

export type VkTargetDiscoveryEmptyReason =
  | 'NO_TARGETS_FOUND'
  | 'ALL_TARGETS_ALREADY_CONNECTED'
  | 'TARGET_DISCOVERY_FAILED'
  | 'TOKEN_INVALID'
  | 'INSUFFICIENT_PERMISSION';

export interface VkTargetTokenMetadata {
  userAccessTokenPresent: boolean;
  refreshTokenPresent: boolean;
  expiresAt: string | null;
  tokenSource: 'vk_oauth';
}

export interface VkTargetDiscoveryResult {
  targets: VkTargetCandidate[];
  discoveryState: 'success' | 'partial' | 'failed';
  selfWall: { available: boolean; reason?: string };
  groups: {
    status: 'success' | 'failed' | 'skipped';
    count: number;
    vkErrorCode?: number;
    vkErrorMessage?: string;
    method?: string;
    failureKind?: string;
  };
  scopes: VkScopeAnalysis | null;
  publishCapabilities: {
    wallReady: boolean;
    photosReady: boolean;
    wallWarning?: string;
    photosWarning?: string;
  };
  notices: string[];
  tokenMetadata: VkTargetTokenMetadata;
  emptyReason?: VkTargetDiscoveryEmptyReason;
  fatalError?: string;
  needsScopeUpgrade?: boolean;
}

function logVkTargetDiscovery(event: string, payload: Record<string, unknown>): void {
  console.info(`[VK_TARGET_DISCOVERY] ${event}`, payload);
}

function userFromConnection(connection: PlatformConnection): VkUserInfo {
  const userId = Number(connection.externalIdentityId ?? 0);
  const displayName = (connection.displayName ?? 'ВКонтакте').trim();
  const [firstName, ...rest] = displayName.split(/\s+/);
  const handle = connection.handle?.replace(/^vk\.com\//i, '') ?? null;
  return {
    id: userId,
    firstName: firstName || displayName,
    lastName: rest.join(' '),
    screenName: handle,
    photoUrl: null,
  };
}

function parseTransportError(error: unknown): {
  code: string;
  vkErrorCode?: number;
  vkErrorMessage?: string;
  unauthorized: boolean;
  permissionDenied: boolean;
} {
  if (error instanceof VkTransportError) {
    const parsed = parseVkApiErrorFromMessage(error.message);
    return {
      code: error.code,
      vkErrorCode: parsed?.errorCode,
      vkErrorMessage: parsed?.errorMessage ?? error.message,
      unauthorized: error.unauthorized,
      permissionDenied: error.permissionDenied,
    };
  }
  if (error instanceof Error) {
    const parsed = parseVkApiErrorFromMessage(error.message);
    return {
      code: parsed ? `VK_API:${parsed.errorCode}` : 'unknown',
      vkErrorCode: parsed?.errorCode,
      vkErrorMessage: parsed?.errorMessage ?? error.message,
      unauthorized: parsed?.unauthorized ?? false,
      permissionDenied: parsed?.permissionDenied ?? false,
    };
  }
  return { code: 'unknown', unauthorized: false, permissionDenied: false };
}

function classifyGroupsFailure(
  error: ReturnType<typeof parseTransportError>,
  scopeAnalysis: VkScopeAnalysis | null,
): { notice: string; failureKind: string } {
  if (scopeAnalysis && !scopeAnalysis.hasGroups) {
    return {
      failureKind: 'MISSING_GROUPS_PERMISSION',
      notice:
        'ВКонтакте подключён, но Reizoko пока не имеет доступа к вашим сообществам. Чтобы выбирать группы для публикации, разрешите Reizoko доступ к сообществам.',
    };
  }
  if (error.vkErrorCode === 1051) {
    return {
      failureKind: 'APP_PERMISSION_NOT_GRANTED',
      notice:
        'Токен VK ID не поддерживает этот запрос. Проверьте, что в кабинете VK ID для приложения включены доступы «Сообщества», «Стена» и «Фотографии».',
    };
  }
  if (error.vkErrorCode === 5 || error.permissionDenied) {
    return {
      failureKind: 'MISSING_GROUPS_PERMISSION',
      notice:
        'Подключение ВКонтакте выполнено, но Reizoko не получил разрешение на просмотр доступных сообществ.',
    };
  }
  return {
    failureKind: 'TARGET_DISCOVERY_FAILED',
    notice: 'Не удалось автоматически получить сообщества. Их можно добавить вручную.',
  };
}

function buildPublishCapabilityWarnings(scopeAnalysis: VkScopeAnalysis | null): VkTargetDiscoveryResult['publishCapabilities'] {
  const wallReady = scopeAnalysis?.hasWall ?? false;
  const photosReady = scopeAnalysis?.hasPhotos ?? false;
  return {
    wallReady,
    photosReady,
    wallWarning: wallReady
      ? undefined
      : 'Для публикации записей приложению требуется доступ «Стена».',
    photosWarning: photosReady
      ? undefined
      : 'Для публикации изображений требуется доступ «Фотографии».',
  };
}

function isTokenInvalidError(error: unknown): boolean {
  if (error instanceof VkTransportError) {
    return error.code === 'secret_missing' || (error.code === 'unauthorized' && error.unauthorized);
  }
  if (error instanceof Error) {
    return error.message.includes('SECRET_MISSING') || error.message === 'VK_UNAUTHORIZED';
  }
  return false;
}

export async function discoverVkPublicationTargets(
  connection: PlatformConnection,
  transport: VkTransport,
  oauthMeta?: VkOAuthConnectionMeta | null,
): Promise<VkTargetDiscoveryResult> {
  const connectionId = connection.id;
  const scopeAnalysis = oauthMeta
    ? analyzeVkScopeCoverage(oauthMeta.grantedScopes, oauthMeta.requestedScopes)
    : null;
  const publishCapabilities = buildPublishCapabilityWarnings(scopeAnalysis);

  logVkTargetDiscovery('VK_TARGET_DISCOVERY_START', { connection: connectionId, stage: 'publication_target_discovery' });
  if (scopeAnalysis) {
    logVkTargetDiscovery('VK_OAUTH_SCOPES', {
      connection: connectionId,
      requested: scopeAnalysis.requested.join(' '),
      granted: scopeAnalysis.granted.join(' '),
      missing: scopeAnalysis.missing.join(' ') || '(none)',
    });
  }

  const secretRef = connection.secretRef;
  const userId = Number(connection.externalIdentityId);

  const tokenMetadata: VkTargetTokenMetadata = {
    userAccessTokenPresent: secretRef ? await transport.hasSecret(secretRef) : false,
    refreshTokenPresent: await transport.hasSecret(buildSecretRef(connectionId, 'refresh_token')),
    expiresAt: null,
    tokenSource: 'vk_oauth',
  };

  logVkTargetDiscovery('VK_TOKEN_METADATA', {
    connection: connectionId,
    userAccessTokenPresent: tokenMetadata.userAccessTokenPresent,
    refreshTokenPresent: tokenMetadata.refreshTokenPresent,
    expiresAt: tokenMetadata.expiresAt,
    tokenSource: tokenMetadata.tokenSource,
  });

  if (!secretRef || !tokenMetadata.userAccessTokenPresent || !userId) {
    return {
      targets: [],
      discoveryState: 'failed',
      selfWall: { available: false, reason: 'token_missing' },
      groups: { status: 'skipped', count: 0, method: 'groups.get' },
      notices: [],
      tokenMetadata,
      emptyReason: 'TOKEN_INVALID',
      fatalError: 'Авторизация ВКонтакте устарела. Подключите аккаунт заново.',
      scopes: scopeAnalysis,
      publishCapabilities,
    };
  }

  let user: VkUserInfo;
  try {
    user = await transport.getUserInfo(secretRef, userId);
    logVkTargetDiscovery('VK_PROFILE', {
      connection: connectionId,
      stage: 'publication_target_discovery',
      result: 'success',
      method: 'users.get',
      userId,
    });
  } catch (error) {
    const parsed = parseTransportError(error);
    logVkTargetDiscovery('VK_PROFILE', {
      connection: connectionId,
      stage: 'publication_target_discovery',
      result: 'error',
      method: 'users.get',
      vkErrorCode: parsed.vkErrorCode,
      vkErrorMessage: parsed.vkErrorMessage,
    });
    if (isTokenInvalidError(error)) {
      return {
        targets: [],
        discoveryState: 'failed',
        selfWall: { available: false, reason: parsed.vkErrorMessage },
        groups: { status: 'skipped', count: 0, method: 'groups.get' },
        notices: [],
        tokenMetadata,
        emptyReason: 'TOKEN_INVALID',
        fatalError: 'Авторизация ВКонтакте устарела. Подключите аккаунт заново.',
        scopes: scopeAnalysis,
        publishCapabilities,
      };
    }
    user = userFromConnection(connection);
  }

  let selfCapability: VkPublicationCapability = { canPost: true };
  try {
    selfCapability = await transport.checkPublicationTarget(
      secretRef,
      'self_wall',
      userIdToOwnerId(userId),
    );
  } catch (error) {
    const parsed = parseTransportError(error);
    logVkTargetDiscovery('VK_SELF_TARGET', {
      connection: connectionId,
      available: false,
      reason: parsed.vkErrorMessage,
      vkErrorCode: parsed.vkErrorCode,
    });
    selfCapability = {
      canPost: false,
      reason: parsed.vkErrorMessage ?? 'Не удалось проверить права на личную стену.',
    };
  }

  logVkTargetDiscovery('VK_SELF_TARGET', {
    connection: connectionId,
    available: selfCapability.canPost,
    reason: selfCapability.reason ?? null,
  });

  const targets: VkTargetCandidate[] = [
    {
      targetType: 'self_wall',
      ownerId: userIdToOwnerId(userId),
      displayName: `${user.firstName} ${user.lastName}`.trim() || connection.displayName || 'Моя страница',
      screenName: user.screenName,
      avatarUrl: user.photoUrl,
      destinationKindLabel: 'Моя страница',
      canPost: selfCapability.canPost,
      postAsGroup: false,
    },
  ];

  const notices: string[] = [];
  if (scopeAnalysis && !scopeAnalysis.hasGroups) {
    notices.push(
      'ВКонтакте подключён, но Reizoko пока не имеет доступа к вашим сообществам. Чтобы выбирать группы для публикации, разрешите Reizoko доступ к сообществам.',
    );
  }
  let groups: VkTargetDiscoveryResult['groups'] = {
    status: 'success',
    count: 0,
    method: 'groups.get',
  };

  try {
    if (scopeAnalysis && !scopeAnalysis.hasGroups) {
      groups = {
        status: 'failed',
        count: 0,
        method: 'groups.get',
        failureKind: 'MISSING_GROUPS_PERMISSION',
      };
      logVkTargetDiscovery('VK_GROUPS_REQUEST', {
        connection: connectionId,
        stage: 'publication_target_discovery',
        result: 'skipped',
        method: 'groups.get',
        failureKind: 'MISSING_GROUPS_PERMISSION',
        reason: 'missing_groups_scope',
      });
    } else {
    const communities = await transport.listManageableCommunities(secretRef);
    groups = { status: 'success', count: communities.length, method: 'groups.get' };
    logVkTargetDiscovery('VK_GROUPS_REQUEST', {
      connection: connectionId,
      stage: 'publication_target_discovery',
      result: 'success',
      method: 'groups.get',
      count: communities.length,
    });

    for (const community of communities) {
      const ownerId = communityIdToOwnerId(community.id);
      let capability: VkPublicationCapability = { canPost: community.canPost ?? false };
      try {
        capability = await transport.checkPublicationTarget(secretRef, 'community_wall', ownerId, {
          communityId: community.id,
          postAsGroup: true,
        });
      } catch {
        capability = {
          canPost: community.canPost ?? false,
          canPostAsGroup: true,
        };
      }

      targets.push({
        targetType: 'community_wall',
        ownerId,
        communityId: community.id,
        displayName: community.name,
        screenName: community.screenName,
        avatarUrl: community.photoUrl,
        destinationKindLabel: 'Сообщество',
        canPost: capability.canPost,
        canPostAsGroup: capability.canPostAsGroup,
        postAsGroup: capability.canPostAsGroup ?? true,
      });
    }
    }
  } catch (error) {
    const parsed = parseTransportError(error);
    const failure = classifyGroupsFailure(parsed, scopeAnalysis);
    groups = {
      status: 'failed',
      count: 0,
      method: 'groups.get',
      vkErrorCode: parsed.vkErrorCode,
      vkErrorMessage: parsed.vkErrorMessage,
      failureKind: failure.failureKind,
    };
    logVkTargetDiscovery('VK_GROUPS_REQUEST', {
      connection: connectionId,
      stage: 'publication_target_discovery',
      result: 'error',
      method: 'groups.get',
      vkErrorCode: parsed.vkErrorCode,
      vkErrorMessage: parsed.vkErrorMessage,
      failureKind: failure.failureKind,
      httpStatus: null,
      requiredPermission: 'groups',
    });

    if (isTokenInvalidError(error)) {
      return {
        targets,
        discoveryState: 'partial',
        selfWall: { available: selfCapability.canPost, reason: selfCapability.reason },
        groups,
        notices,
        tokenMetadata,
        emptyReason: 'TOKEN_INVALID',
        fatalError: 'Авторизация ВКонтакте устарела. Подключите аккаунт заново.',
        scopes: scopeAnalysis,
        publishCapabilities,
      };
    }

    if (!notices.some((item) => item.includes('сообществ'))) {
      notices.push(failure.notice);
    }
  }

  const postableTargets = targets.filter((target) => target.canPost);
  const discoveryState =
    groups.status === 'failed' ? 'partial' : postableTargets.length > 0 ? 'success' : 'partial';

  logVkTargetDiscovery('VK_TARGET_DISCOVERY_END', {
    connection: connectionId,
    availableTargets: postableTargets.length,
    totalTargets: targets.length,
    alreadyConnected: 'computed_in_ui',
    discoveryState,
  });

  return {
    targets,
    discoveryState,
    selfWall: { available: selfCapability.canPost, reason: selfCapability.reason },
    groups,
    notices,
    tokenMetadata,
    emptyReason: postableTargets.length === 0 ? 'NO_TARGETS_FOUND' : undefined,
    scopes: scopeAnalysis,
    publishCapabilities,
    needsScopeUpgrade: scopeAnalysis?.needsScopeUpgrade ?? false,
  };
}

export function resolveVkTargetEmptyState(input: {
  targets: VkTargetCandidate[];
  existingOwnerIds: string[];
  discovery: VkTargetDiscoveryResult | null;
}): {
  availableTargets: VkTargetCandidate[];
  emptyReason?: VkTargetDiscoveryEmptyReason;
  emptyMessage?: string;
} {
  const availableTargets = input.targets.filter(
    (target) => target.canPost && !input.existingOwnerIds.includes(String(target.ownerId)),
  );

  if (availableTargets.length > 0) {
    return { availableTargets };
  }

  const postableTargets = input.targets.filter((target) => target.canPost);
  if (postableTargets.length > 0) {
    return {
      availableTargets,
      emptyReason: 'ALL_TARGETS_ALREADY_CONNECTED',
      emptyMessage: 'Все найденные доступные места публикации уже подключены.',
    };
  }

  if (input.discovery?.groups.status === 'failed') {
    return {
      availableTargets,
      emptyReason: 'TARGET_DISCOVERY_FAILED',
      emptyMessage:
        input.discovery.notices[0] ??
        'Не удалось автоматически получить доступные сообщества. Вы всё равно можете добавить стену вручную.',
    };
  }

  if (input.discovery?.selfWall.available === false) {
    return {
      availableTargets,
      emptyReason: 'NO_TARGETS_FOUND',
      emptyMessage:
        input.discovery.selfWall.reason ??
        'С текущим подключением ВКонтакте не удалось подтвердить публикацию на личную стену.',
    };
  }

  return {
    availableTargets,
    emptyReason: 'NO_TARGETS_FOUND',
    emptyMessage: 'У этого аккаунта не найдено доступных мест публикации.',
  };
}
