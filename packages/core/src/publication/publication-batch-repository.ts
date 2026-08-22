import type { PublicationBatch } from '@reizoko/shared';

export interface PublicationBatchRepository {
  create(input: {
    contentItemId: string;
    contentRevisionId: string;
  }): Promise<PublicationBatch>;
  getById(id: string): Promise<PublicationBatch | null>;
  listByContentItem(contentItemId: string): Promise<PublicationBatch[]>;
}
