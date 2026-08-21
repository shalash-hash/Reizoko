export interface SyncMetadata {
  deviceId?: string;
  syncState?: 'local' | 'pending' | 'synced' | 'conflict';
  lastSyncedAt?: string;
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface VersionedEntity extends Timestamps {
  id: string;
}
