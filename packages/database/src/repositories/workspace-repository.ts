import { WorkspaceState, nowIso } from '@reizoko/shared';
import { DEFAULT_WORKSPACE, normalizeWorkspaceState } from '@reizoko/core';
import { DatabaseClient } from '../client/database-client.js';

export class SqliteWorkspaceRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getState(): Promise<WorkspaceState> {
    const result = await this.db.select<{ state_json: string }>(
      `SELECT state_json FROM workspace_state WHERE id = 1`,
    );
    if (!result.rows[0]) return { ...DEFAULT_WORKSPACE };
    const parsed = JSON.parse(result.rows[0].state_json) as WorkspaceState;
    return normalizeWorkspaceState(parsed);
  }

  async saveState(state: WorkspaceState): Promise<void> {
    const normalized = normalizeWorkspaceState(state);
    const now = nowIso();
    await this.db.execute(
      `INSERT INTO workspace_state (id, state_json, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
      [JSON.stringify(normalized), now],
    );
  }
}
