import {
  nowIso,
  type ContentItemWithRevision,
  type ContentRevision,
  type PreparedPublicationSnapshot,
  type Publication,
  type PublicationBatch,
  type PublicationTarget,
} from '@reizoko/shared';
import type { PlatformRegistry, TransformedContent, PlatformValidationIssue } from '@reizoko/platform-sdk';
import type { ContentRepository } from '../content/content-service.js';
import { isContentEmpty } from '../content/content-service.js';
import type { PublicationBatchRepository } from './publication-batch-repository.js';
import type { PublicationRepository } from './publication-repository.js';

export interface PreparePublicationBatchInput {
  contentItemId: string;
  targets: PublicationTarget[];
}

export interface PreparePublicationBatchResult {
  batch: PublicationBatch;
  publications: Publication[];
  checkpoint: ContentRevision;
  item: ContentItemWithRevision;
}

export class PublicationService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly batchRepository: PublicationBatchRepository,
    private readonly publicationRepository: PublicationRepository,
    private readonly platformRegistry: PlatformRegistry,
  ) {}

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
      const snapshot = this.buildPreparedSnapshot(checkpoint.blocks, target);
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

  async getBatch(id: string): Promise<PublicationBatch | null> {
    return this.batchRepository.getById(id);
  }

  async listBatchesByContentItem(contentItemId: string): Promise<PublicationBatch[]> {
    return this.batchRepository.listByContentItem(contentItemId);
  }

  async listPublicationsByBatch(batchId: string): Promise<Publication[]> {
    return this.publicationRepository.listByBatch(batchId);
  }

  async listPublicationsByContentItem(contentItemId: string): Promise<Publication[]> {
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
  ): PreparedPublicationSnapshot {
    const platform = this.platformRegistry.get(target.platformId);
    const preparedAt = nowIso();

    if (!platform) {
      const issue: PlatformValidationIssue = {
        severity: 'error',
        message: `Платформа «${target.platformId}» не найдена`,
      };
      return {
        formatVersion: 1,
        platformId: target.platformId,
        transformedContent: { text: '', images: [], warnings: [issue] },
        validationIssues: [issue],
        preparedAt,
      };
    }

    const transformed = platform.adapter.transform(blocks);
    const validationIssues = platform.adapter.validate(blocks);

    return {
      formatVersion: 1,
      platformId: target.platformId,
      transformedContent: this.toPreparedTransformedContent(transformed),
      validationIssues,
      preparedAt,
    };
  }

  private toPreparedTransformedContent(transformed: TransformedContent): PreparedPublicationSnapshot['transformedContent'] {
    return {
      text: transformed.text,
      images: transformed.images.map((image) => ({
        mediaId: image.mediaId,
        alt: image.alt,
        caption: image.caption,
      })),
      warnings: transformed.warnings,
    };
  }
}

export function publicationTargetKey(target: PublicationTarget): string {
  return `${target.platformId}:${target.socialAccountId ?? ''}`;
}
