export interface SecretStore {
  setSecret(key: string, value: string): Promise<void>;
  getSecret(key: string): Promise<string | null>;
  hasSecret(key: string): Promise<boolean>;
  deleteSecret(key: string): Promise<void>;
}

export class InMemorySecretStore implements SecretStore {
  private readonly secrets = new Map<string, string>();

  async setSecret(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }

  async getSecret(key: string): Promise<string | null> {
    return this.secrets.get(key) ?? null;
  }

  async hasSecret(key: string): Promise<boolean> {
    return this.secrets.has(key);
  }

  async deleteSecret(key: string): Promise<void> {
    this.secrets.delete(key);
  }

  /** Test helper — must not be used in production code paths. */
  clear(): void {
    this.secrets.clear();
  }
}
