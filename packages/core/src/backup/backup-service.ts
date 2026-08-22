import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupCreationResult,
  type BackupSummary,
  type BackupValidationResult,
  type ReizokoBackupData,
  type ReizokoBackupManifest,
} from '@reizoko/shared';
import type { BackupRepository } from './backup-repository.js';
import {
  buildJsonExportFilename,
  packBackupArchive,
  parseBackupArchive,
  type ParsedBackupArchive,
} from './backup-archive.js';
import { sha256Hex } from './backup-crypto.js';
import {
  filterSmokeInfrastructure,
  isSmokeInfrastructurePath,
  toBackupSummary,
  validateBackupArchive,
} from './backup-validator.js';

export interface BackupMediaReader {
  readFile(localPath: string): Promise<Uint8Array | null>;
}

export interface BackupMediaWriter {
  writeFile(mediaId: string, filename: string, data: Uint8Array): Promise<string>;
}

export interface BackupServiceOptions {
  appVersion: string;
}

export class BackupService {
  constructor(
    private readonly repository: BackupRepository,
    private readonly options: BackupServiceOptions,
  ) {}

  async createBackup(mediaReader: BackupMediaReader): Promise<BackupCreationResult> {
    const snapshot = filterSmokeInfrastructure(await this.repository.exportSnapshot());
    const schemaVersion = await this.repository.getSchemaVersion();
    const warnings: string[] = [];
    const mediaFiles = new Map<string, Uint8Array>();
    const mediaManifest: ReizokoBackupManifest['mediaFiles'] = [];

    for (const media of snapshot.mediaItems) {
      if (isSmokeInfrastructurePath(media.localPath)) {
        continue;
      }

      const archivePath = `${media.id}/${media.filename}`;
      const fileBytes = await mediaReader.readFile(media.localPath);

      if (!fileBytes) {
        warnings.push(`Медиафайл не найден: ${media.filename}`);
        mediaManifest.push({
          mediaId: media.id,
          archivePath,
          filename: media.filename,
          size: media.size,
          sha256: '',
          missing: true,
        });
        continue;
      }

      const sha256 = await sha256Hex(fileBytes);
      mediaFiles.set(archivePath, fileBytes);
      mediaManifest.push({
        mediaId: media.id,
        archivePath,
        filename: media.filename,
        size: fileBytes.byteLength,
        sha256,
      });
    }

    const manifest: ReizokoBackupManifest = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: this.options.appVersion,
      databaseSchemaVersion: schemaVersion,
      createdAt: new Date().toISOString(),
      counts: {
        contentItems: snapshot.contentItems.length,
        contentRevisions: snapshot.contentRevisions.length,
        mediaItems: snapshot.mediaItems.length,
        publicationBatches: snapshot.publicationBatches.length,
        publications: snapshot.publications.length,
        socialAccounts: snapshot.socialAccounts.length,
      },
      mediaFiles: mediaManifest,
      warnings: warnings.length ? warnings : undefined,
    };

    const archive = packBackupArchive(manifest, snapshot, mediaFiles);
    return { archive, manifest, warnings };
  }

  async validateBackup(bytes: Uint8Array): Promise<BackupValidationResult> {
    try {
      const parsed = parseBackupArchive(bytes);
      const validation = await validateBackupArchive(parsed.manifest, parsed.data, parsed.mediaFiles);
      return {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        manifest: parsed.manifest,
        data: parsed.data,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'Не удалось прочитать резервную копию',
        ],
        warnings: [],
      };
    }
  }

  async exportJson(): Promise<{ filename: string; json: string }> {
    const snapshot = filterSmokeInfrastructure(await this.repository.exportSnapshot());
    const schemaVersion = await this.repository.getSchemaVersion();
    const payload = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      databaseSchemaVersion: schemaVersion,
      exportedAt: new Date().toISOString(),
      note: 'JSON export содержит domain data без бинарных media files. Для полного backup используйте .reizoko-backup',
      data: snapshot,
    };
    return {
      filename: buildJsonExportFilename(),
      json: JSON.stringify(payload, null, 2),
    };
  }

  summarize(manifest: ReizokoBackupManifest): BackupSummary {
    return toBackupSummary(manifest);
  }

  async restoreBackup(
    bytes: Uint8Array,
    mediaReader: BackupMediaReader,
    mediaWriter: BackupMediaWriter,
    options?: {
      createSafetyBackup?: (archive: Uint8Array) => Promise<void>;
    },
  ): Promise<{ warnings: string[] }> {
    const parsed = parseBackupArchive(bytes);
    const validation = await validateBackupArchive(parsed.manifest, parsed.data, parsed.mediaFiles);

    if (!validation.valid) {
      throw new Error(
        `Не удалось восстановить резервную копию: ${validation.errors.join('; ')}`,
      );
    }

    if (options?.createSafetyBackup) {
      try {
        const safety = await this.createBackup(mediaReader);
        await options.createSafetyBackup(safety.archive);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Не удалось создать резервную копию текущих данных перед восстановлением: ${detail}`,
        );
      }
    }

    return this.applyRestore(parsed, mediaWriter, validation.warnings);
  }

  async restoreValidatedBackup(
    parsed: ParsedBackupArchive,
    mediaWriter: BackupMediaWriter,
    warnings: string[] = [],
  ): Promise<{ warnings: string[] }> {
    const validation = await validateBackupArchive(parsed.manifest, parsed.data, parsed.mediaFiles);
    if (!validation.valid) {
      throw new Error(
        `Не удалось восстановить резервную копию: ${validation.errors.join('; ')}`,
      );
    }
    return this.applyRestore(parsed, mediaWriter, [...warnings, ...validation.warnings]);
  }

  private async applyRestore(
    parsed: ParsedBackupArchive,
    mediaWriter: BackupMediaWriter,
    warnings: string[],
  ): Promise<{ warnings: string[] }> {
    const restoredData: ReizokoBackupData = {
      ...parsed.data,
      mediaItems: [],
    };

    for (const media of parsed.data.mediaItems) {
      const manifestEntry = parsed.manifest.mediaFiles.find((entry) => entry.mediaId === media.id);
      if (!manifestEntry || manifestEntry.missing) {
        restoredData.mediaItems.push(media);
        continue;
      }

      const fileBytes = parsed.mediaFiles.get(manifestEntry.archivePath);
      if (!fileBytes) {
        throw new Error(`Медиафайл ${media.filename} отсутствует в архиве`);
      }

      const localPath = await mediaWriter.writeFile(media.id, media.filename, fileBytes);
      restoredData.mediaItems.push({
        ...media,
        localPath,
        size: fileBytes.byteLength,
      });
    }

    await this.repository.restoreSnapshot(restoredData);
    return { warnings };
  }
}

export { parseBackupArchive, packBackupArchive } from './backup-archive.js';
export {
  buildBackupFilename,
  buildJsonExportFilename,
  buildSafetyBackupFilename,
} from './backup-archive.js';
