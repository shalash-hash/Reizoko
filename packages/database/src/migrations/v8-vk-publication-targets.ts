import type { Migration } from './index.js';

export const migrationV8: Migration = {
  version: 8,
  name: 'vk_publication_targets',
  up: `
    ALTER TABLE social_accounts ADD COLUMN platform_metadata_json TEXT;
  `,
};
