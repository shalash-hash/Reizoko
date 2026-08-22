import type { Migration } from './index.js';

export const migrationV4: Migration = {
  version: 4,
  name: 'social_accounts_architecture',
  up: `
    ALTER TABLE social_accounts ADD COLUMN handle TEXT;
    ALTER TABLE social_accounts ADD COLUMN external_account_id TEXT;
    ALTER TABLE social_accounts ADD COLUMN avatar_media_id TEXT;
    ALTER TABLE social_accounts ADD COLUMN connection_state TEXT NOT NULL DEFAULT 'local';
    ALTER TABLE social_accounts ADD COLUMN created_at TEXT;
    ALTER TABLE social_accounts ADD COLUMN updated_at TEXT;
    ALTER TABLE social_accounts ADD COLUMN deleted_at TEXT;

    UPDATE social_accounts
    SET created_at = connected_at
    WHERE created_at IS NULL;

    UPDATE social_accounts
    SET updated_at = connected_at
    WHERE updated_at IS NULL;

    UPDATE social_accounts
    SET connection_state = 'local'
    WHERE connection_state IS NULL OR connection_state = '';

    CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform_id);
    CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);
  `,
};
