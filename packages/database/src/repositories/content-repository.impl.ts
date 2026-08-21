import {
  ContentBlock,
  ContentItem,
  ContentItemMetadata,
  ContentItemSummary,
  ContentItemWithRevision,
  ContentRevision,
  generateId,
  nowIso,
} from '@reizoko/shared';
import { ContentRepository, extractPreviewText } from '@reizoko/core';
import { DatabaseClient } from '../client/database-client.js';

interface ContentItemRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  current_revision_id: string;
  metadata_json: string;
  sync_state: string | null;
  device_id: string | null;
}

interface ContentRevisionRow {
  id: string;
  content_item_id: string;
  created_at: string;
  blocks_json: string;
  version: number;
}

export class SqliteContentRepository implements ContentRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createItem(
    metadata: ContentItemMetadata,
    blocks: ContentBlock[],
  ): Promise<ContentItemWithRevision> {
    const itemId = generateId();
    const revisionId = generateId();
    const now = nowIso();

    const item: ContentItem = {
      id: itemId,
      createdAt: now,
      updatedAt: now,
      currentRevisionId: revisionId,
      metadata,
      syncState: 'local',
    };

    const revision: ContentRevision = {
      id: revisionId,
      contentItemId: itemId,
      createdAt: now,
      blocks,
      version: 1,
    };

    await this.db.batch([
      {
        sql: `INSERT INTO content_items (id, created_at, updated_at, current_revision_id, metadata_json, sync_state)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [itemId, now, now, revisionId, JSON.stringify(metadata), 'local'],
      },
      {
        sql: `INSERT INTO content_revisions (id, content_item_id, created_at, blocks_json, version)
              VALUES (?, ?, ?, ?, ?)`,
        params: [revisionId, itemId, now, JSON.stringify(blocks), 1],
      },
    ]);

    return { ...item, revision };
  }

  async getItem(id: string): Promise<ContentItemWithRevision | null> {
    const result = await this.db.select<ContentItemRow>(
      `SELECT * FROM content_items WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;

    const revision = await this.getRevisionById(row.current_revision_id);
    if (!revision) return null;

    return { ...this.rowToItem(row), revision };
  }

  async updateItem(
    id: string,
    metadata: ContentItemMetadata,
    blocks: ContentBlock[],
  ): Promise<ContentItemWithRevision> {
    const existing = await this.getItem(id);
    if (!existing) throw new Error(`Content item ${id} not found`);

    const revisionId = generateId();
    const now = nowIso();
    const newVersion = existing.revision.version + 1;

    await this.db.batch([
      {
        sql: `UPDATE content_items SET updated_at = ?, current_revision_id = ?, metadata_json = ? WHERE id = ?`,
        params: [now, revisionId, JSON.stringify(metadata), id],
      },
      {
        sql: `INSERT INTO content_revisions (id, content_item_id, created_at, blocks_json, version)
              VALUES (?, ?, ?, ?, ?)`,
        params: [revisionId, id, now, JSON.stringify(blocks), newVersion],
      },
    ]);

    const updated = await this.getItem(id);
    if (!updated) throw new Error(`Failed to reload content item ${id}`);
    return updated;
  }

  async listItems(search?: string): Promise<ContentItemSummary[]> {
    let sql = `SELECT ci.*, cr.blocks_json
               FROM content_items ci
               JOIN content_revisions cr ON ci.current_revision_id = cr.id
               WHERE ci.deleted_at IS NULL
               ORDER BY ci.updated_at DESC`;
    const params: unknown[] = [];

    if (search?.trim()) {
      sql = `SELECT ci.*, cr.blocks_json
             FROM content_items ci
             JOIN content_revisions cr ON ci.current_revision_id = cr.id
             WHERE ci.deleted_at IS NULL
             AND (ci.metadata_json LIKE ? OR cr.blocks_json LIKE ?)
             ORDER BY ci.updated_at DESC`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const result = await this.db.select<ContentItemRow & { blocks_json: string }>(sql, params);

    return result.rows.map((row) => {
      const metadata = JSON.parse(row.metadata_json) as ContentItemMetadata;
      const blocks = JSON.parse(row.blocks_json) as ContentBlock[];
      return {
        id: row.id,
        title: metadata.title,
        previewText: extractPreviewText(blocks),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async duplicateItem(id: string): Promise<ContentItemWithRevision> {
    const existing = await this.getItem(id);
    if (!existing) throw new Error(`Content item ${id} not found`);

    const metadata: ContentItemMetadata = {
      ...existing.metadata,
      title: `${existing.metadata.title} (копия)`,
    };

    const blocks = existing.revision.blocks.map((block) => ({
      ...block,
      id: generateId(),
    }));

    return this.createItem(metadata, blocks);
  }

  async deleteItem(id: string): Promise<void> {
    await this.db.execute(`UPDATE content_items SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
      nowIso(),
      nowIso(),
      id,
    ]);
  }

  async getRevisions(contentItemId: string): Promise<ContentRevision[]> {
    const result = await this.db.select<ContentRevisionRow>(
      `SELECT * FROM content_revisions WHERE content_item_id = ? ORDER BY version DESC`,
      [contentItemId],
    );
    return result.rows.map((row) => this.rowToRevision(row));
  }

  private async getRevisionById(id: string): Promise<ContentRevision | null> {
    const result = await this.db.select<ContentRevisionRow>(
      `SELECT * FROM content_revisions WHERE id = ?`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.rowToRevision(row) : null;
  }

  private rowToItem(row: ContentItemRow): ContentItem {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      currentRevisionId: row.current_revision_id,
      metadata: JSON.parse(row.metadata_json) as ContentItemMetadata,
      syncState: (row.sync_state as ContentItem['syncState']) ?? 'local',
      deviceId: row.device_id ?? undefined,
    };
  }

  private rowToRevision(row: ContentRevisionRow): ContentRevision {
    return {
      id: row.id,
      contentItemId: row.content_item_id,
      createdAt: row.created_at,
      blocks: JSON.parse(row.blocks_json) as ContentBlock[],
      version: row.version,
    };
  }
}

export type { ContentRepository };
