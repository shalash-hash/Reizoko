import type { PlatformPresentationOverrides } from '@reizoko/shared';
import { generateId, nowIso } from '@reizoko/shared';
import { DatabaseClient } from '../client/database-client.js';

interface PresentationRow {
  id: string;
  content_item_id: string;
  target_key: string;
  platform_id: string;
  social_account_id: string | null;
  overrides_json: string;
  created_at: string;
  updated_at: string;
}

export class SqlitePresentationOverridesRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getByTarget(
    contentItemId: string,
    targetKey: string,
  ): Promise<PlatformPresentationOverrides | null> {
    const result = await this.db.select<PresentationRow>(
      `SELECT * FROM platform_presentation_overrides
       WHERE content_item_id = ? AND target_key = ?`,
      [contentItemId, targetKey],
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.rowToModel(row);
  }

  async listByContentItem(contentItemId: string): Promise<PlatformPresentationOverrides[]> {
    const result = await this.db.select<PresentationRow>(
      `SELECT * FROM platform_presentation_overrides
       WHERE content_item_id = ?
       ORDER BY updated_at DESC`,
      [contentItemId],
    );
    return result.rows.map((row) => this.rowToModel(row));
  }

  async upsert(
    input: Omit<PlatformPresentationOverrides, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
    },
  ): Promise<PlatformPresentationOverrides> {
    const existing = await this.getByTarget(input.contentItemId, input.targetKey);
    const now = nowIso();
    const model: PlatformPresentationOverrides = {
      id: existing?.id ?? input.id ?? generateId(),
      contentItemId: input.contentItemId,
      targetKey: input.targetKey,
      platformId: input.platformId,
      socialAccountId: input.socialAccountId ?? null,
      text: input.text,
      media: input.media,
      carouselOrder: input.carouselOrder,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: now,
    };

    await this.db.execute(
      `INSERT INTO platform_presentation_overrides
       (id, content_item_id, target_key, platform_id, social_account_id, overrides_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(content_item_id, target_key) DO UPDATE SET
         platform_id = excluded.platform_id,
         social_account_id = excluded.social_account_id,
         overrides_json = excluded.overrides_json,
         updated_at = excluded.updated_at`,
      [
        model.id,
        model.contentItemId,
        model.targetKey,
        model.platformId,
        model.socialAccountId,
        JSON.stringify({
          text: model.text,
          media: model.media,
          carouselOrder: model.carouselOrder,
        }),
        model.createdAt,
        model.updatedAt,
      ],
    );

    return model;
  }

  async deleteByTarget(contentItemId: string, targetKey: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM platform_presentation_overrides WHERE content_item_id = ? AND target_key = ?`,
      [contentItemId, targetKey],
    );
  }

  private rowToModel(row: PresentationRow): PlatformPresentationOverrides {
    const payload = JSON.parse(row.overrides_json) as {
      text?: PlatformPresentationOverrides['text'];
      media?: PlatformPresentationOverrides['media'];
      carouselOrder?: string[];
    };
    return {
      id: row.id,
      contentItemId: row.content_item_id,
      targetKey: row.target_key,
      platformId: row.platform_id,
      socialAccountId: row.social_account_id,
      text: payload.text,
      media: payload.media ?? [],
      carouselOrder: payload.carouselOrder,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
