import type {
  PreparedPublicationSnapshot,
  Publication,
  PublicationStatus,
} from '@reizoko/shared';

export interface CreatePublicationInput {
  batchId: string;
  contentRevisionId: string;
  platformId: string;
  socialAccountId?: string | null;
  status: PublicationStatus;
  preparedSnapshot: PreparedPublicationSnapshot;
}

export interface PublishResultPatch {
  remotePostId?: string | null;
  remoteUrl?: string | null;
  publishedAt?: string | null;
  platformResponseMetadata?: Record<string, unknown> | null;
}

export interface PublicationRepository {
  create(input: CreatePublicationInput): Promise<Publication>;
  getById(id: string): Promise<Publication | null>;
  listByBatch(batchId: string): Promise<Publication[]>;
  listByContentItem(contentItemId: string): Promise<Publication[]>;
  updateStatus(id: string, status: PublicationStatus): Promise<Publication>;
  beginPublishing(id: string): Promise<Publication | null>;
  markPublished(id: string, patch: PublishResultPatch): Promise<Publication>;
  markFailed(
    id: string,
    errorMessage: string,
    platformResponseMetadata?: Record<string, unknown>,
  ): Promise<Publication>;
  cancel(id: string): Promise<Publication>;
}
