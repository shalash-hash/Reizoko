import type { Migration } from './index.js';

export const migrationV7: Migration = {
  version: 7,
  name: 'platform_presentation_overrides',
  up: `
    CREATE TABLE IF NOT EXISTS platform_presentation_overrides (
      id TEXT PRIMARY KEY,
      content_item_id TEXT NOT NULL,
      target_key TEXT NOT NULL,
      platform_id TEXT NOT NULL,
      social_account_id TEXT,
      overrides_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(content_item_id, target_key)
    );

    CREATE INDEX IF NOT EXISTS idx_presentation_overrides_item
      ON platform_presentation_overrides(content_item_id);

    CREATE TABLE IF NOT EXISTS derived_media_variants (
      id TEXT PRIMARY KEY,
      source_media_id TEXT NOT NULL,
      transform_hash TEXT NOT NULL,
      local_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(source_media_id, transform_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_derived_media_source
      ON derived_media_variants(source_media_id);
  `,
};
