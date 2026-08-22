import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { appDataDir } from '@tauri-apps/api/path';
import { copyFile, exists, mkdir, readFile, stat, BaseDirectory } from '@tauri-apps/plugin-fs';
import { generateId } from '@reizoko/shared';
import type { DatabaseContext } from '@reizoko/database';
import { getMediaRelativeDir, isSmokeTestMode } from '../config/smoke-test';
import { resolveMediaFileSize } from '../utils/media-file-size';

const mediaUrlCache = new Map<string, string>();

export function getMediaUrl(mediaId: string, localPath?: string | null): string | null {
  if (!localPath) return null;
  const cached = mediaUrlCache.get(mediaId);
  if (cached) return cached;
  const url = convertFileSrc(localPath);
  mediaUrlCache.set(mediaId, url);
  return url;
}

export async function pickAndStoreImage(db: DatabaseContext): Promise<string | null> {
  const smokePath = isSmokeTestMode()
    ? (window as Window & { __REIZOKO_SMOKE_IMAGE__?: string }).__REIZOKO_SMOKE_IMAGE__
    : undefined;

  const selected =
    smokePath ??
    (await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    }));

  if (!selected || Array.isArray(selected)) return null;

  const filename = selected.split(/[/\\]/).pop() ?? 'image';
  const mediaId = generateId();

  if (smokePath) {
    const normalizedPath = selected.replace(/\//g, '\\');
    const size = await resolveImportedFileSize(normalizedPath);
    await db.media.create({
      id: mediaId,
      filename,
      mimeType: guessMimeType(filename),
      size,
      localPath: normalizedPath,
    });
    return mediaId;
  }

  const destRelative = `${getMediaRelativeDir()}/${mediaId}-${filename}`;

  const mediaDirExists = await exists(getMediaRelativeDir(), { baseDir: BaseDirectory.AppData });
  if (!mediaDirExists) {
    await mkdir(getMediaRelativeDir(), { baseDir: BaseDirectory.AppData, recursive: true });
  }

  await copyFile(selected, destRelative, { toPathBaseDir: BaseDirectory.AppData });

  const appDataPath = await resolveAppDataPath(destRelative);
  const size = await resolveImportedFileSize(appDataPath, destRelative);

  await db.media.create({
    id: mediaId,
    filename,
    mimeType: guessMimeType(filename),
    size,
    localPath: appDataPath,
  });

  return mediaId;
}

async function resolveImportedFileSize(
  filePath: string,
  appDataRelative?: string,
): Promise<number> {
  if (appDataRelative) {
    try {
      const info = await stat(appDataRelative, { baseDir: BaseDirectory.AppData });
      const size = resolveMediaFileSize(info.size);
      if (size > 0) return size;
    } catch {
      /* fall through */
    }
  }

  try {
    const normalized = filePath.replace(/\\/g, '/');
    const appDir = (await appDataDir()).replace(/\\/g, '/');
    if (normalized.startsWith(appDir)) {
      const relative = normalized.slice(appDir.length).replace(/^[/\\]/, '');
      const data = await readFile(relative, { baseDir: BaseDirectory.AppData });
      return resolveMediaFileSize(null, data.byteLength);
    }

    const data = await readFile(filePath);
    return resolveMediaFileSize(null, data.byteLength);
  } catch {
    return 0;
  }
}

async function resolveAppDataPath(relativePath: string): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  return (await join(dir, relativePath)).replace(/\//g, '\\');
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export async function loadMediaPath(
  db: DatabaseContext,
  mediaId: string,
): Promise<string | null> {
  const item = await db.media.getById(mediaId);
  return item?.localPath ?? null;
}
