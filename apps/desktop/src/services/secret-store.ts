import { invoke } from '@tauri-apps/api/core';
import type { SecretStore } from '@reizoko/core';

/**
 * Windows Credential Manager via Tauri `keyring` commands.
 * Secrets never touch SQLite, JSON backups, or app logs.
 */
export class WindowsCredentialSecretStore implements SecretStore {
  async setSecret(key: string, value: string): Promise<void> {
    await invoke('set_secret', { key, value });
  }

  async getSecret(key: string): Promise<string | null> {
    return invoke<string | null>('get_secret', { key });
  }

  async deleteSecret(key: string): Promise<void> {
    await invoke('delete_secret', { key });
  }

  async hasSecret(key: string): Promise<boolean> {
    return invoke<boolean>('has_secret_command', { key });
  }
}

export function createSecretStore(): SecretStore {
  return new WindowsCredentialSecretStore();
}
