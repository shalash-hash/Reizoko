import type { Migration } from './index.js';

export const migrationV6: Migration = {
  version: 6,
  name: 'connection_destinations',
  up: `
    ALTER TABLE social_accounts ADD COLUMN connection_id TEXT;

    UPDATE social_accounts
    SET connection_id = (
      SELECT pc.id FROM platform_connections pc WHERE pc.social_account_id = social_accounts.id
    )
    WHERE EXISTS (
      SELECT 1 FROM platform_connections pc WHERE pc.social_account_id = social_accounts.id
    );

    CREATE TABLE platform_connections_v6 (
      id TEXT PRIMARY KEY,
      platform_id TEXT NOT NULL,
      method TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'connecting',
      external_identity_id TEXT,
      display_name TEXT,
      handle TEXT,
      connected_at TEXT,
      last_validated_at TEXT,
      secret_ref TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO platform_connections_v6 (
      id, platform_id, method, state, external_identity_id, display_name, handle,
      connected_at, last_validated_at, secret_ref, error_code, error_message, created_at, updated_at
    )
    SELECT
      id,
      platform_id,
      method,
      state,
      external_account_id,
      NULL,
      NULL,
      connected_at,
      last_validated_at,
      secret_ref,
      NULL,
      error_message,
      created_at,
      updated_at
    FROM platform_connections;

    DROP TABLE platform_connections;
    ALTER TABLE platform_connections_v6 RENAME TO platform_connections;

    CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform_id);
    CREATE INDEX IF NOT EXISTS idx_platform_connections_state ON platform_connections(state);
    CREATE INDEX IF NOT EXISTS idx_social_accounts_connection ON social_accounts(connection_id);

    ALTER TABLE publications ADD COLUMN remote_url TEXT;
    ALTER TABLE publications ADD COLUMN error_message TEXT;
    ALTER TABLE publications ADD COLUMN platform_response_metadata_json TEXT;
  `,
};
