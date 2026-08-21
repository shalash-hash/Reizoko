import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { copyFile, exists, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { generateId } from '@reizoko/shared';
import type { DatabaseContext } from '@reizoko/database';

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
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
  });

  if (!selected || Array.isArray(selected)) return null;

  const filename = selected.split(/[/\\]/).pop() ?? 'image';
  const mediaId = generateId();
  const destRelative = `media/${mediaId}-${filename}`;

  const mediaDirExists = await exists('media', { baseDir: BaseDirectory.AppData });
  if (!mediaDirExists) {
    await mkdir('media', { baseDir: BaseDirectory.AppData, recursive: true });
  }

  await copyFile(selected, destRelative, { toPathBaseDir: BaseDirectory.AppData });

  const appDataPath = await resolveAppDataPath(destRelative);

  await db.media.create({
    id: mediaId,
    filename,
    mimeType: guessMimeType(filename),
    size: 0,
    localPath: appDataPath,
  });

  return mediaId;
}

async function resolveAppDataPath(relativePath: string): Promise<string> {
  const { appDataDir, join } = await import('@tauri-apps/api/path');
  const dir = await appDataDir();
  return join(dir, relativePath);
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
