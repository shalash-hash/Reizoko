export type ContentBlockType =
  | 'text'
  | 'heading'
  | 'image'
  | 'video'
  | 'link'
  | 'gallery'
  | 'file'
  | 'poll'
  | 'quote';

export const IMPLEMENTED_BLOCK_TYPES: ContentBlockType[] = ['text', 'heading', 'image'];

export const PLANNED_BLOCK_TYPES: ContentBlockType[] = [
  'video',
  'link',
  'gallery',
  'file',
  'poll',
  'quote',
];

export interface TextBlockData {
  text: string;
}

export interface HeadingBlockData {
  text: string;
  level: 1 | 2 | 3;
}

export interface ImageBlockData {
  mediaId: string;
  alt?: string;
  caption?: string;
}

export type ContentBlockData = TextBlockData | HeadingBlockData | ImageBlockData;

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  order: number;
  data: ContentBlockData;
}

export interface ContentItemMetadata {
  title: string;
  tags?: string[];
  notes?: string;
}

export interface ContentItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  currentRevisionId: string;
  metadata: ContentItemMetadata;
  syncState?: SyncState;
  deviceId?: string;
}

export type RevisionOrigin = 'auto' | 'manual' | 'restore' | 'publication' | 'legacy';

export type RevisionKind = 'working' | 'checkpoint';

export interface ContentRevision {
  id: string;
  contentItemId: string;
  createdAt: string;
  updatedAt: string;
  blocks: ContentBlock[];
  metadata: ContentItemMetadata;
  version: number;
  origin: RevisionOrigin;
  kind: RevisionKind;
  restoreFromVersion?: number | null;
}

export interface ContentItemWithRevision extends ContentItem {
  revision: ContentRevision;
}

export type SyncState = 'local' | 'pending' | 'synced' | 'conflict';

export interface ContentItemSummary {
  id: string;
  title: string;
  previewText: string;
  createdAt: string;
  updatedAt: string;
}
