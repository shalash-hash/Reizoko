import {
  ContentBlock,
  ContentItem,
  ContentItemMetadata,
  ContentItemSummary,
  ContentItemWithRevision,
  ContentRevision,
  RevisionOrigin,
  generateId,
  nowIso,
} from '@reizoko/shared';
import { ContentRepository, REVISION_CHECKPOINT_GAP_MS, extractPreviewText } from '@reizoko/core';
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
  updated_at: string | null;
  blocks_json: string;
  metadata_json: string | null;
  version: number;
  origin: string;
  kind: string;
  restore_from_version: number | null;
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
      updatedAt: now,
      blocks,
      metadata,
      version: 1,
      origin: 'auto',
      kind: 'working',
    };

    await this.db.batch([
      {
        sql: `INSERT INTO content_items (id, created_at, updated_at, current_revision_id, metadata_json, sync_state)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [itemId, now, now, revisionId, JSON.stringify(metadata), 'local'],
      },
      {
        sql: `INSERT INTO content_revisions
              (id, content_item_id, created_at, updated_at, blocks_json, metadata_json, version, origin, kind)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          revisionId,
          itemId,
          now,
          now,
          JSON.stringify(blocks),
          JSON.stringify(metadata),
          1,
          'auto',
          'working',
        ],
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

  async getRevision(revisionId: string): Promise<ContentRevision | null> {
    return this.getRevisionById(revisionId);
  }

  async saveWorking(
    id: string,
    metadata: ContentItemMetadata,
    blocks: ContentBlock[],
  ): Promise<ContentItemWithRevision> {
    const existing = await this.getItem(id);
    if (!existing) throw new Error(`Content item ${id} not found`);

    const working = existing.revision;
    const now = nowIso();
    const lastUpdated = working.updatedAt ?? working.createdAt;
    const gapMs = new Date(now).getTime() - new Date(lastUpdated).getTime();

    if (gapMs >= REVISION_CHECKPOINT_GAP_MS) {
      await this.finalizeWorkingRevision(working.id);
      return this.insertWorkingRevision(id, metadata, blocks, 'auto', working.version + 1, now);
    }

    await this.db.batch([
      {
        sql: `UPDATE content_revisions
              SET blocks_json = ?, metadata_json = ?, updated_at = ?
              WHERE id = ? AND kind = 'working'`,
        params: [JSON.stringify(blocks), JSON.stringify(metadata), now, working.id],
      },
      {
        sql: `UPDATE content_items SET updated_at = ?, metadata_json = ? WHERE id = ?`,
        params: [now, JSON.stringify(metadata), id],
      },
    ]);

    const updated = await this.getItem(id);
    if (!updated) throw new Error(`Failed to reload content item ${id}`);
    return updated;
  }

  async createManualCheckpoint(id: string): Promise<ContentItemWithRevision> {
    const existing = await this.getItem(id);
    if (!existing) throw new Error(`Content item ${id} not found`);

    const working = existing.revision;
    const now = nowIso();

    await this.finalizeWorkingRevision(working.id);
    return this.insertWorkingRevision(
      id,
      working.metadata,
      working.blocks,
      'manual',
      working.version + 1,
      now,
    );
  }

  async createPublicationCheckpoint(id: string): Promise<{
    checkpoint: ContentRevision;
    item: ContentItemWithRevision;
  }> {
    const existing = await this.getItem(id);
    if (!existing) throw new Error(`Content item ${id} not found`);

    const working = existing.revision;
    const now = nowIso();

    await this.db.execute(
      `UPDATE content_revisions SET kind = 'checkpoint', origin = 'publication', updated_at = ? WHERE id = ?`,
      [now, working.id],
    );

    const item = await this.insertWorkingRevision(
      id,
      working.metadata,
      working.blocks,
      'auto',
      working.version + 1,
      now,
    );

    const checkpoint = await this.getRevisionById(working.id);
    if (!checkpoint) throw new Error(`Failed to load publication checkpoint for item ${id}`);

    return { checkpoint, item };
  }

  async restoreRevision(itemId: string, revisionId: string): Promise<ContentItemWithRevision> {
    const target = await this.getRevisionById(revisionId);
    if (!target || target.contentItemId !== itemId) {
      throw new Error(`Revision ${revisionId} not found for item ${itemId}`);
    }

    const existing = await this.getItem(itemId);
    if (!existing) throw new Error(`Content item ${itemId} not found`);

    const working = existing.revision;
    const now = nowIso();

    if (working.kind === 'working') {
      await this.finalizeWorkingRevision(working.id);
    }

    const nextVersion = working.version + 1;
    const newRevisionId = generateId();

    await this.db.batch([
      {
        sql: `INSERT INTO content_revisions
              (id, content_item_id, created_at, updated_at, blocks_json, metadata_json, version, origin, kind, restore_from_version)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'restore', 'working', ?)`,
        params: [
          newRevisionId,
          itemId,
          now,
          now,
          JSON.stringify(target.blocks),
          JSON.stringify(target.metadata),
          nextVersion,
          target.version,
        ],
      },
      {
        sql: `UPDATE content_items SET updated_at = ?, current_revision_id = ?, metadata_json = ? WHERE id = ?`,
        params: [now, newRevisionId, JSON.stringify(target.metadata), itemId],
      },
    ]);

    const restored = await this.getItem(itemId);
    if (!restored) throw new Error(`Failed to reload content item ${itemId}`);
    return restored;
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

  private async finalizeWorkingRevision(revisionId: string): Promise<void> {
    await this.db.execute(`UPDATE content_revisions SET kind = 'checkpoint' WHERE id = ?`, [revisionId]);
  }

  private async insertWorkingRevision(
    itemId: string,
    metadata: ContentItemMetadata,
    blocks: ContentBlock[],
    origin: RevisionOrigin,
    version: number,
    now: string,
  ): Promise<ContentItemWithRevision> {
    const revisionId = generateId();

    await this.db.batch([
      {
        sql: `INSERT INTO content_revisions
              (id, content_item_id, created_at, updated_at, blocks_json, metadata_json, version, origin, kind)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'working')`,
        params: [
          revisionId,
          itemId,
          now,
          now,
          JSON.stringify(blocks),
          JSON.stringify(metadata),
          version,
          origin,
        ],
      },
      {
        sql: `UPDATE content_items SET updated_at = ?, current_revision_id = ?, metadata_json = ? WHERE id = ?`,
        params: [now, revisionId, JSON.stringify(metadata), itemId],
      },
    ]);

    const updated = await this.getItem(itemId);
    if (!updated) throw new Error(`Failed to reload content item ${itemId}`);
    return updated;
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
    const itemMetadataFallback = { title: 'Без названия' } satisfies ContentItemMetadata;
    return {
      id: row.id,
      contentItemId: row.content_item_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      blocks: JSON.parse(row.blocks_json) as ContentBlock[],
      metadata: row.metadata_json
        ? (JSON.parse(row.metadata_json) as ContentItemMetadata)
        : itemMetadataFallback,
      version: row.version,
      origin: (row.origin as ContentRevision['origin']) ?? 'legacy',
      kind: (row.kind as ContentRevision['kind']) ?? 'checkpoint',
      restoreFromVersion: row.restore_from_version,
    };
  }
}

export type { ContentRepository };
