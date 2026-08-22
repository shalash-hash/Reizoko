import { copyFile, exists, mkdir, readFile, writeFile, stat, BaseDirectory } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { BackupSummary, BackupValidationResult } from '@reizoko/shared';
import {
  BackupService,
  buildBackupFilename,
  buildSafetyBackupFilename,
  parseBackupArchive,
} from '@reizoko/core';
import { SqliteBackupRepository, type DatabaseContext } from '@reizoko/database';
import { getMediaRelativeDir } from '../config/smoke-test';

const APP_VERSION = '0.1.0';

async function toAppDataRelative(targetPath: string): Promise<string | null> {
  const normalized = targetPath.replace(/\\/g, '/');
  const appDir = (await appDataDir()).replace(/\\/g, '/');
  if (!normalized.startsWith(appDir)) return null;
  return normalized.slice(appDir.length).replace(/^[/\\]/, '');
}

async function readBytesFromPath(targetPath: string): Promise<Uint8Array> {
  const relative = await toAppDataRelative(targetPath);
  if (relative) {
    return readFile(relative, { baseDir: BaseDirectory.AppData });
  }
  return readFile(targetPath);
}

export async function writeBytesToPath(targetPath: string, data: Uint8Array): Promise<void> {
  const relative = await toAppDataRelative(targetPath);
  if (relative) {
    await writeFile(relative, data, { baseDir: BaseDirectory.AppData });
    return;
  }
  await writeFile(targetPath, data);
}

export function createBackupService(db: DatabaseContext): BackupService {
  return new BackupService(new SqliteBackupRepository(db.client), { appVersion: APP_VERSION });
}

async function readMediaBytes(localPath: string): Promise<Uint8Array | null> {
  try {
    const normalized = localPath.replace(/\\/g, '/');
    const appDir = (await appDataDir()).replace(/\\/g, '/');
    if (normalized.startsWith(appDir)) {
      const relative = normalized.slice(appDir.length).replace(/^[/\\]/, '');
      const data = await readFile(relative, { baseDir: BaseDirectory.AppData });
      return data;
    }
    const data = await readFile(localPath);
    return data;
  } catch {
    return null;
  }
}

function appDataJoin(...segments: string[]): string {
  return segments.join('\\');
}

async function writeRestoredMedia(
  mediaId: string,
  filename: string,
  data: Uint8Array,
): Promise<string> {
  const mediaDir = getMediaRelativeDir();
  const mediaDirExists = await exists(mediaDir, { baseDir: BaseDirectory.AppData });
  if (!mediaDirExists) {
    await mkdir(mediaDir, { baseDir: BaseDirectory.AppData, recursive: true });
  }
  const destRelative = appDataJoin(mediaDir, `${mediaId}-${filename}`);
  await writeFile(destRelative, data, { baseDir: BaseDirectory.AppData });
  const appDir = await appDataDir();
  return (await join(appDir, destRelative)).replace(/\//g, '\\');
}

export async function createUserBackup(db: DatabaseContext): Promise<{
  path: string;
  warnings: string[];
}> {
  const service = createBackupService(db);
  const result = await service.createBackup({
    readFile: readMediaBytes,
  });

  const defaultPath = buildBackupFilename();
  const selectedPath = await save({
    defaultPath,
    filters: [{ name: 'Reizoko Backup', extensions: ['reizoko-backup'] }],
  });

  if (!selectedPath) {
    throw new Error('Создание резервной копии отменено');
  }

  await writeBytesToPath(selectedPath, result.archive);
  return { path: selectedPath, warnings: result.warnings };
}

export async function validateUserBackup(path: string): Promise<BackupValidationResult> {
  const bytes = await readBytesFromPath(path);
  const service = createBackupService({} as DatabaseContext);
  return service.validateBackup(bytes);
}

async function writeSafetyBackupArchive(archive: Uint8Array): Promise<void> {
  await writeFile(buildSafetyBackupFilename(), archive, { baseDir: BaseDirectory.AppData });
}

export async function restoreUserBackup(
  db: DatabaseContext,
  path: string,
): Promise<{ warnings: string[] }> {
  const bytes = await readBytesFromPath(path);
  const service = createBackupService(db);

  return service.restoreBackup(
    bytes,
    { readFile: readMediaBytes },
    { writeFile: writeRestoredMedia },
    { createSafetyBackup: writeSafetyBackupArchive },
  );
}

export async function exportUserJson(db: DatabaseContext): Promise<string> {
  const service = createBackupService(db);
  const exported = await service.exportJson();
  const selectedPath = await save({
    defaultPath: exported.filename,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!selectedPath) {
    throw new Error('Экспорт JSON отменён');
  }
  await writeBytesToPath(selectedPath, new TextEncoder().encode(exported.json));
  return selectedPath;
}

export async function pickBackupFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Reizoko Backup', extensions: ['reizoko-backup', 'zip'] }],
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export function summarizeBackup(manifest: NonNullable<BackupValidationResult['manifest']>): BackupSummary {
  const service = createBackupService({} as DatabaseContext);
  return service.summarize(manifest);
}

export async function writeBackupToPath(
  db: DatabaseContext,
  targetPath: string,
): Promise<{ warnings: string[]; archive: Uint8Array }> {
  const service = createBackupService(db);
  const result = await service.createBackup({ readFile: readMediaBytes });
  await writeBytesToPath(targetPath, result.archive);
  return { warnings: result.warnings, archive: result.archive };
}

export async function restoreBackupFromPath(
  db: DatabaseContext,
  path: string,
  options?: { skipSafetyBackup?: boolean },
): Promise<{ warnings: string[] }> {
  const bytes = await readBytesFromPath(path);
  const service = createBackupService(db);

  if (options?.skipSafetyBackup) {
    const validation = await service.validateBackup(bytes);
    if (!validation.valid || !validation.manifest || !validation.data) {
      throw new Error(validation.errors.join('; '));
    }
    return service.restoreValidatedBackup(parseBackupArchive(bytes), {
      writeFile: writeRestoredMedia,
    });
  }

  return service.restoreBackup(
    bytes,
    { readFile: readMediaBytes },
    { writeFile: writeRestoredMedia },
    { createSafetyBackup: writeSafetyBackupArchive },
  );
}

export async function copySmokeFixtureToMedia(
  db: DatabaseContext,
  sourcePath: string,
  mediaId: string,
  filename: string,
): Promise<string> {
  const mediaDir = getMediaRelativeDir();
  const mediaDirExists = await exists(mediaDir, { baseDir: BaseDirectory.AppData });
  if (!mediaDirExists) {
    await mkdir(mediaDir, { baseDir: BaseDirectory.AppData, recursive: true });
  }
  const destRelative = appDataJoin(mediaDir, `${mediaId}-${filename}`);
  await copyFile(sourcePath, destRelative, { toPathBaseDir: BaseDirectory.AppData });
  const appDir = await appDataDir();
  const localPath = (await join(appDir, destRelative)).replace(/\//g, '\\');
  let size = 0;
  try {
    const info = await stat(destRelative, { baseDir: BaseDirectory.AppData });
    size = Number(info.size ?? 0);
  } catch {
    /* keep size 0 if stat fails */
  }
  await db.media.create({
    id: mediaId,
    filename,
    mimeType: 'image/png',
    size,
    localPath,
  });
  return localPath;
}
