import {
  generateId,
  nowIso,
  type PreparedPublicationSnapshot,
  type Publication,
  type PublicationStatus,
} from '@reizoko/shared';
import type { CreatePublicationInput, PublicationRepository } from '@reizoko/core';
import { DatabaseClient } from '../client/database-client.js';

interface PublicationRow {
  id: string;
  batch_id: string | null;
  content_revision_id: string;
  social_account_id: string | null;
  platform_id: string;
  status: string;
  prepared_snapshot_json: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  remote_post_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SqlitePublicationRepository implements PublicationRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreatePublicationInput): Promise<Publication> {
    const id = generateId();
    const now = nowIso();
    const publication: Publication = {
      id,
      batchId: input.batchId,
      contentRevisionId: input.contentRevisionId,
      socialAccountId: input.socialAccountId ?? null,
      platformId: input.platformId,
      status: input.status,
      preparedSnapshot: input.preparedSnapshot,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.execute(
      `INSERT INTO publications
       (id, batch_id, content_revision_id, social_account_id, platform_id, status,
        prepared_snapshot_json, scheduled_at, published_at, remote_post_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
      [
        id,
        input.batchId,
        input.contentRevisionId,
        input.socialAccountId ?? null,
        input.platformId,
        input.status,
        JSON.stringify(input.preparedSnapshot),
        now,
        now,
      ],
    );

    return publication;
  }

  async getById(id: string): Promise<Publication | null> {
    const result = await this.db.select<PublicationRow>(`SELECT * FROM publications WHERE id = ?`, [id]);
    const row = result.rows[0];
    return row ? this.rowToPublication(row) : null;
  }

  async listByBatch(batchId: string): Promise<Publication[]> {
    const result = await this.db.select<PublicationRow>(
      `SELECT * FROM publications WHERE batch_id = ? ORDER BY created_at ASC`,
      [batchId],
    );
    return result.rows.map((row) => this.rowToPublication(row));
  }

  async listByContentItem(contentItemId: string): Promise<Publication[]> {
    const result = await this.db.select<PublicationRow>(
      `SELECT p.* FROM publications p
       JOIN publication_batches b ON p.batch_id = b.id
       WHERE b.content_item_id = ?
       ORDER BY p.created_at DESC`,
      [contentItemId],
    );
    return result.rows.map((row) => this.rowToPublication(row));
  }

  async updateStatus(id: string, status: PublicationStatus): Promise<Publication> {
    const now = nowIso();
    await this.db.execute(`UPDATE publications SET status = ?, updated_at = ? WHERE id = ?`, [
      status,
      now,
      id,
    ]);
    const updated = await this.getById(id);
    if (!updated) throw new Error(`Publication ${id} not found`);
    return updated;
  }

  async cancel(id: string): Promise<Publication> {
    return this.updateStatus(id, 'cancelled');
  }

  private rowToPublication(row: PublicationRow): Publication {
    const snapshot = row.prepared_snapshot_json
      ? (JSON.parse(row.prepared_snapshot_json) as PreparedPublicationSnapshot)
      : ({
          formatVersion: 1,
          platformId: row.platform_id,
          transformedContent: { text: '', images: [], warnings: [] },
          validationIssues: [],
          preparedAt: row.created_at,
        } satisfies PreparedPublicationSnapshot);

    return {
      id: row.id,
      batchId: row.batch_id ?? '',
      contentRevisionId: row.content_revision_id,
      socialAccountId: row.social_account_id,
      platformId: row.platform_id,
      status: row.status as PublicationStatus,
      preparedSnapshot: snapshot,
      scheduledAt: row.scheduled_at,
      publishedAt: row.published_at,
      remotePostId: row.remote_post_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export type { PublicationRepository };
