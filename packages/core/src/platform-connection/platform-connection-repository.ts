import type { PlatformConnection, PlatformConnectionState } from '@reizoko/shared';

export interface PlatformConnectionRepository {
  create(connection: PlatformConnection): Promise<PlatformConnection>;
  getById(id: string): Promise<PlatformConnection | null>;
  listByPlatform(platformId: string): Promise<PlatformConnection[]>;
  listAll(): Promise<PlatformConnection[]>;
  update(
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
  ): Promise<PlatformConnection>;
  delete(id: string): Promise<void>;
}

export type { PlatformConnectionState };
