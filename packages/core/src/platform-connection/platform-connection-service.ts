import type { SecretPurpose, SocialAccount } from '@reizoko/shared';
import { buildSecretRef } from '@reizoko/shared';
import type { SecretStore } from '../security/secret-store.js';
import type { PlatformConnectionRepository } from './platform-connection-repository.js';

export class PlatformConnectionService {
  constructor(
    private readonly repository: PlatformConnectionRepository,
    private readonly secretStore: SecretStore,
  ) {}

  async storeSecret(connectionId: string, purpose: SecretPurpose, value: string): Promise<string> {
    const secretRef = buildSecretRef(connectionId, purpose);
    await this.secretStore.setSecret(secretRef, value);
    const exists = await this.secretStore.hasSecret(secretRef);
    if (!exists) {
      throw new Error('SECRET_STORE_VERIFY_FAILED');
    }
    return secretRef;
  }

  async deleteConnectionSecrets(
    connectionId: string,
    purposes: SecretPurpose[] = [
      'access_token',
      'refresh_token',
      'bot_token',
      'api_hash',
      'session',
      'service_token',
    ],
  ): Promise<void> {
    for (const purpose of purposes) {
      await this.secretStore.deleteSecret(buildSecretRef(connectionId, purpose));
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    await this.deleteConnectionSecrets(connectionId);
    await this.repository.update(connectionId, {
      state: 'needs_reconnect',
      secretRef: null,
      connectedAt: null,
      lastValidatedAt: null,
      errorCode: null,
      errorMessage: null,
    });
  }

  resolveAccountConnectionState(
    account: Pick<SocialAccount, 'connectionId'>,
    connection: { state: string; secretRef?: string | null } | null,
  ): SocialAccount['connectionState'] {
    if (!account.connectionId) return 'local';
    if (!connection || connection.state !== 'connected') {
      return 'needs_reconnect';
    }
    return 'connected';
  }
}
