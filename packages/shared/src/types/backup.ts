import type { ContentItem, ContentRevision } from './content.js';
import type { MediaItem } from './media.js';
import type { PlatformConnection } from './platform-connection.js';
import type { Publication, PublicationBatch } from './publication.js';
import type { SocialAccount } from './social-account.js';
import type { WorkspaceState } from './workspace.js';

export const BACKUP_FORMAT = 'reizoko-backup' as const;
export const BACKUP_FORMAT_VERSION = 1;

export interface AppSettingEntry {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface ReizokoBackupData {
  contentItems: ContentItem[];
  contentRevisions: ContentRevision[];
  mediaItems: MediaItem[];
  socialAccounts: SocialAccount[];
  /** Metadata only — secrets never included; secretRef always null in backup. */
  platformConnections?: PlatformConnection[];
  publicationBatches: PublicationBatch[];
  publications: Publication[];
  appSettings: AppSettingEntry[];
  workspaceState: WorkspaceState | null;
}

export interface BackupMediaManifestEntry {
  mediaId: string;
  archivePath: string;
  filename: string;
  size: number;
  sha256: string;
  missing?: boolean;
}

export interface ReizokoBackupManifest {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  appVersion: string;
  databaseSchemaVersion: number;
  createdAt: string;
  counts: {
    contentItems: number;
    contentRevisions: number;
    mediaItems: number;
    publicationBatches: number;
    publications: number;
    socialAccounts: number;
  };
  mediaFiles: BackupMediaManifestEntry[];
  warnings?: string[];
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: ReizokoBackupManifest;
  data?: ReizokoBackupData;
}

export interface BackupCreationResult {
  archive: Uint8Array;
  manifest: ReizokoBackupManifest;
  warnings: string[];
}

export interface BackupSummary {
  createdAt: string;
  contentItems: number;
  contentRevisions: number;
  mediaItems: number;
  socialAccounts: number;
  publicationBatches: number;
  publications: number;
  warnings: string[];
}
