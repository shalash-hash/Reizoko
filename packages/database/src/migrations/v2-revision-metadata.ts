import type { Migration } from './index.js';

export const migrationV2: Migration = {
  version: 2,
  name: 'revision_metadata',
  up: `
    ALTER TABLE content_revisions ADD COLUMN metadata_json TEXT;
    ALTER TABLE content_revisions ADD COLUMN origin TEXT NOT NULL DEFAULT 'legacy';
    ALTER TABLE content_revisions ADD COLUMN kind TEXT NOT NULL DEFAULT 'checkpoint';
    ALTER TABLE content_revisions ADD COLUMN restore_from_version INTEGER;
    ALTER TABLE content_revisions ADD COLUMN updated_at TEXT;

    UPDATE content_revisions
    SET updated_at = created_at
    WHERE updated_at IS NULL;

    UPDATE content_revisions
    SET metadata_json = (
      SELECT ci.metadata_json
      FROM content_items ci
      WHERE ci.id = content_revisions.content_item_id
    )
    WHERE metadata_json IS NULL;

    UPDATE content_revisions
    SET kind = 'working'
    WHERE id IN (SELECT current_revision_id FROM content_items);
  `,
};
