import type { Migration } from './index.js';

export const migrationV5: Migration = {
  version: 5,
  name: 'platform_connections',
  up: `
    CREATE TABLE IF NOT EXISTS platform_connections (
      id TEXT PRIMARY KEY,
      social_account_id TEXT NOT NULL UNIQUE,
      platform_id TEXT NOT NULL,
      method TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'connecting',
      external_account_id TEXT,
      connected_at TEXT,
      last_validated_at TEXT,
      secret_ref TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (social_account_id) REFERENCES social_accounts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform_id);
    CREATE INDEX IF NOT EXISTS idx_platform_connections_state ON platform_connections(state);
  `,
};
