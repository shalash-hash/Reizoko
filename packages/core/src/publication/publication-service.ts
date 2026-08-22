import type { PreparedPublicationSnapshot, Publication } from '@reizoko/shared';
import type { PlatformPresentationOverrides } from '@reizoko/shared';
import { nowIso } from '@reizoko/shared';
import type { PlatformRegistry } from '@reizoko/platform-sdk';
import type { ContentRepository } from '../content/content-service.js';
import { isContentEmpty } from '../content/content-service.js';
import type { PublicationBatchRepository } from './publication-batch-repository.js';
import type { PublicationRepository } from './publication-repository.js';
import type { PlatformConnectionRepository } from '../platform-connection/platform-connection-repository.js';
import type { SocialAccountRepository } from '../social-account/social-account-repository.js';
import { TelegramPublisher, type TelegramPublishInput } from '../telegram/telegram-publisher.js';
import type { TelegramTransport } from '../telegram/telegram-transport.js';
import type { ContentRevision, PublicationTarget } from '@reizoko/shared';
import {
  buildPreparedPresentationSnapshot,
  presentationTargetKey,
  resolvePlatformText,
} from '../composer/media-transform.js';

export interface PreparePublicationBatchInput {
  contentItemId: string;
  targets: PublicationTarget[];
  presentationByTargetKey?: Record<string, PlatformPresentationOverrides>;
}

export interface PreparePublicationBatchResult {
  batch: import('@reizoko/shared').PublicationBatch;
  publications: Publication[];
  checkpoint: ContentRevision;
  item: import('@reizoko/shared').ContentItemWithRevision;
}

export interface PublishableTargetStatus {
  publicationId: string;
  platformId: string;
  socialAccountId: string | null;
  label: string;
  publishable: boolean;
  reason?: string;
}

