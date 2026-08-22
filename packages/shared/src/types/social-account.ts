export type SocialAccountConnectionState = 'local' | 'connected' | 'needs_reconnect';

export interface SocialAccount {
  id: string;
  platformId: string;
  displayName: string;
  handle?: string | null;
  externalAccountId?: string | null;
  avatarMediaId?: string | null;
  isActive: boolean;
  connectionState: SocialAccountConnectionState;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateSocialAccountInput {
  platformId: string;
  displayName: string;
  handle?: string | null;
  avatarMediaId?: string | null;
}

export interface UpdateSocialAccountInput {
  displayName?: string;
  handle?: string | null;
  avatarMediaId?: string | null;
}
