import {
  buildSecretRef,
  generateId,
  nowIso,
  serializeVkPublicationTargetMetadata,
  type PlatformConnection,
  type SocialAccount,
  type VkPublicationTargetMetadata,
} from '@reizoko/shared';

import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';
import type { SocialAccountRepository } from '../social-account/social-account-repository.js';
import { ConnectionSecretMissingError } from '../telegram/connection-errors.js';
import {
  assertCommunityVerificationReady,
  buildCommunityCapabilities,
  communityConnectionInputFromHandle,
  isCommunityCredentialConnection,
  validateCommunityAccessTokenFormat,
  type VkCommunityTokenVerification,
} from './vk-community-token.js';
import {
  communityIdToOwnerId,
  userIdToOwnerId,
} from './vk-owner-id.js';
import type {
  VkPublicationCapability,
  VkTransport,
  VkUserInfo,
  VkCommunityTokenVerification,
} from './vk-transport.js';
import { normalizeVkWallInput, isNumericVkId } from './vk-wall-input.js';
import {
  discoverVkPublicationTargets,
  type VkTargetCandidate,
  type VkTargetDiscoveryResult,
} from './vk-target-discovery.js';
import type { VkOAuthConnectionMeta } from './vk-scopes.js';
import { VK_OAUTH_API_SCOPES } from './vk-scopes.js';

export interface VkConnectionResult {
  connection: PlatformConnection;
  user: VkUserInfo;
  oauthMeta?: import('./vk-scopes.js').VkOAuthConnectionMeta;
}

export type { VkTargetCandidate, VkTargetDiscoveryResult } from './vk-target-discovery.js';

export interface VkAddTargetsInput {
  connectionId: string;
  targets: VkTargetCandidate[];
}

export class VkConnectionService {
  constructor(
    private readonly connections: PlatformConnectionRepository,
    private readonly socialAccounts: SocialAccountRepository,
    private readonly transport: VkTransport,
  ) {}

