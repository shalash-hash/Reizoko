import {
  generateId,
  nowIso,
  type CreateSocialAccountInput,
  type SocialAccount,
  type UpdateSocialAccountInput,
} from '@reizoko/shared';
import type {
  SocialAccountListOptions,
  SocialAccountRepository,
} from '@reizoko/core';
import { DatabaseClient } from '../client/database-client.js';

interface SocialAccountRow {
  id: string;
  platform_id: string;
  display_name: string;
  handle: string | null;
  external_account_id: string | null;
  avatar_media_id: string | null;
  connection_id: string | null;
  connected_at: string;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  is_active: number;
  connection_state: string;
}

export class SqliteSocialAccountRepository implements SocialAccountRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateSocialAccountInput): Promise<SocialAccount> {
    const id = generateId();
    const now = nowIso();
    const account: SocialAccount = {
      id,
      platformId: input.platformId,
      displayName: input.displayName.trim(),
      handle: input.handle?.trim() || null,
      externalAccountId: input.externalAccountId ?? null,
      avatarMediaId: input.avatarMediaId ?? null,
      connectionId: input.connectionId ?? null,
      isActive: true,
      connectionState: input.connectionId ? 'connected' : 'local',
      createdAt: now,
      updatedAt: now,
    };

    await this.db.execute(
      `INSERT INTO social_accounts
       (id, platform_id, display_name, handle, external_account_id, avatar_media_id, connection_id,
        connected_at, created_at, updated_at, deleted_at, is_active, connection_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`,
      [
        id,
        account.platformId,
        account.displayName,
        account.handle,
        account.externalAccountId,
        account.avatarMediaId,
        account.connectionId,
        now,
        now,
        now,
        account.connectionState,
      ],
    );

    return account;
  }

  async getById(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<SocialAccount | null> {
    const result = await this.db.select<SocialAccountRow>(
      `SELECT * FROM social_accounts WHERE id = ?`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.deleted_at && !options?.includeDeleted) return null;
    return this.rowToAccount(row);
  }

  async listAll(options?: SocialAccountListOptions): Promise<SocialAccount[]> {
    const clauses: string[] = [];
    if (!options?.includeDeleted) clauses.push('deleted_at IS NULL');
    if (!options?.includeInactive) clauses.push('is_active = 1');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.db.select<SocialAccountRow>(
      `SELECT * FROM social_accounts ${where} ORDER BY created_at ASC, display_name ASC`,
    );
    return result.rows.map((row) => this.rowToAccount(row));
  }

  async listByPlatform(
    platformId: string,
    options?: SocialAccountListOptions,
  ): Promise<SocialAccount[]> {
    const accounts = await this.listAll(options);
    return accounts.filter((account) => account.platformId === platformId);
  }

  async update(id: string, input: UpdateSocialAccountInput): Promise<SocialAccount> {
    const existing = await this.getById(id, { includeDeleted: true });
    if (!existing || existing.deletedAt) {
      throw new Error(`Social account ${id} not found`);
    }

    const now = nowIso();
    const displayName = input.displayName?.trim() ?? existing.displayName;
    const handle =
      input.handle !== undefined ? input.handle?.trim() || null : existing.handle ?? null;
    const avatarMediaId =
      input.avatarMediaId !== undefined ? input.avatarMediaId : existing.avatarMediaId ?? null;
    const connectionId =
      input.connectionId !== undefined ? input.connectionId : existing.connectionId ?? null;
    const externalAccountId =
      input.externalAccountId !== undefined
        ? input.externalAccountId
        : existing.externalAccountId ?? null;
    const connectionState = input.connectionState ?? existing.connectionState;

    await this.db.execute(
      `UPDATE social_accounts
       SET display_name = ?, handle = ?, avatar_media_id = ?, connection_id = ?,
           external_account_id = ?, connection_state = ?, updated_at = ?
       WHERE id = ?`,
      [
        displayName,
        handle,
        avatarMediaId,
        connectionId,
        externalAccountId,
        connectionState,
        now,
        id,
      ],
    );

    const updated = await this.getById(id, { includeDeleted: true });
    if (!updated) throw new Error(`Failed to reload social account ${id}`);
    return updated;
  }

  async setActive(id: string, isActive: boolean): Promise<SocialAccount> {
    const existing = await this.getById(id, { includeDeleted: true });
    if (!existing || existing.deletedAt) {
      throw new Error(`Social account ${id} not found`);
    }

    const now = nowIso();
    await this.db.execute(`UPDATE social_accounts SET is_active = ?, updated_at = ? WHERE id = ?`, [
      isActive ? 1 : 0,
      now,
      id,
    ]);

    const updated = await this.getById(id, { includeDeleted: true });
    if (!updated) throw new Error(`Failed to reload social account ${id}`);
    return updated;
  }

  async softDelete(id: string): Promise<SocialAccount> {
    const existing = await this.getById(id, { includeDeleted: true });
    if (!existing || existing.deletedAt) {
      throw new Error(`Social account ${id} not found`);
    }

    const now = nowIso();
    await this.db.execute(
      `UPDATE social_accounts SET deleted_at = ?, is_active = 0, updated_at = ? WHERE id = ?`,
      [now, now, id],
    );

    const updated = await this.getById(id, { includeDeleted: true });
    if (!updated) throw new Error(`Failed to reload social account ${id}`);
    return updated;
  }

  async isReferencedByPublications(id: string): Promise<boolean> {
    const result = await this.db.select<{ count: number }>(
      `SELECT COUNT(*) as count FROM publications WHERE social_account_id = ?`,
      [id],
    );
    return (result.rows[0]?.count ?? 0) > 0;
  }

  async listByConnectionId(connectionId: string): Promise<SocialAccount[]> {
    const result = await this.db.select<SocialAccountRow>(
      `SELECT * FROM social_accounts WHERE connection_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      [connectionId],
    );
    return result.rows.map((row) => this.rowToAccount(row));
  }

  async clearConnectionForAccounts(connectionId: string): Promise<void> {
    const now = nowIso();
    await this.db.execute(
      `UPDATE social_accounts
       SET connection_state = 'needs_reconnect', updated_at = ?
       WHERE connection_id = ? AND deleted_at IS NULL`,
      [now, connectionId],
    );
  }

  private rowToAccount(row: SocialAccountRow): SocialAccount {
    return {
      id: row.id,
      platformId: row.platform_id,
      displayName: row.display_name,
      handle: row.handle,
      externalAccountId: row.external_account_id,
      avatarMediaId: row.avatar_media_id,
      connectionId: row.connection_id,
      isActive: row.is_active === 1,
      connectionState: (row.connection_state as SocialAccount['connectionState']) ?? 'local',
      createdAt: row.created_at ?? row.connected_at,
      updatedAt: row.updated_at ?? row.connected_at,
      deletedAt: row.deleted_at,
    };
  }
}

export type { SocialAccountRepository };
