import type { ReizokoBackupData } from '@reizoko/shared';

export interface BackupRepository {
  exportSnapshot(): Promise<ReizokoBackupData>;
  restoreSnapshot(data: ReizokoBackupData): Promise<void>;
  getSchemaVersion(): Promise<number>;
}
