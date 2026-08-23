import { parseVkPublicationTargetMetadata, type SocialAccount } from '@reizoko/shared';

import { isCommunityCredentialConnection } from './vk-community-token.js';

export function getVkAccountDestinationLabel(account: SocialAccount): string | null {
  const metadata = parseVkPublicationTargetMetadata(account.platformMetadataJson);
  return metadata?.destinationKindLabel ?? null;
}

export function getVkAccountCredentialLabel(
  account: SocialAccount,
  connection?: { method: string; secretRef?: string | null } | null,
): string | null {
  const metadata = parseVkPublicationTargetMetadata(account.platformMetadataJson);
  if (metadata?.credentialKind === 'community_token') {
    return 'Подключено по ключу сообщества';
  }
  if (connection && isCommunityCredentialConnection(connection)) {
    return 'Подключено по ключу сообщества';
  }
  if (metadata?.credentialKind === 'user_oauth' || connection?.method === 'oauth_system_browser') {
    return 'Подключено через VK ID';
  }
  return null;
}

export function getVkAccountSubtitle(account: SocialAccount): string {
  const kind = getVkAccountDestinationLabel(account);
  if (kind) return kind;
  return account.handle ?? 'ВКонтакте';
}
