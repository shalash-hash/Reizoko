export type PublicationStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export type PreparedValidationSeverity = 'info' | 'warning' | 'error';

export interface PreparedValidationIssue {
  severity: PreparedValidationSeverity;
  message: string;
  blockId?: string;
}

export interface PreparedTransformedContent {
  text: string;
  images: Array<{ mediaId: string; alt?: string; caption?: string }>;
  warnings: PreparedValidationIssue[];
}

export interface PreparedPublicationSnapshot {
  formatVersion: 1;
  platformId: string;
  transformedContent: PreparedTransformedContent;
  validationIssues: PreparedValidationIssue[];
  preparedAt: string;
}

export interface PublicationTarget {
  platformId: string;
  socialAccountId?: string | null;
}

export interface PublicationBatch {
  id: string;
  contentItemId: string;
  contentRevisionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Publication {
  id: string;
  batchId: string;
  contentRevisionId: string;
  socialAccountId?: string | null;
  platformId: string;
  status: PublicationStatus;
  preparedSnapshot: PreparedPublicationSnapshot;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  remotePostId?: string | null;
  createdAt: string;
  updatedAt: string;
}
