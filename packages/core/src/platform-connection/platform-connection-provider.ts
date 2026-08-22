import type {
  ConnectionCapabilities,
  ConnectionRequest,
  ConnectionResult,
  ConnectionValidation,
  PlatformConnection,
} from '@reizoko/shared';

export interface PlatformConnectionProvider {
  readonly platformId: string;
  getCapabilities(): ConnectionCapabilities;
  connect(request: ConnectionRequest): Promise<ConnectionResult>;
  refresh?(connection: PlatformConnection): Promise<ConnectionResult>;
  validate(connection: PlatformConnection): Promise<ConnectionValidation>;
  disconnect(connection: PlatformConnection): Promise<void>;
}
