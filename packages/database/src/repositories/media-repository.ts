import { MediaItem, nowIso } from '@reizoko/shared';
import { DatabaseClient } from '../client/database-client.js';

export class SqliteMediaRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(item: Omit<MediaItem, 'createdAt' | 'updatedAt'>): Promise<MediaItem> {
    const now = nowIso();
    const media: MediaItem = { ...item, createdAt: now, updatedAt: now };
    await this.db.execute(
      `INSERT INTO media_items (id, filename, mime_type, size, width, height, local_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        media.id,
        media.filename,
        media.mimeType,
        media.size,
        media.width ?? null,
        media.height ?? null,
        media.localPath,
        now,
        now,
      ],
    );
    return media;
  }

  async getById(id: string): Promise<MediaItem | null> {
    const result = await this.db.select<{
      id: string;
      filename: string;
      mime_type: string;
      size: number;
      width: number | null;
      height: number | null;
      local_path: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>(`SELECT * FROM media_items WHERE id = ? AND deleted_at IS NULL`, [id]);

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      localPath: row.local_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  async list(): Promise<MediaItem[]> {
    const result = await this.db.select<{
      id: string;
      filename: string;
      mime_type: string;
      size: number;
      width: number | null;
      height: number | null;
      local_path: string;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM media_items WHERE deleted_at IS NULL ORDER BY created_at DESC`);

    return result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      localPath: row.local_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
