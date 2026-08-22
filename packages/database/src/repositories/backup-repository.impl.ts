import {
  type AppSettingEntry,
  type ContentBlock,
  type ContentItem,
  type ContentItemMetadata,
  type ContentRevision,
  type MediaItem,
  type Publication,
  type PublicationBatch,
  type ReizokoBackupData,
  type SocialAccount,
  type WorkspaceState,
  type PreparedPublicationSnapshot,
} from '@reizoko/shared';
import type { BackupRepository } from '@reizoko/core';
import { normalizeWorkspaceState } from '@reizoko/core';
import { DatabaseClient } from '../client/database-client.js';
import { MIGRATIONS } from '../migrations/index.js';

export class SqliteBackupRepository implements BackupRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getSchemaVersion(): Promise<number> {
    const result = await this.db.select<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_migrations',
    );
    return result.rows[0]?.version ?? MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 1;
  }

  async exportSnapshot(): Promise<ReizokoBackupData> {
    const contentItems = await this.selectContentItems();
    const contentRevisions = await this.selectContentRevisions();
    const mediaItems = await this.selectMediaItems();
    const socialAccounts = await this.selectSocialAccounts();
    const publicationBatches = await this.selectPublicationBatches();
    const publications = await this.selectPublications();
    const appSettings = await this.selectAppSettings();
    const workspaceState = await this.selectWorkspaceState();

    return {
      contentItems,
      contentRevisions,
      mediaItems,
      socialAccounts,
      publicationBatches,
      publications,
      appSettings,
      workspaceState,
    };
  }

  async restoreSnapshot(data: ReizokoBackupData): Promise<void> {
    const workspaceState = data.workspaceState
      ? normalizeWorkspaceState(data.workspaceState)
      : null;

    await this.db.batch([
      { sql: 'DELETE FROM publications' },
      { sql: 'DELETE FROM publication_batches' },
      { sql: 'DELETE FROM content_revisions' },
      { sql: 'DELETE FROM content_items' },
      { sql: 'DELETE FROM social_accounts' },
      { sql: 'DELETE FROM media_items' },
      { sql: 'DELETE FROM app_settings' },
      { sql: 'DELETE FROM workspace_state' },
    ]);

    const statements: Array<{ sql: string; params?: unknown[] }> = [];

    for (const item of data.contentItems) {
      statements.push({
        sql: `INSERT INTO content_items
              (id, created_at, updated_at, deleted_at, current_revision_id, metadata_json, sync_state, device_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          item.id,
          item.createdAt,
          item.updatedAt,
          item.deletedAt ?? null,
          item.currentRevisionId,
          JSON.stringify(item.metadata),
          item.syncState ?? 'local',
          item.deviceId ?? null,
        ],
      });
    }

    for (const revision of data.contentRevisions) {
      statements.push({
        sql: `INSERT INTO content_revisions
              (id, content_item_id, created_at, updated_at, blocks_json, metadata_json, version, origin, kind, restore_from_version)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          revision.id,
          revision.contentItemId,
          revision.createdAt,
          revision.updatedAt,
          JSON.stringify(revision.blocks),
          JSON.stringify(revision.metadata),
          revision.version,
          revision.origin,
          revision.kind,
          revision.restoreFromVersion ?? null,
        ],
      });
    }

    for (const media of data.mediaItems) {
      statements.push({
        sql: `INSERT INTO media_items
              (id, filename, mime_type, size, width, height, local_path, created_at, updated_at, deleted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          media.id,
          media.filename,
          media.mimeType,
          media.size,
          media.width ?? null,
          media.height ?? null,
          media.localPath,
          media.createdAt,
          media.updatedAt,
          media.deletedAt ?? null,
        ],
      });
    }

    for (const account of data.socialAccounts) {
      statements.push({
        sql: `INSERT INTO social_accounts
              (id, platform_id, display_name, handle, external_account_id, avatar_media_id,
               connected_at, created_at, updated_at, deleted_at, is_active, connection_state)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          account.id,
          account.platformId,
          account.displayName,
          account.handle ?? null,
          account.externalAccountId ?? null,
          account.avatarMediaId ?? null,
          account.createdAt,
          account.createdAt,
          account.updatedAt,
          account.deletedAt ?? null,
          account.isActive ? 1 : 0,
          account.connectionState,
        ],
      });
    }

    for (const batch of data.publicationBatches) {
      statements.push({
        sql: `INSERT INTO publication_batches
              (id, content_item_id, content_revision_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
        params: [
          batch.id,
          batch.contentItemId,
          batch.contentRevisionId,
          batch.createdAt,
          batch.updatedAt,
        ],
      });
    }

    for (const publication of data.publications) {
      statements.push({
        sql: `INSERT INTO publications
              (id, batch_id, content_revision_id, social_account_id, platform_id, status,
               prepared_snapshot_json, scheduled_at, published_at, remote_post_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          publication.id,
          publication.batchId,
          publication.contentRevisionId,
          publication.socialAccountId ?? null,
          publication.platformId,
          publication.status,
          JSON.stringify(publication.preparedSnapshot),
          publication.scheduledAt ?? null,
          publication.publishedAt ?? null,
          publication.remotePostId ?? null,
          publication.createdAt,
          publication.updatedAt,
        ],
      });
    }

    for (const setting of data.appSettings) {
      statements.push({
        sql: `INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)`,
        params: [setting.key, JSON.stringify(setting.value), setting.updatedAt],
      });
    }

    if (workspaceState) {
      statements.push({
        sql: `INSERT INTO workspace_state (id, state_json, updated_at) VALUES (1, ?, ?)`,
        params: [JSON.stringify(workspaceState), new Date().toISOString()],
      });
    }

    if (statements.length > 0) {
      await this.db.batch(statements);
    }
  }

  private async selectContentItems(): Promise<ContentItem[]> {
    const result = await this.db.select<{
      id: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
      current_revision_id: string;
      metadata_json: string;
      sync_state: string | null;
      device_id: string | null;
    }>(`SELECT * FROM content_items ORDER BY created_at ASC`);

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      currentRevisionId: row.current_revision_id,
      metadata: JSON.parse(row.metadata_json) as ContentItemMetadata,
      syncState: (row.sync_state as ContentItem['syncState']) ?? 'local',
      deviceId: row.device_id ?? undefined,
    }));
  }

  private async selectContentRevisions(): Promise<ContentRevision[]> {
    const result = await this.db.select<{
      id: string;
      content_item_id: string;
      created_at: string;
      updated_at: string | null;
      blocks_json: string;
      metadata_json: string | null;
      version: number;
      origin: string;
      kind: string;
      restore_from_version: number | null;
    }>(`SELECT * FROM content_revisions ORDER BY content_item_id ASC, version ASC`);

    return result.rows.map((row) => ({
      id: row.id,
      contentItemId: row.content_item_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
      blocks: JSON.parse(row.blocks_json) as ContentBlock[],
      metadata: row.metadata_json
        ? (JSON.parse(row.metadata_json) as ContentItemMetadata)
        : { title: 'Без названия' },
      version: row.version,
      origin: (row.origin as ContentRevision['origin']) ?? 'legacy',
      kind: (row.kind as ContentRevision['kind']) ?? 'checkpoint',
      restoreFromVersion: row.restore_from_version,
    }));
  }

  private async selectMediaItems(): Promise<MediaItem[]> {
    const result = await this.db.select<{
      id: string;
      filename: string;
      mime_type: string;
      size: number;
      width: number | null;
      height: number | null;
      local_path: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }>(`SELECT * FROM media_items ORDER BY created_at ASC`);

    return result.rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      localPath: row.local_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));
  }

  private async selectSocialAccounts(): Promise<SocialAccount[]> {
    const result = await this.db.select<{
      id: string;
      platform_id: string;
      display_name: string;
      handle: string | null;
      external_account_id: string | null;
      avatar_media_id: string | null;
      connected_at: string;
      created_at: string | null;
      updated_at: string | null;
      deleted_at: string | null;
      is_active: number;
      connection_state: string;
    }>(`SELECT * FROM social_accounts ORDER BY created_at ASC`);

    return result.rows.map((row) => ({
      id: row.id,
      platformId: row.platform_id,
      displayName: row.display_name,
      handle: row.handle,
      externalAccountId: row.external_account_id,
      avatarMediaId: row.avatar_media_id,
      isActive: row.is_active === 1,
      connectionState: (row.connection_state as SocialAccount['connectionState']) ?? 'local',
      createdAt: row.created_at ?? row.connected_at,
      updatedAt: row.updated_at ?? row.connected_at,
      deletedAt: row.deleted_at,
    }));
  }

  private async selectPublicationBatches(): Promise<PublicationBatch[]> {
    const result = await this.db.select<{
      id: string;
      content_item_id: string;
      content_revision_id: string;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM publication_batches ORDER BY created_at ASC`);

    return result.rows.map((row) => ({
      id: row.id,
      contentItemId: row.content_item_id,
      contentRevisionId: row.content_revision_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  private async selectPublications(): Promise<Publication[]> {
    const result = await this.db.select<{
      id: string;
      batch_id: string | null;
      content_revision_id: string;
      social_account_id: string | null;
      platform_id: string;
      status: string;
      prepared_snapshot_json: string | null;
      scheduled_at: string | null;
      published_at: string | null;
      remote_post_id: string | null;
      created_at: string;
      updated_at: string;
    }>(`SELECT * FROM publications ORDER BY created_at ASC`);

    return result.rows.map((row) => {
      const snapshot = row.prepared_snapshot_json
        ? (JSON.parse(row.prepared_snapshot_json) as PreparedPublicationSnapshot)
        : ({
            formatVersion: 1,
            platformId: row.platform_id,
            transformedContent: { text: '', images: [], warnings: [] },
            validationIssues: [],
            preparedAt: row.created_at,
          } satisfies PreparedPublicationSnapshot);

      return {
        id: row.id,
        batchId: row.batch_id ?? '',
        contentRevisionId: row.content_revision_id,
        socialAccountId: row.social_account_id,
        platformId: row.platform_id,
        status: row.status as Publication['status'],
        preparedSnapshot: snapshot,
        scheduledAt: row.scheduled_at,
        publishedAt: row.published_at,
        remotePostId: row.remote_post_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  private async selectAppSettings(): Promise<AppSettingEntry[]> {
    const result = await this.db.select<{
      key: string;
      value_json: string;
      updated_at: string;
    }>(`SELECT * FROM app_settings ORDER BY key ASC`);

    return result.rows.map((row) => ({
      key: row.key,
      value: JSON.parse(row.value_json) as unknown,
      updatedAt: row.updated_at,
    }));
  }

  private async selectWorkspaceState(): Promise<WorkspaceState | null> {
    const result = await this.db.select<{ state_json: string }>(
      `SELECT state_json FROM workspace_state WHERE id = 1`,
    );
    if (!result.rows[0]) return null;
    return JSON.parse(result.rows[0].state_json) as WorkspaceState;
  }
}

export type { BackupRepository };
