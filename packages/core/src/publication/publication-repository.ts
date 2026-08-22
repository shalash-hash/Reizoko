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

export interface PublicationRepository {
  create(input: CreatePublicationInput): Promise<Publication>;
  getById(id: string): Promise<Publication | null>;
  listByBatch(batchId: string): Promise<Publication[]>;
  listByContentItem(contentItemId: string): Promise<Publication[]>;
  updateStatus(id: string, status: PublicationStatus): Promise<Publication>;
  cancel(id: string): Promise<Publication>;
}
