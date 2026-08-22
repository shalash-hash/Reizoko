import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { ReizokoBackupData, ReizokoBackupManifest } from '@reizoko/shared';

export interface ParsedBackupArchive {
  manifest: ReizokoBackupManifest;
  data: ReizokoBackupData;
  mediaFiles: Map<string, Uint8Array>;
}

export function packBackupArchive(
  manifest: ReizokoBackupManifest,
  data: ReizokoBackupData,
  mediaFiles: Map<string, Uint8Array>,
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'data.json': strToU8(JSON.stringify(data, null, 2)),
  };

  for (const [archivePath, content] of mediaFiles) {
    files[`media/${archivePath}`] = content;
  }

  return zipSync(files);
}

export function parseBackupArchive(bytes: Uint8Array): ParsedBackupArchive {
  const entries = unzipSync(bytes);
  const manifestBytes = entries['manifest.json'];
  const dataBytes = entries['data.json'];

  if (!manifestBytes || !dataBytes) {
    throw new Error('Архив резервной копии повреждён: отсутствует manifest.json или data.json');
  }

  const manifest = JSON.parse(strFromU8(manifestBytes)) as ReizokoBackupManifest;
  const data = JSON.parse(strFromU8(dataBytes)) as ReizokoBackupData;
  const mediaFiles = new Map<string, Uint8Array>();

  for (const [path, content] of Object.entries(entries)) {
    if (path.startsWith('media/')) {
      mediaFiles.set(path.slice('media/'.length), content);
    }
  }

  return { manifest, data, mediaFiles };
}

export function buildBackupFilename(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `reizoko-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.reizoko-backup`;
}

export function buildJsonExportFilename(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `reizoko-export-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

export function buildSafetyBackupFilename(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `pre-restore-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.reizoko-backup`;
}
