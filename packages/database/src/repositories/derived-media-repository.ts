import type { DerivedMediaVariant } from '@reizoko/shared';
import { generateId, nowIso } from '@reizoko/shared';
import { DatabaseClient } from '../client/database-client.js';

interface DerivedRow {
  id: string;
  source_media_id: string;
  transform_hash: string;
  local_path: string;
  mime_type: string;
  width: number;
  height: number;
  created_at: string;
}

export class SqliteDerivedMediaRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getBySourceAndHash(
    sourceMediaId: string,
    transformHash: string,
  ): Promise<DerivedMediaVariant | null> {
    const result = await this.db.select<DerivedRow>(
      `SELECT * FROM derived_media_variants WHERE source_media_id = ? AND transform_hash = ?`,
      [sourceMediaId, transformHash],
    );
    const row = result.rows[0];
    return row ? this.rowToModel(row) : null;
  }

  async create(input: Omit<DerivedMediaVariant, 'id' | 'createdAt'>): Promise<DerivedMediaVariant> {
    const model: DerivedMediaVariant = {
      id: generateId(),
      ...input,
      createdAt: nowIso(),
    };
    await this.db.execute(
      `INSERT INTO derived_media_variants
       (id, source_media_id, transform_hash, local_path, mime_type, width, height, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        model.id,
        model.sourceMediaId,
        model.transformHash,
        model.localPath,
        model.mimeType,
        model.width,
        model.height,
        model.createdAt,
      ],
    );
    return model;
  }

  private rowToModel(row: DerivedRow): DerivedMediaVariant {
    return {
      id: row.id,
      sourceMediaId: row.source_media_id,
      transformHash: row.transform_hash,
      localPath: row.local_path,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      createdAt: row.created_at,
    };
  }
}
