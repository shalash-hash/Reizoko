/** VK ID identity scope (default if omitted). */
export const VK_OAUTH_IDENTITY_SCOPES = ['vkid.personal_info'] as const;

/** VK API scopes required by Reizoko publishing features. */
export const VK_OAUTH_API_SCOPES = ['groups', 'wall', 'photos', 'offline'] as const;

/** Full scope set requested during VK ID OAuth. */
export const VK_OAUTH_REQUIRED_SCOPES = [
  ...VK_OAUTH_IDENTITY_SCOPES,
  ...VK_OAUTH_API_SCOPES,
] as const;

export type VkOAuthScope = (typeof VK_OAUTH_REQUIRED_SCOPES)[number];

export interface VkOAuthConnectionMeta {
  requestedScopes: string[];
  grantedScopes: string[];
  missingScopes: string[];
  expiresAt: string | null;
  tokenSource: 'vk_oauth';
  connectedAt: string;
}

export interface VkScopeAnalysis {
  requested: string[];
  granted: string[];
  missing: string[];
  hasIdentity: boolean;
  hasGroups: boolean;
  hasWall: boolean;
  hasPhotos: boolean;
  hasOffline: boolean;
  needsScopeUpgrade: boolean;
}

export function formatVkOAuthScopeString(scopes: readonly string[] = VK_OAUTH_REQUIRED_SCOPES): string {
  return [...scopes].join(' ');
}

export function parseVkGrantedScopes(scope: string | null | undefined): string[] {
  if (!scope) return ['vkid.personal_info'];
  return scope
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function analyzeVkScopeCoverage(
  grantedScopes: string[] | null | undefined,
  requestedScopes: readonly string[] = VK_OAUTH_REQUIRED_SCOPES,
): VkScopeAnalysis {
  const requested = [...requestedScopes];
  const granted = parseVkGrantedScopes(grantedScopes?.join(' ') ?? grantedScopes?.[0] ?? '');
  const grantedSet = new Set(granted);
  const missing = requested.filter((scope) => !grantedSet.has(scope));
  const hasScope = (scope: string) => grantedSet.has(scope);

  return {
    requested,
    granted,
    missing,
    hasIdentity: hasScope('vkid.personal_info'),
    hasGroups: hasScope('groups'),
    hasWall: hasScope('wall'),
    hasPhotos: hasScope('photos'),
    hasOffline: hasScope('offline'),
    needsScopeUpgrade: missing.length > 0,
  };
}

export function buildVkOAuthConnectionMeta(input: {
  requestedScopes: readonly string[];
  grantedScopeString?: string | null;
  grantedScopes?: string[] | null;
  expiresIn?: number | null;
  connectedAt?: string;
}): VkOAuthConnectionMeta {
  const grantedScopes =
    input.grantedScopes ?? parseVkGrantedScopes(input.grantedScopeString ?? null);
  const analysis = analyzeVkScopeCoverage(grantedScopes, input.requestedScopes);
  const expiresAt =
    input.expiresIn && input.expiresIn > 0
      ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
      : null;

  return {
    requestedScopes: [...input.requestedScopes],
    grantedScopes: analysis.granted,
    missingScopes: analysis.missing,
    expiresAt,
    tokenSource: 'vk_oauth',
    connectedAt: input.connectedAt ?? new Date().toISOString(),
  };
}

export function logVkOAuthRequestedScopes(scopes: readonly string[]): void {
  console.info(`[VK_OAUTH] VK OAuth requested scopes: ${formatVkOAuthScopeString(scopes)}`);
}

export function logVkOAuthGrantedScopes(meta: VkOAuthConnectionMeta): void {
  console.info('[VK_OAUTH] VK OAuth granted scopes:', {
    requested: meta.requestedScopes.join(' '),
    granted: meta.grantedScopes.join(' '),
    missing: meta.missingScopes.join(' ') || '(none)',
    expiresAt: meta.expiresAt,
    tokenSource: meta.tokenSource,
  });
}