  async connectOAuth(
    config: {
      appId: string;
      serverBaseUrl: string;
      redirectUri: string;
    },
    scopes: string[],
    existingConnectionId?: string | null,
    options?: { forceConsent?: boolean },
  ): Promise<VkConnectionResult> {
    const sessionConnectionId = existingConnectionId ?? generateId();
    const sessionSecretRef = buildSecretRef(sessionConnectionId, 'access_token');

    const oauthResult = await this.transport.startOAuth({
      connectionId: sessionConnectionId,
      appId: config.appId,
      serverBaseUrl: config.serverBaseUrl,
      redirectUri: config.redirectUri,
      scopes,
      forceConsent: options?.forceConsent ?? Boolean(existingConnectionId),
    });
    const user =
      oauthResult.profile ??
      (oauthResult.userId > 0
        ? await this.transport.getUserInfo(sessionSecretRef, oauthResult.userId)
        : await this.transport.getCurrentUser(sessionSecretRef));

    let targetConnectionId = sessionConnectionId;
    let targetSecretRef = sessionSecretRef;

    if (existingConnectionId) {
      const existingTarget = await this.connections.getById(existingConnectionId);
      if (
        existingTarget?.externalIdentityId &&
        existingTarget.externalIdentityId !== String(user.id)
      ) {
        await this.transport.deleteSecret(sessionSecretRef).catch(() => undefined);
        throw new Error('Подключён другой аккаунт ВКонтакте. Создайте новое подключение.');
      }
      targetConnectionId = existingConnectionId;
      targetSecretRef = existingTarget?.secretRef ?? buildSecretRef(existingConnectionId, 'access_token');
    } else {
      const duplicate = await this.findOAuthConnectionByUserId(String(user.id));
      if (duplicate && duplicate.id !== sessionConnectionId) {
        targetConnectionId = duplicate.id;
        targetSecretRef = duplicate.secretRef ?? buildSecretRef(duplicate.id, 'access_token');
      }
    }

    if (targetSecretRef !== sessionSecretRef) {
      await this.storeAccessToken(targetSecretRef, oauthResult.accessToken);
      await this.transport.deleteSecret(sessionSecretRef).catch(() => undefined);
    } else {
      await this.storeAccessToken(targetSecretRef, oauthResult.accessToken);
    }

    const now = nowIso();
    const displayName = `${user.firstName} ${user.lastName}`.trim();
    const handle = user.screenName ? `vk.com/${user.screenName}` : null;
    const existing = await this.connections.getById(targetConnectionId);

    const missingApiScopes =
      oauthResult.oauthMeta?.missingScopes.filter((scope) =>
        (VK_OAUTH_API_SCOPES as readonly string[]).includes(scope),
      ) ?? [];

    const payload: PlatformConnection = {
      id: targetConnectionId,
      platformId: 'vk',
      method: 'oauth_system_browser',
      state: 'connected',
      externalIdentityId: String(user.id),
      displayName,
      handle,
      connectedAt: existing?.connectedAt ?? now,
      lastValidatedAt: now,
      secretRef: targetSecretRef,
      errorCode: missingApiScopes.length > 0 ? 'missing_scopes' : null,
      errorMessage:
        missingApiScopes.length > 0
          ? `Требуется обновить разрешения: ${missingApiScopes.join(', ')}`
          : null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const connection = existing
      ? await this.connections.update(targetConnectionId, payload)
      : await this.connections.create(payload);

    return { connection, user, oauthMeta: oauthResult.oauthMeta };
  }

  async listAvailableTargets(
    connectionId: string,
    oauthMeta?: VkOAuthConnectionMeta | null,
  ): Promise<VkTargetDiscoveryResult> {
    const connection = await this.requireHealthyConnection(connectionId);
    return discoverVkPublicationTargets(connection, this.transport, oauthMeta);
  }

  async verifyCommunityToken(input: {
    communityInput: string;
    accessToken: string;
    userOAuthSecretRef?: string | null;
  }): Promise<VkCommunityTokenVerification> {
    const formatError = validateCommunityAccessTokenFormat(input.accessToken);
    if (formatError) {
      throw new Error(formatError);
    }

    let communityInput = input.communityInput;
    const normalizedCommunity = normalizeVkWallInput(input.communityInput);
    if (input.userOAuthSecretRef && normalizedCommunity && !isNumericVkId(normalizedCommunity)) {
      try {
        const resolved = await this.transport.resolveScreenName(
          input.userOAuthSecretRef,
          normalizedCommunity,
        );
        if (resolved.type === 'group' || resolved.type === 'page') {
          communityInput = String(resolved.objectId);
        }
      } catch {
        // Fall back to resolving with the community token in native verification.
      }
    }

    const verification = await this.transport.verifyCommunityToken({
      communityInput,
      accessToken: input.accessToken.trim(),
    });
    const readinessError = assertCommunityVerificationReady(verification);
    if (readinessError) {
      throw new Error(readinessError);
    }

    if (
      verification.permissions.includes('photos') &&
      input.userOAuthSecretRef &&
      (verification.capabilities.photoUploadVia === 'none' ||
        verification.photoUploadErrorCode != null)
    ) {
      const userProbe = await this.transport.probeCommunityPhotoUploadBySecretRef({
        secretRef: input.userOAuthSecretRef,
        communityId: verification.communityId,
      });
      if (userProbe.available) {
        verification.capabilities = buildCommunityCapabilities({
          permissions: verification.permissions,
          canUploadPhotos: true,
          photoUploadVia: 'user_oauth',
          photoUploadErrorCode: verification.photoUploadErrorCode,
          photoUploadErrorMessage: verification.photoUploadErrorMessage,
        });
      }
    }

    return verification;
  }

  async connectCommunityToken(input: {
    verification: VkCommunityTokenVerification;
    accessToken: string;
  }): Promise<{ connection: PlatformConnection; account: SocialAccount }> {
    const formatError = validateCommunityAccessTokenFormat(input.accessToken);
    if (formatError) {
      throw new Error(formatError);
    }
    const readinessError = assertCommunityVerificationReady(input.verification);
    if (readinessError) {
      throw new Error(readinessError);
    }

    const existingCommunity = await this.findCommunityConnectionByCommunityId(
      input.verification.communityId,
    );
    if (existingCommunity) {
      return this.reconnectCommunityToken(existingCommunity, input);
    }

    const connectionId = generateId();
    const secretRef = buildSecretRef(connectionId, 'community_token');
    await this.transport.deleteSecret(secretRef).catch(() => undefined);
    await this.storeCommunityToken(secretRef, input.accessToken.trim());

    const now = nowIso();
    const handle = input.verification.screenName
      ? `vk.com/${input.verification.screenName}`
      : `vk.com/club${input.verification.communityId}`;
    const connection = await this.connections.create({
      id: connectionId,
      platformId: 'vk',
      method: 'manual_secret',
      state: 'connected',
      externalIdentityId: String(input.verification.communityId),
      displayName: input.verification.displayName,
      handle,
      connectedAt: now,
      lastValidatedAt: now,
      secretRef,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    });

    const metadata: VkPublicationTargetMetadata = {
      targetType: 'community_wall',
      ownerId: input.verification.ownerId,
      communityId: input.verification.communityId,
      postAsGroup: true,
      avatarUrl: input.verification.avatarUrl,
      destinationKindLabel: 'Сообщество',
      credentialKind: 'community_token',
      capabilities: input.verification.capabilities,
    };

    const account = await this.socialAccounts.create({
      platformId: 'vk',
      displayName: input.verification.displayName,
      handle,
      connectionId: connection.id,
      externalAccountId: String(input.verification.ownerId),
      platformMetadataJson: serializeVkPublicationTargetMetadata(metadata),
    });

    return { connection, account };
  }

  async replaceCommunityToken(connectionId: string, accessToken: string): Promise<PlatformConnection> {
    const formatError = validateCommunityAccessTokenFormat(accessToken);
    if (formatError) {
      throw new Error(formatError);
    }
    const connection = await this.connections.getById(connectionId);
    if (!connection || connection.platformId !== 'vk' || connection.method !== 'manual_secret') {
      throw new Error('Подключение сообщества не найдено.');
    }
    const secretRef = connection.secretRef ?? buildSecretRef(connectionId, 'community_token');
    await this.storeCommunityToken(secretRef, accessToken.trim());
    return this.connections.update(connectionId, {
      state: 'connected',
      secretRef,
      errorCode: null,
      errorMessage: null,
      lastValidatedAt: nowIso(),
    });
  }

  async refreshCommunityTokenStatus(connectionId: string): Promise<VkCommunityTokenVerification> {
    const connection = await this.connections.getById(connectionId);
    if (!connection || !isCommunityCredentialConnection(connection)) {
      throw new Error('Подключение сообщества не найдено.');
    }
    const secretRef = connection.secretRef ?? buildSecretRef(connectionId, 'community_token');
    if (!(await this.transport.hasSecret(secretRef))) {
      throw new ConnectionSecretMissingError('vk');
    }
    const accessToken = (await this.transport.getSecret(secretRef))?.trim();
    if (!accessToken) {
      throw new ConnectionSecretMissingError('vk');
    }
    const communityInput = communityConnectionInputFromHandle(
      connection.handle,
      connection.externalIdentityId,
    );
    if (!communityInput) {
      throw new Error('Не удалось определить сообщество для проверки ключа.');
    }
    const userOAuth = await this.findUserOAuthConnection();
    const verification = await this.verifyCommunityToken({
      communityInput,
      accessToken,
      userOAuthSecretRef: userOAuth?.secretRef ?? null,
    });
    await this.reconnectCommunityToken(connection, { verification, accessToken });
    return verification;
  }

  async findUserOAuthConnection(): Promise<PlatformConnection | null> {
    const connections = await this.connections.listByPlatform('vk');
    const oauthConnections = connections.filter(
      (item) => item.method === 'oauth_system_browser' && item.state === 'connected' && item.secretRef,
    );
    if (oauthConnections.length === 0) return null;
    if (oauthConnections.length === 1) return oauthConnections[0];

    const byUserId = new Map<string, PlatformConnection>();
    for (const connection of oauthConnections) {
      if (!connection.externalIdentityId) continue;
      const current = byUserId.get(connection.externalIdentityId);
      if (!current || this.preferConnection(connection, current)) {
        byUserId.set(connection.externalIdentityId, connection);
      }
    }
    return byUserId.values().next().value ?? oauthConnections[0];
  }

  private preferConnection(candidate: PlatformConnection, current: PlatformConnection): boolean {
    const score = (connection: PlatformConnection) =>
      (connection.state === 'connected' ? 2 : 0) +
      (connection.secretRef ? 1 : 0) +
      (connection.lastValidatedAt ? 0.001 : 0);
    const candidateScore = score(candidate);
    const currentScore = score(current);
    if (candidateScore !== currentScore) return candidateScore > currentScore;
    return (candidate.updatedAt ?? '') > (current.updatedAt ?? '');
  }

  private async findOAuthConnectionByUserId(userId: string): Promise<PlatformConnection | null> {
    const connections = await this.connections.listByPlatform('vk');
    const matches = connections.filter(
      (item) => item.method === 'oauth_system_browser' && item.externalIdentityId === userId,
    );
    if (matches.length === 0) return null;
    return matches.reduce((best, item) => (this.preferConnection(item, best) ? item : best));
  }

  private async findCommunityConnectionByCommunityId(
    communityId: number,
  ): Promise<PlatformConnection | null> {
    const connections = await this.connections.listByPlatform('vk');
    const matches = connections.filter(
      (item) =>
        isCommunityCredentialConnection(item) &&
        item.externalIdentityId === String(communityId),
    );
    if (matches.length === 0) return null;
    return matches.reduce((best, item) => (this.preferConnection(item, best) ? item : best));
  }

  private async reconnectCommunityToken(
    existingCommunity: PlatformConnection,
    input: {
      verification: VkCommunityTokenVerification;
      accessToken: string;
    },
  ): Promise<{ connection: PlatformConnection; account: SocialAccount }> {
    const secretRef =
      existingCommunity.secretRef ?? buildSecretRef(existingCommunity.id, 'community_token');
    await this.storeCommunityToken(secretRef, input.accessToken.trim());

    const now = nowIso();
    const handle = input.verification.screenName
      ? `vk.com/${input.verification.screenName}`
      : `vk.com/club${input.verification.communityId}`;
    const connection = await this.connections.update(existingCommunity.id, {
      state: 'connected',
      displayName: input.verification.displayName,
      handle,
      secretRef,
      errorCode: null,
      errorMessage: null,
      lastValidatedAt: now,
    });

    const metadata: VkPublicationTargetMetadata = {
      targetType: 'community_wall',
      ownerId: input.verification.ownerId,
      communityId: input.verification.communityId,
      postAsGroup: true,
      avatarUrl: input.verification.avatarUrl,
      destinationKindLabel: 'Сообщество',
      credentialKind: 'community_token',
      capabilities: input.verification.capabilities,
    };
    const metadataJson = serializeVkPublicationTargetMetadata(metadata);
    const accounts = await this.socialAccounts.listByConnectionId(connection.id);
    const existingAccount = accounts.find(
      (account) => account.externalAccountId === String(input.verification.ownerId),
    );
    if (existingAccount) {
      const account = await this.socialAccounts.update(existingAccount.id, {
        displayName: input.verification.displayName,
        handle,
        platformMetadataJson: metadataJson,
      });
      return { connection, account };
    }

    const account = await this.socialAccounts.create({
      platformId: 'vk',
      displayName: input.verification.displayName,
      handle,
      connectionId: connection.id,
      externalAccountId: String(input.verification.ownerId),
      platformMetadataJson: metadataJson,
    });
    return { connection, account };
  }

  private async storeAccessToken(secretRef: string, accessToken: string): Promise<void> {
    await this.transport.deleteSecret(secretRef).catch(() => undefined);
    await this.transport.storeSecret(secretRef, accessToken);
    const secretExists = await this.transport.hasSecret(secretRef);
    if (!secretExists) {
      throw new Error('SECRET_STORE_VERIFY_FAILED');
    }
  }

  private async storeCommunityToken(secretRef: string, token: string): Promise<void> {
    await this.transport.deleteSecret(secretRef).catch(() => undefined);
    await this.transport.storeSecret(secretRef, token);
    const secretExists = await this.transport.hasSecret(secretRef);
    if (!secretExists) {
      throw new Error('SECRET_STORE_VERIFY_FAILED');
    }
  }

  async resolveExternalWall(
    connectionId: string,
    rawInput: string,
  ): Promise<VkTargetCandidate> {
    const connection = await this.requireHealthyConnection(connectionId);
    const secretRef = connection.secretRef!;
    const normalized = normalizeVkWallInput(rawInput);
    if (!normalized) {
      throw new Error('Укажите ссылку, короткое имя или ID страницы ВКонтакте.');
    }

    const resolved = await this.transport.resolveScreenName(secretRef, normalized);
    const selfUserId = Number(connection.externalIdentityId);

    if (resolved.type === 'user' && resolved.objectId === selfUserId) {
      const user = await this.transport.getCurrentUser(secretRef);
      const capability = await this.transport.checkPublicationTarget(
        secretRef,
        'self_wall',
        userIdToOwnerId(selfUserId),
      );
      return {
        targetType: 'self_wall',
        ownerId: userIdToOwnerId(selfUserId),
        displayName: `${user.firstName} ${user.lastName}`.trim(),
        screenName: user.screenName,
        avatarUrl: user.photoUrl,
        destinationKindLabel: 'Моя страница',
        canPost: capability.canPost,
        reason: capability.reason,
      } as VkTargetCandidate & { reason?: string };
    }

    if (resolved.type === 'group' || resolved.type === 'page') {
      const community = await this.transport.getCommunityInfo(secretRef, resolved.objectId);
      const ownerId = communityIdToOwnerId(community.id);
      const capability = await this.transport.checkPublicationTarget(
        secretRef,
        'community_wall',
        ownerId,
        { communityId: community.id, postAsGroup: true },
      );
      return {
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
      };
    }

    const user = await this.transport.getUserInfo(secretRef, resolved.objectId);
    const ownerId = userIdToOwnerId(user.id);
    const capability = await this.transport.checkPublicationTarget(
      secretRef,
      'user_wall',
      ownerId,
    );

    return {
      targetType: 'user_wall',
      ownerId,
      displayName: `${user.firstName} ${user.lastName}`.trim(),
      screenName: user.screenName,
      avatarUrl: user.photoUrl,
      destinationKindLabel: 'Стена пользователя',
      canPost: capability.canPost,
    };
  }

  async addPublicationTargets(input: VkAddTargetsInput): Promise<SocialAccount[]> {
    const connection = await this.requireHealthyConnection(input.connectionId);
    const existing = await this.socialAccounts.listByConnectionId(connection.id);
    const created: SocialAccount[] = [];

    for (const target of input.targets) {
      if (!target.canPost) continue;

      const duplicate = existing.find((account) => {
        if (account.platformId !== 'vk') return false;
        return account.externalAccountId === String(target.ownerId);
      });
      if (duplicate) continue;

      const metadata: VkPublicationTargetMetadata = {
        targetType: target.targetType,
        ownerId: target.ownerId,
        communityId: target.communityId,
        postAsGroup: target.targetType === 'community_wall' ? (target.postAsGroup ?? true) : false,
        avatarUrl: target.avatarUrl,
        destinationKindLabel: target.destinationKindLabel,
      };

      const handle = target.screenName ? `vk.com/${target.screenName}` : null;
      const account = await this.socialAccounts.create({
        platformId: 'vk',
        displayName: target.displayName,
        handle,
        connectionId: connection.id,
        externalAccountId: String(target.ownerId),
        platformMetadataJson: serializeVkPublicationTargetMetadata(metadata),
      });
      created.push(account);
      existing.push(account);
    }

    return created;
  }

  async updateTargetPostAsGroup(accountId: string, postAsGroup: boolean): Promise<SocialAccount> {
    const account = await this.socialAccounts.getById(accountId);
    if (!account || account.platformId !== 'vk') {
      throw new Error('VK target not found');
    }
    const metadata = account.platformMetadataJson
      ? JSON.parse(account.platformMetadataJson)
      : null;
    const vk = metadata?.vk;
    if (!vk || vk.targetType !== 'community_wall') {
      throw new Error('Настройка доступна только для сообществ ВКонтакте.');
    }
    vk.postAsGroup = postAsGroup;
    return this.socialAccounts.update(accountId, {
      platformMetadataJson: JSON.stringify({ vk }),
    });
  }

  async checkPublicationTargetForAccount(
    connection: PlatformConnection,
    account: SocialAccount,
  ): Promise<VkPublicationCapability> {
    if (!connection.secretRef || !account.platformMetadataJson) {
      return { canPost: false, reason: 'не подключён' };
    }
    const parsed = JSON.parse(account.platformMetadataJson) as { vk: VkPublicationTargetMetadata };
    const vk = parsed.vk;
    return this.transport.checkPublicationTarget(
      connection.secretRef,
      vk.targetType,
      vk.ownerId,
      { communityId: vk.communityId, postAsGroup: vk.postAsGroup },
    );
  }

  async verifyConnectionHealth(connection: PlatformConnection): Promise<PlatformConnection> {
    if (connection.state !== 'connected' || !connection.secretRef) {
      return connection;
    }
    const secretExists = await this.transport.hasSecret(connection.secretRef);
    if (secretExists) {
      return connection;
    }
    return this.connections.update(connection.id, {
      state: 'needs_reconnect',
      errorCode: 'secret_missing',
      errorMessage: null,
      lastValidatedAt: null,
    });
  }

  async markCredentialInvalid(connectionId: string, errorCode: string): Promise<PlatformConnection> {
    const existing = await this.connections.getById(connectionId);
    if (!existing) throw new Error(`Connection ${connectionId} not found`);
    return this.connections.update(connectionId, {
      state: 'needs_reconnect',
      errorCode,
      errorMessage: null,
      lastValidatedAt: null,
    });
  }

  async disconnect(connectionId: string): Promise<PlatformConnection> {
    const existing = await this.connections.getById(connectionId);
    if (!existing) throw new Error(`Connection ${connectionId} not found`);
    if (existing.secretRef) {
      await this.transport.deleteSecret(existing.secretRef);
    }
    return this.connections.update(connectionId, {
      state: 'needs_reconnect',
      secretRef: null,
      connectedAt: null,
      lastValidatedAt: null,
      errorCode: null,
      errorMessage: null,
    });
  }

  resolveAccountConnectionState(
    account: Pick<SocialAccount, 'connectionId'>,
    connection: PlatformConnection | null,
  ): SocialAccount['connectionState'] {
    if (!account.connectionId) return 'local';
    if (!connection || connection.state !== 'connected') {
      return 'needs_reconnect';
    }
    return 'connected';
  }

  private async requireHealthyConnection(connectionId: string): Promise<PlatformConnection> {
    const connection = await this.connections.getById(connectionId);
    if (!connection) throw new Error('Подключение не найдено');
    const healthy = await this.verifyConnectionHealth(connection);
    if (healthy.state !== 'connected' || !healthy.secretRef || !healthy.externalIdentityId) {
      throw new ConnectionSecretMissingError('vk');
    }
    return healthy;
  }
}
