import type { ContentBlock } from './content.js';
import type { PublicationTarget } from './publication.js';

export interface PublishContext {
  contentItemId: string;
  contentRevisionId: string;
  platformId: string;
  socialAccountId: string | null;
  target: PublicationTarget;
  title: string;
  blocks: ContentBlock[];
  /** Local media paths keyed by mediaId — publisher resolves delivery mode. */
  mediaPaths: Record<string, string>;
}

export interface PublishResult {
  success: boolean;
  remotePostId?: string | null;
  remoteUrl?: string | null;
  publishedAt?: string | null;
  platformResponseMetadata?: Record<string, unknown>;
  errorMessage?: string | null;
  retryable?: boolean;
}

export interface PlatformPublisher {
  readonly platformId: string;
  publish(context: PublishContext): Promise<PublishResult>;
}
