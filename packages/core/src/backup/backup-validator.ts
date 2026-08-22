import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type ContentBlock,
  type ReizokoBackupData,
  type ReizokoBackupManifest,
} from '@reizoko/shared';
import { normalizeWorkspaceState } from '../workspace/platform-targets.js';
import { sha256Hex } from './backup-crypto.js';

export function isSmokeInfrastructurePath(localPath: string): boolean {
  const normalized = localPath.replace(/\\/g, '/').toLowerCase();
  return normalized.includes('media-smoke') || normalized.includes('reizoko-smoke');
}

export function filterSmokeInfrastructure(data: ReizokoBackupData): ReizokoBackupData {
  const smokeMediaIds = new Set(
    data.mediaItems.filter((item) => isSmokeInfrastructurePath(item.localPath)).map((item) => item.id),
  );

  return {
    ...data,
    mediaItems: data.mediaItems.filter((item) => !smokeMediaIds.has(item.id)),
    contentRevisions: data.contentRevisions.map((revision) => ({
      ...revision,
      blocks: stripSmokeMediaFromBlocks(revision.blocks, smokeMediaIds),
    })),
    publications: data.publications.map((publication) => ({
      ...publication,
      preparedSnapshot: {
        ...publication.preparedSnapshot,
        transformedContent: {
          ...publication.preparedSnapshot.transformedContent,
          images: publication.preparedSnapshot.transformedContent.images.filter(
            (image) => !smokeMediaIds.has(image.mediaId),
          ),
        },
      },
    })),
  };
}

function stripSmokeMediaFromBlocks(
  blocks: ContentBlock[],
  smokeMediaIds: Set<string>,
): ContentBlock[] {
  return blocks.filter((block) => {
    if (block.type !== 'image') return true;
    const mediaId = (block.data as { mediaId?: string }).mediaId;
    return !mediaId || !smokeMediaIds.has(mediaId);
  });
}

export async function validateBackupArchive(
  manifest: ReizokoBackupManifest,
  data: ReizokoBackupData,
  mediaFiles: Map<string, Uint8Array>,
): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [...(manifest.warnings ?? [])];

  if (manifest.format !== BACKUP_FORMAT) {
    errors.push('Неизвестный формат резервной копии');
  }

  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    errors.push(`Неподдерживаемая версия формата: ${manifest.formatVersion}`);
  }

  validateReferences(data, errors, warnings);

  for (const entry of manifest.mediaFiles) {
    if (entry.missing) {
      warnings.push(`Медиафайл ${entry.filename} отсутствует в резервной копии`);
      continue;
    }

    const file = mediaFiles.get(entry.archivePath);
    if (!file) {
      errors.push(`Медиафайл ${entry.filename} не найден в архиве`);
      continue;
    }

    if (file.byteLength !== entry.size) {
      errors.push(`Размер медиафайла ${entry.filename} не совпадает с manifest`);
      continue;
    }

    const checksum = await sha256Hex(file);
    if (checksum !== entry.sha256) {
      errors.push(`Контрольная сумма медиафайла ${entry.filename} не совпадает`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateReferences(
  data: ReizokoBackupData,
  errors: string[],
  warnings: string[],
): void {
  const revisionIds = new Set(data.contentRevisions.map((revision) => revision.id));
  const itemIds = new Set(data.contentItems.map((item) => item.id));
  const mediaIds = new Set(data.mediaItems.map((item) => item.id));
  const accountIds = new Set(data.socialAccounts.map((account) => account.id));
  const batchIds = new Set(data.publicationBatches.map((batch) => batch.id));

  for (const item of data.contentItems) {
    if (!revisionIds.has(item.currentRevisionId)) {
      errors.push(`ContentItem ${item.id} ссылается на отсутствующую revision`);
    }
  }

  for (const revision of data.contentRevisions) {
    if (!itemIds.has(revision.contentItemId)) {
      errors.push(`Revision ${revision.id} ссылается на отсутствующий ContentItem`);
    }
    for (const block of revision.blocks) {
      if (block.type === 'image') {
        const mediaId = (block.data as { mediaId?: string }).mediaId;
        if (mediaId && !mediaIds.has(mediaId)) {
          warnings.push(`Revision ${revision.id} ссылается на отсутствующий mediaId ${mediaId}`);
        }
      }
    }
  }

  for (const batch of data.publicationBatches) {
    if (!itemIds.has(batch.contentItemId)) {
      errors.push(`PublicationBatch ${batch.id} ссылается на отсутствующий ContentItem`);
    }
    if (!revisionIds.has(batch.contentRevisionId)) {
      errors.push(`PublicationBatch ${batch.id} ссылается на отсутствующую revision`);
    }
  }

  for (const publication of data.publications) {
    if (!batchIds.has(publication.batchId)) {
      errors.push(`Publication ${publication.id} ссылается на отсутствующий batch`);
    }
    if (!revisionIds.has(publication.contentRevisionId)) {
      errors.push(`Publication ${publication.id} ссылается на отсутствующую revision`);
    }
    if (publication.socialAccountId && !accountIds.has(publication.socialAccountId)) {
      errors.push(`Publication ${publication.id} ссылается на отсутствующий SocialAccount`);
    }
  }

  if (data.workspaceState) {
    const normalized = normalizeWorkspaceState(data.workspaceState);
    if (
      normalized.currentContentItemId &&
      !itemIds.has(normalized.currentContentItemId)
    ) {
      warnings.push('Workspace currentContentItemId будет сброшен при восстановлении');
    }
  }

  for (const media of data.mediaItems) {
    if (isSmokeInfrastructurePath(media.localPath)) {
      errors.push('Резервная копия содержит smoke infrastructure media');
    }
  }
}

export function toBackupSummary(manifest: ReizokoBackupManifest): {
  createdAt: string;
  contentItems: number;
  contentRevisions: number;
  mediaItems: number;
  socialAccounts: number;
  publicationBatches: number;
  publications: number;
  warnings: string[];
} {
  return {
    createdAt: manifest.createdAt,
    contentItems: manifest.counts.contentItems,
    contentRevisions: manifest.counts.contentRevisions,
    mediaItems: manifest.counts.mediaItems,
    socialAccounts: manifest.counts.socialAccounts,
    publicationBatches: manifest.counts.publicationBatches,
    publications: manifest.counts.publications,
    warnings: manifest.warnings ?? [],
  };
}
