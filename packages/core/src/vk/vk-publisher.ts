import {
  nowIso,
  parseVkPublicationTargetMetadata,
  type PreparedPublicationSnapshot,
  type Publication,
} from '@reizoko/shared';
import type { PlatformConnection, SocialAccount, PublishResult } from '@reizoko/shared';
import {
  buildVkRemotePostId,
  buildVkRemoteUrl,
  isCommunityOwnerId,
  ownerIdToCommunityId,
} from './vk-owner-id.js';
import { VK_WALL_ATTACHMENTS_MAX, type VkTransport } from './vk-transport.js';
import { VkTransportError, toUserFacingVkError } from './vk-api-errors.js';
import { isCommunityCredentialConnection } from './vk-community-token.js';

export interface VkPublishInput {
  publication: Publication;
  account: SocialAccount;
  connection: PlatformConnection;
  mediaPaths: Record<string, string>;
  userOAuthSecretRef?: string | null;
}

const COMMUNITY_TOKEN_REVOKED_MESSAGE =
  'Ключ доступа сообщества больше не действует. Создайте новый ключ в настройках сообщества VK и замените его в Reizoko.';

const COMMUNITY_PHOTO_UNAVAILABLE_MESSAGE =
  'Для этого сообщества можно опубликовать текст, но VK не разрешает загрузку изображений через используемый ключ сообщества. Подключите пользовательский доступ VK, чтобы публиковать изображения.';

export class VkPublisher {
  readonly platformId = 'vk';

  constructor(private readonly transport: VkTransport) {}

  async publish(input: VkPublishInput): Promise<PublishResult> {
    const { publication, account, connection, mediaPaths, userOAuthSecretRef } = input;
    if (!connection.secretRef) {
      return this.failure(
        isCommunityCredentialConnection(connection)
          ? COMMUNITY_TOKEN_REVOKED_MESSAGE
          : 'Требуется повторное подключение ВКонтакте.',
      );
    }

    const metadata = parseVkPublicationTargetMetadata(account.platformMetadataJson);
    if (!metadata) {
      return this.failure('У аккаунта ВКонтакте не задано место публикации.');
    }

    const snapshot = publication.preparedSnapshot;
    const errors = snapshot.validationIssues.filter((issue) => issue.severity === 'error');
    if (errors.length > 0) {
      return this.failure(errors.map((issue) => issue.message).join(' '));
    }

    const isCommunityToken =
      metadata.credentialKind === 'community_token' || isCommunityCredentialConnection(connection);
    const photos = this.resolvePhotos(snapshot, mediaPaths, metadata, isCommunityToken, userOAuthSecretRef);
    if (photos.error) {
      return this.failure(photos.error);
    }

    if (!isCommunityToken) {
      const capability = await this.transport.checkPublicationTarget(
        connection.secretRef,
        metadata.targetType,
        metadata.ownerId,
        {
          communityId: metadata.communityId,
          postAsGroup: metadata.postAsGroup,
        },
      );
      if (!capability.canPost) {
        return this.failure(
          capability.reason ??
            'На эту стену нельзя публиковать через подключённый аккаунт ВКонтакте.',
        );
      }
    } else if (metadata.capabilities && !metadata.capabilities.canPublishText) {
      return this.failure('У ключа сообщества нет права «Стена» для публикации.');
    }

    const fromGroup =
      metadata.targetType === 'community_wall' &&
      (metadata.postAsGroup ?? true) &&
      (isCommunityOwnerId(metadata.ownerId) || isCommunityToken);

    try {
      const result = await this.transport.publishWallPost(connection.secretRef, {
        secretRef: connection.secretRef,
        ownerId: metadata.ownerId,
        message: snapshot.transformedContent.text,
        fromGroup: isCommunityToken ? true : fromGroup,
        groupId: ownerIdToCommunityId(metadata.ownerId),
        photos: photos.items,
        photoUploadSecretRef: photos.uploadSecretRef,
      });

      const remotePostId = buildVkRemotePostId(result.ownerId, result.postId);
      return {
        success: true,
        remotePostId,
        remoteUrl: buildVkRemoteUrl(result.ownerId, result.postId),
        publishedAt: nowIso(),
        platformResponseMetadata: {
          ownerId: result.ownerId,
          postId: result.postId,
          targetType: metadata.targetType,
          credentialKind: metadata.credentialKind ?? (isCommunityToken ? 'community_token' : 'user_oauth'),
        },
      };
    } catch (error) {
      return this.mapPublishError(error, isCommunityToken);
    }
  }

  private resolvePhotos(
    snapshot: PreparedPublicationSnapshot,
    mediaPaths: Record<string, string>,
    metadata: NonNullable<ReturnType<typeof parseVkPublicationTargetMetadata>>,
    isCommunityToken: boolean,
    userOAuthSecretRef?: string | null,
  ): {
    items: Array<{ mediaId: string; localPath: string }>;
    uploadSecretRef?: string | null;
    error?: string;
  } {
    const items: Array<{ mediaId: string; localPath: string }> = [];
    for (const image of snapshot.transformedContent.images) {
      const localPath = mediaPaths[image.mediaId];
      if (!localPath) {
        return { items: [], error: 'Не найден локальный медиафайл.' };
      }
      items.push({ mediaId: image.mediaId, localPath });
    }
    if (items.length > VK_WALL_ATTACHMENTS_MAX) {
      return {
        items: [],
        error: `ВКонтакте поддерживает не более ${VK_WALL_ATTACHMENTS_MAX} изображений в одной записи.`,
      };
    }
    if (items.length === 0) {
      return { items };
    }

    if (!isCommunityToken) {
      return { items };
    }

    const capabilities = metadata.capabilities;
    if (!capabilities?.canPublishPhotos) {
      return { items: [], error: COMMUNITY_PHOTO_UNAVAILABLE_MESSAGE };
    }
    if (capabilities.photoUploadVia === 'user_oauth' && userOAuthSecretRef) {
      return { items, uploadSecretRef: userOAuthSecretRef };
    }
    if (userOAuthSecretRef) {
      return { items, uploadSecretRef: userOAuthSecretRef };
    }
    return { items };
  }

  private mapPublishError(error: unknown, isCommunityToken: boolean): PublishResult {
    const message =
      error instanceof VkTransportError ? error.userMessage : toUserFacingVkError(error);
    const unauthorized = error instanceof VkTransportError ? error.unauthorized : false;
    if (isCommunityToken && unauthorized) {
      return this.failure(COMMUNITY_TOKEN_REVOKED_MESSAGE, { unauthorized: true });
    }
    return {
      success: false,
      errorMessage: message,
      retryable: error instanceof VkTransportError ? error.retryable : false,
      platformResponseMetadata: { unauthorized, raw: message },
    };
  }

  private failure(
    errorMessage: string,
    metadata?: { unauthorized?: boolean },
  ): PublishResult {
    return {
      success: false,
      errorMessage,
      retryable: false,
      platformResponseMetadata: metadata,
    };
  }
}
