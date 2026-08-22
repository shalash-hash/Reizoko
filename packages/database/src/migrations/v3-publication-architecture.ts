import type { Migration } from './index.js';

export const migrationV3: Migration = {
  version: 3,
  name: 'publication_architecture',
  up: `
    CREATE TABLE IF NOT EXISTS publication_batches (
      id TEXT PRIMARY KEY,
      content_item_id TEXT NOT NULL,
      content_revision_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (content_item_id) REFERENCES content_items(id),
      FOREIGN KEY (content_revision_id) REFERENCES content_revisions(id)
    );

    ALTER TABLE publications ADD COLUMN batch_id TEXT;
    ALTER TABLE publications ADD COLUMN prepared_snapshot_json TEXT;

    CREATE INDEX IF NOT EXISTS idx_publication_batches_item ON publication_batches(content_item_id);
    CREATE INDEX IF NOT EXISTS idx_publication_batches_revision ON publication_batches(content_revision_id);
    CREATE INDEX IF NOT EXISTS idx_publications_batch ON publications(batch_id);
  `,
};
