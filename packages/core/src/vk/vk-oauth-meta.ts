import type { VkOAuthConnectionMeta } from './vk-scopes.js';

export const VK_OAUTH_META_SETTINGS_PREFIX = 'vk.oauth.meta.';

export function buildVkOAuthMetaSettingsKey(connectionId: string): string {
  return `${VK_OAUTH_META_SETTINGS_PREFIX}${connectionId}`;
}

export function serializeVkOAuthConnectionMeta(meta: VkOAuthConnectionMeta): string {
  return JSON.stringify(meta);
}

export function parseVkOAuthConnectionMeta(raw: string | null | undefined): VkOAuthConnectionMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VkOAuthConnectionMeta>;
    if (!Array.isArray(parsed.grantedScopes) || !Array.isArray(parsed.requestedScopes)) {
      return null;
    }
    return {
      requestedScopes: parsed.requestedScopes,
      grantedScopes: parsed.grantedScopes,
      missingScopes: Array.isArray(parsed.missingScopes) ? parsed.missingScopes : [],
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
      tokenSource: 'vk_oauth',
      connectedAt: typeof parsed.connectedAt === 'string' ? parsed.connectedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
