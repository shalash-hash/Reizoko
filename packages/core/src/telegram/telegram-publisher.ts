import { nowIso, type PreparedPublicationSnapshot, type Publication } from '@reizoko/shared';
import type { PlatformConnection, SocialAccount } from '@reizoko/shared';
import {
  TELEGRAM_MEDIA_GROUP_MAX,
  buildTelegramPublicUrl,
  executeTelegramPublish,
  type TelegramPublishMediaItem,
  type TelegramPublishRequest,
  type TelegramTransport,
} from './telegram-transport.js';
import type { PublishResult } from '@reizoko/shared';

export interface TelegramPublishInput {
  publication: Publication;
  account: SocialAccount;
  connection: PlatformConnection;
  mediaPaths: Record<string, string>;
}

export class TelegramPublisher {
  readonly platformId = 'telegram';

  constructor(private readonly transport: TelegramTransport) {}

  async publish(input: TelegramPublishInput): Promise<PublishResult> {
    const { publication, account, connection, mediaPaths } = input;
    if (!connection.secretRef) {
      return {
        success: false,
        errorMessage: 'Требуется повторное подключение Telegram-бота.',
        retryable: false,
      };
    }
    if (!account.externalAccountId) {
      return {
        success: false,
        errorMessage: 'У аккаунта не задан Telegram chat id.',
        retryable: false,
      };
    }

    const snapshot = publication.preparedSnapshot;
    const errors = snapshot.validationIssues.filter((issue) => issue.severity === 'error');
    if (errors.length > 0) {
      return {
        success: false,
        errorMessage: errors.map((issue) => issue.message).join(' '),
        retryable: false,
      };
    }

    const media = this.resolveMedia(snapshot, mediaPaths);
    if (media.error) {
      return { success: false, errorMessage: media.error, retryable: false };
    }

    const request: TelegramPublishRequest = {
      secretRef: connection.secretRef,
      chatId: account.externalAccountId,
      snapshot,
      media: media.items,
      channelUsername: account.handle?.replace(/^@/, '') ?? null,
    };

    const response = await executeTelegramPublish(this.transport, request);
    if (!response.success) {
      return {
        success: false,
        errorMessage: response.errorMessage ?? 'Не удалось опубликовать в Telegram.',
        retryable: Boolean(response.retryAfterSeconds),
        platformResponseMetadata: {
          errorCode: response.errorCode,
          retryAfterSeconds: response.retryAfterSeconds,
          unauthorized: response.unauthorized,
        },
      };
    }

    const primaryMessageId = response.messageIds[0];
    return {
      success: true,
      remotePostId: primaryMessageId != null ? String(primaryMessageId) : null,
      remoteUrl:
        response.remoteUrl ??
        (primaryMessageId != null
          ? buildTelegramPublicUrl(account.handle, primaryMessageId)
          : null),
      publishedAt: nowIso(),
      platformResponseMetadata: response.metadata ?? { messageIds: response.messageIds },
    };
  }

  private resolveMedia(
    snapshot: PreparedPublicationSnapshot,
    mediaPaths: Record<string, string>,
  ): { items: TelegramPublishMediaItem[]; error?: string } {
    const items: TelegramPublishMediaItem[] = [];
    for (const image of snapshot.transformedContent.images) {
      const localPath = mediaPaths[image.mediaId];
      if (!localPath) {
        return { items: [], error: 'Не найден локальный медиафайл.' };
      }
      items.push({ mediaId: image.mediaId, localPath });
    }
    if (items.length > TELEGRAM_MEDIA_GROUP_MAX) {
      return {
        items: [],
        error: `Telegram поддерживает не более ${TELEGRAM_MEDIA_GROUP_MAX} изображений в одной группе.`,
      };
    }
    return { items };
  }
}
