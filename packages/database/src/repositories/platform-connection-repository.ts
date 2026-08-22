import type {
  ConnectionMethod,
  PlatformConnection,
  PlatformConnectionState,
} from '@reizoko/shared';
import { nowIso } from '@reizoko/shared';
import type { DatabaseClient } from '../client/database-client.js';
import type { PlatformConnectionRepository } from '@reizoko/core';

interface PlatformConnectionRow {
  id: string;
  platform_id: string;
  method: string;
  state: string;
  external_identity_id: string | null;
  display_name: string | null;
  handle: string | null;
  connected_at: string | null;
  last_validated_at: string | null;
  secret_ref: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export class SqlitePlatformConnectionRepository implements PlatformConnectionRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(connection: PlatformConnection): Promise<PlatformConnection> {
    const now = nowIso();
    await this.db.execute(
      `INSERT INTO platform_connections
       (id, platform_id, method, state, external_identity_id, display_name, handle,
        connected_at, last_validated_at, secret_ref, error_code, error_message, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        connection.id,
        connection.platformId,
        connection.method,
        connection.state,
        connection.externalIdentityId ?? null,
        connection.displayName ?? null,
        connection.handle ?? null,
        connection.connectedAt ?? null,
        connection.lastValidatedAt ?? null,
        connection.secretRef ?? null,
        connection.errorCode ?? null,
        connection.errorMessage ?? null,
        connection.createdAt ?? now,
        connection.updatedAt ?? now,
      ],
    );
    return (await this.getById(connection.id))!;
  }

  async getById(id: string): Promise<PlatformConnection | null> {
    const result = await this.db.select<PlatformConnectionRow>(
      'SELECT * FROM platform_connections WHERE id = ?',
      [id],
    );
    const row = result.rows[0];
    return row ? this.rowToConnection(row) : null;
  }

  async listByPlatform(platformId: string): Promise<PlatformConnection[]> {
    const result = await this.db.select<PlatformConnectionRow>(
      'SELECT * FROM platform_connections WHERE platform_id = ? ORDER BY updated_at DESC',
      [platformId],
    );
    return result.rows.map((row) => this.rowToConnection(row));
  }

  async listAll(): Promise<PlatformConnection[]> {
    const result = await this.db.select<PlatformConnectionRow>(
      'SELECT * FROM platform_connections ORDER BY updated_at DESC',
    );
    return result.rows.map((row) => this.rowToConnection(row));
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        PlatformConnection,
        | 'state'
        | 'externalIdentityId'
        | 'displayName'
        | 'handle'
        | 'connectedAt'
        | 'lastValidatedAt'
        | 'secretRef'
        | 'errorCode'
        | 'errorMessage'
      >
    >,
  ): Promise<PlatformConnection> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Platform connection ${id} not found`);

    const updated: PlatformConnection = {
      ...existing,
      ...patch,
      updatedAt: nowIso(),
    };

    await this.db.execute(
      `UPDATE platform_connections
       SET state = ?, external_identity_id = ?, display_name = ?, handle = ?,
           connected_at = ?, last_validated_at = ?, secret_ref = ?,
           error_code = ?, error_message = ?, updated_at = ?
       WHERE id = ?`,
      [
        updated.state,
        updated.externalIdentityId ?? null,
        updated.displayName ?? null,
        updated.handle ?? null,
        updated.connectedAt ?? null,
        updated.lastValidatedAt ?? null,
        updated.secretRef ?? null,
        updated.errorCode ?? null,
        updated.errorMessage ?? null,
        updated.updatedAt,
        id,
      ],
    );
    return (await this.getById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.execute('DELETE FROM platform_connections WHERE id = ?', [id]);
  }

  private rowToConnection(row: PlatformConnectionRow): PlatformConnection {
    return {
      id: row.id,
      platformId: row.platform_id,
      method: row.method as ConnectionMethod,
      state: row.state as PlatformConnectionState,
      externalIdentityId: row.external_identity_id,
      displayName: row.display_name,
      handle: row.handle,
      connectedAt: row.connected_at,
      lastValidatedAt: row.last_validated_at,
      secretRef: row.secret_ref,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