export class PublicationService {
  private readonly telegramPublisher: TelegramPublisher;

  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly batchRepository: PublicationBatchRepository,
    private readonly publicationRepository: PublicationRepository,
    private readonly platformRegistry: PlatformRegistry,
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly connectionRepository: PlatformConnectionRepository,
    telegramTransport: TelegramTransport,
  ) {
    this.telegramPublisher = new TelegramPublisher(telegramTransport);
  }

  async prepareBatch(input: PreparePublicationBatchInput): Promise<PreparePublicationBatchResult> {
    if (input.targets.length === 0) {
      throw new Error('At least one publication target is required');
    }

    const existing = await this.contentRepository.getItem(input.contentItemId);
    if (!existing) {
      throw new Error(`Content item ${input.contentItemId} not found`);
    }

    if (isContentEmpty(existing.revision.blocks)) {
      throw new Error('Cannot prepare publication for empty content');
    }

    const { checkpoint, item } = await this.contentRepository.createPublicationCheckpoint(
      input.contentItemId,
    );

    const batch = await this.batchRepository.create({
      contentItemId: input.contentItemId,
      contentRevisionId: checkpoint.id,
    });

    const publications: Publication[] = [];
    for (const target of input.targets) {
      const targetKey = presentationTargetKey(target.platformId, target.socialAccountId);
      const overrides = input.presentationByTargetKey?.[targetKey] ?? null;
      const snapshot = this.buildPreparedSnapshot(checkpoint.blocks, target, overrides);
      const publication = await this.publicationRepository.create({
        batchId: batch.id,
        contentRevisionId: checkpoint.id,
        platformId: target.platformId,
        socialAccountId: target.socialAccountId ?? null,
        status: 'draft',
        preparedSnapshot: snapshot,
      });
      publications.push(publication);
    }

    return { batch, publications, checkpoint, item };
  }

  async assessBatchPublishability(batchId: string): Promise<PublishableTargetStatus[]> {
    const publications = await this.publicationRepository.listByBatch(batchId);
    const statuses: PublishableTargetStatus[] = [];
    for (const publication of publications) {
      statuses.push(await this.assessPublicationPublishability(publication));
    }
    return statuses;
  }

  async assessPublicationPublishability(publication: Publication): Promise<PublishableTargetStatus> {
    const account = publication.socialAccountId
      ? await this.socialAccountRepository.getById(publication.socialAccountId)
      : null;
    const label = account?.displayName ?? publication.platformId;
    if (publication.platformId !== 'telegram') {
      return {
        publicationId: publication.id,
        platformId: publication.platformId,
        socialAccountId: publication.socialAccountId ?? null,
        label,
        publishable: false,
        reason: 'не подключён',
      };
    }
    if (!account?.connectionId || !account.externalAccountId) {
      return {
        publicationId: publication.id,
        platformId: publication.platformId,
        socialAccountId: publication.socialAccountId ?? null,
        label,
        publishable: false,
        reason: 'не подключён',
      };
    }
    const connection = await this.connectionRepository.getById(account.connectionId);
    if (!connection || connection.state !== 'connected' || !connection.secretRef) {
      return {
        publicationId: publication.id,
        platformId: publication.platformId,
        socialAccountId: publication.socialAccountId ?? null,
        label,
        publishable: false,
        reason: 'требуется подключение',
      };
    }
    const errors = publication.preparedSnapshot.validationIssues.filter(
      (issue) => issue.severity === 'error',
    );
    if (errors.length > 0) {
      return {
        publicationId: publication.id,
        platformId: publication.platformId,
        socialAccountId: publication.socialAccountId ?? null,
        label,
        publishable: false,
        reason: errors[0]?.message ?? 'ошибка валидации',
      };
    }
    return {
      publicationId: publication.id,
      platformId: publication.platformId,
      socialAccountId: publication.socialAccountId ?? null,
      label,
      publishable: true,
    };
  }

  async publishBatchNow(
    batchId: string,
    mediaPaths: Record<string, string>,
    options?: { publicationIds?: string[] },
  ): Promise<Publication[]> {
    const publications = await this.publicationRepository.listByBatch(batchId);
    const selected = options?.publicationIds
      ? publications.filter((publication) => options.publicationIds?.includes(publication.id))
      : publications;

    const results: Publication[] = [];
    for (const publication of selected) {
      const status = await this.assessPublicationPublishability(publication);
      if (!status.publishable) continue;
      results.push(await this.publishPublication(publication.id, mediaPaths));
    }
    return results;
  }

  async publishPublication(publicationId: string, mediaPaths: Record<string, string>): Promise<Publication> {
    const publication = await this.publicationRepository.getById(publicationId);
    if (!publication) throw new Error(`Publication ${publicationId} not found`);
    if (publication.status === 'publishing') {
      throw new Error('Публикация уже выполняется');
    }
    if (publication.status === 'published') {
      return publication;
    }
    if (publication.status !== 'draft' && publication.status !== 'failed') {
      throw new Error(`Publication ${publicationId} cannot be published from status ${publication.status}`);
    }

    const locked = await this.publicationRepository.beginPublishing(publicationId);
    if (!locked) throw new Error('Не удалось начать публикацию');

    try {
      if (publication.platformId !== 'telegram') {
        return this.publicationRepository.markFailed(publicationId, 'Платформа пока не поддерживает публикацию.');
      }

      const account = publication.socialAccountId
        ? await this.socialAccountRepository.getById(publication.socialAccountId)
        : null;
      if (!account?.connectionId) {
        return this.publicationRepository.markFailed(publicationId, 'Аккаунт не подключён.');
      }
      const connection = await this.connectionRepository.getById(account.connectionId);
      if (!connection || connection.state !== 'connected' || !connection.secretRef) {
        return this.publicationRepository.markFailed(
          publicationId,
          'Требуется повторное подключение Telegram-бота.',
        );
      }

      const input: TelegramPublishInput = {
        publication: locked,
        account,
        connection,
        mediaPaths,
      };
      const result = await this.telegramPublisher.publish(input);

      if (result.platformResponseMetadata?.unauthorized) {
        await this.connectionRepository.update(connection.id, {
          state: 'needs_reconnect',
          errorCode: 'telegram_unauthorized',
          errorMessage: null,
        });
        await this.socialAccountRepository.clearConnectionForAccounts(connection.id);
      }

      if (!result.success) {
        return this.publicationRepository.markFailed(
          publicationId,
          result.errorMessage ?? 'Не удалось опубликовать.',
          result.platformResponseMetadata ?? undefined,
        );
      }

      return this.publicationRepository.markPublished(publicationId, {
        remotePostId: result.remotePostId ?? null,
        remoteUrl: result.remoteUrl ?? null,
        publishedAt: result.publishedAt ?? nowIso(),
        platformResponseMetadata: result.platformResponseMetadata ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось опубликовать.';
      return this.publicationRepository.markFailed(publicationId, message);
    }
  }

  async retryPublication(publicationId: string, mediaPaths: Record<string, string>): Promise<Publication> {
    const publication = await this.publicationRepository.getById(publicationId);
    if (!publication || publication.status !== 'failed') {
      throw new Error('Повтор доступен только для неудачных публикаций');
    }
    return this.publishPublication(publicationId, mediaPaths);
  }

  async getBatch(id: string) {
    return this.batchRepository.getById(id);
  }

  async listBatchesByContentItem(contentItemId: string) {
    return this.batchRepository.listByContentItem(contentItemId);
  }

  async listPublicationsByBatch(batchId: string) {
    return this.publicationRepository.listByBatch(batchId);
  }

  async listPublicationsByContentItem(contentItemId: string) {
    return this.publicationRepository.listByContentItem(contentItemId);
  }

  async cancelBatch(batchId: string): Promise<Publication[]> {
    const publications = await this.publicationRepository.listByBatch(batchId);
    const cancelled: Publication[] = [];

    for (const publication of publications) {
      if (publication.status === 'draft') {
        cancelled.push(await this.publicationRepository.cancel(publication.id));
      } else {
        cancelled.push(publication);
      }
    }

    return cancelled;
  }

  private buildPreparedSnapshot(
    blocks: ContentRevision['blocks'],
    target: PublicationTarget,
    overrides?: PlatformPresentationOverrides | null,
  ): PreparedPublicationSnapshot {
    const platform = this.platformRegistry.get(target.platformId);
    const preparedAt = nowIso();
    const presentation = buildPreparedPresentationSnapshot(overrides, blocks);

    if (!platform) {
      const issue = {
        severity: 'error' as const,
        message: `Платформа «${target.platformId}» не найдена`,
      };
      return {
        formatVersion: 2,
        platformId: target.platformId,
        transformedContent: { text: '', images: [], warnings: [issue] },
        validationIssues: [issue],
        preparedAt,
        presentation,
      };
    }

    const transformed = platform.adapter.transform(blocks);
    const validationIssues = platform.adapter.validate(blocks);
    const resolvedText = resolvePlatformText(blocks, overrides);

    return {
      formatVersion: 2,
      platformId: target.platformId,
      transformedContent: {
        text: resolvedText || transformed.text,
        images: (presentation?.media ?? transformed.images).map((image) => ({
          mediaId: image.mediaId,
          alt: image.alt,
          caption: image.caption,
        })),
        warnings: transformed.warnings,
      },
      validationIssues,
      preparedAt,
      presentation,
    };
  }
}

export function publicationTargetKey(target: PublicationTarget): string {
  return `${target.platformId}:${target.socialAccountId ?? ''}`;
}
