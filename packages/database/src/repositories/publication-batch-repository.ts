import {
  generateId,
  nowIso,
  type PublicationBatch,
} from '@reizoko/shared';
import type { PublicationBatchRepository } from '@reizoko/core';
import { DatabaseClient } from '../client/database-client.js';

interface PublicationBatchRow {
  id: string;
  content_item_id: string;
  content_revision_id: string;
  created_at: string;
  updated_at: string;
}

export class SqlitePublicationBatchRepository implements PublicationBatchRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: {
    contentItemId: string;
    contentRevisionId: string;
  }): Promise<PublicationBatch> {
    const id = generateId();
    const now = nowIso();
    const batch: PublicationBatch = {
      id,
      contentItemId: input.contentItemId,
      contentRevisionId: input.contentRevisionId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.execute(
      `INSERT INTO publication_batches (id, content_item_id, content_revision_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.contentItemId, input.contentRevisionId, now, now],
    );

    return batch;
  }

  async getById(id: string): Promise<PublicationBatch | null> {
    const result = await this.db.select<PublicationBatchRow>(
      `SELECT * FROM publication_batches WHERE id = ?`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.rowToBatch(row) : null;
  }

  async listByContentItem(contentItemId: string): Promise<PublicationBatch[]> {
    const result = await this.db.select<PublicationBatchRow>(
      `SELECT * FROM publication_batches WHERE content_item_id = ? ORDER BY created_at DESC`,
      [contentItemId],
    );
    return result.rows.map((row) => this.rowToBatch(row));
  }

  private rowToBatch(row: PublicationBatchRow): PublicationBatch {
    return {
      id: row.id,
      contentItemId: row.content_item_id,
      contentRevisionId: row.content_revision_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export type { PublicationBatchRepository };
