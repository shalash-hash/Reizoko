export type PublicationStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface Publication {
  id: string;
  contentRevisionId: string;
  socialAccountId?: string | null;
  platformId: string;
  status: PublicationStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  remotePostId?: string | null;
  createdAt: string;
  updatedAt: string;
}
