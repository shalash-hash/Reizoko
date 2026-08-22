import type {
  CreateSocialAccountInput,
  SocialAccount,
  UpdateSocialAccountInput,
} from '@reizoko/shared';

export interface SocialAccountListOptions {
  includeInactive?: boolean;
  includeDeleted?: boolean;
}

export interface SocialAccountRepository {
  create(input: CreateSocialAccountInput): Promise<SocialAccount>;
  getById(id: string, options?: { includeDeleted?: boolean }): Promise<SocialAccount | null>;
  listAll(options?: SocialAccountListOptions): Promise<SocialAccount[]>;
  listByPlatform(platformId: string, options?: SocialAccountListOptions): Promise<SocialAccount[]>;
  update(id: string, input: UpdateSocialAccountInput): Promise<SocialAccount>;
  setActive(id: string, isActive: boolean): Promise<SocialAccount>;
  softDelete(id: string): Promise<SocialAccount>;
  isReferencedByPublications(id: string): Promise<boolean>;
  listByConnectionId(connectionId: string): Promise<SocialAccount[]>;
  clearConnectionForAccounts(connectionId: string): Promise<void>;
}
