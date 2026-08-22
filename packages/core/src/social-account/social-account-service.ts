import {
  type CreateSocialAccountInput,
  type SocialAccount,
  type UpdateSocialAccountInput,
} from '@reizoko/shared';
import type { SocialAccountRepository } from './social-account-repository.js';

export class SocialAccountService {
  constructor(
    private readonly repository: SocialAccountRepository,
    private readonly isValidPlatformId: (platformId: string) => boolean,
  ) {}

  async createAccount(input: CreateSocialAccountInput): Promise<SocialAccount> {
    this.validateCreateInput(input);
    return this.repository.create(input);
  }

  async updateAccount(id: string, input: UpdateSocialAccountInput): Promise<SocialAccount> {
    if (input.displayName !== undefined) {
      this.assertDisplayName(input.displayName);
    }
    return this.repository.update(id, input);
  }

  async removeAccount(id: string): Promise<SocialAccount> {
    return this.repository.softDelete(id);
  }

  async setAccountActive(id: string, isActive: boolean): Promise<SocialAccount> {
    return this.repository.setActive(id, isActive);
  }

  async listAccounts(): Promise<SocialAccount[]> {
    return this.repository.listAll();
  }

  async listAccountsByPlatform(platformId: string): Promise<SocialAccount[]> {
    this.assertPlatformId(platformId);
    return this.repository.listByPlatform(platformId);
  }

  async listSelectableAccountsByPlatform(platformId: string): Promise<SocialAccount[]> {
    return this.repository.listByPlatform(platformId, { includeInactive: false });
  }

  async listAllAccountsIncludingInactive(): Promise<SocialAccount[]> {
    return this.repository.listAll({ includeInactive: true });
  }

  async getAccount(id: string): Promise<SocialAccount | null> {
    return this.repository.getById(id, { includeDeleted: true });
  }

  async isAccountReferenced(id: string): Promise<boolean> {
    return this.repository.isReferencedByPublications(id);
  }

  private validateCreateInput(input: CreateSocialAccountInput): void {
    this.assertPlatformId(input.platformId);
    this.assertDisplayName(input.displayName);
  }

  private assertPlatformId(platformId: string): void {
    if (!platformId.trim()) {
      throw new Error('Площадка обязательна');
    }
    if (!this.isValidPlatformId(platformId)) {
      throw new Error(`Площадка «${platformId}» не найдена`);
    }
  }

  private assertDisplayName(displayName: string): void {
    if (!displayName.trim()) {
      throw new Error('Название аккаунта не может быть пустым');
    }
  }
}
