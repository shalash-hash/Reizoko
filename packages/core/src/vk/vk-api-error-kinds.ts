export type VkApiErrorKind =
  | 'TOKEN_INVALID'
  | 'MISSING_GROUPS_PERMISSION'
  | 'MISSING_WALL_PERMISSION'
  | 'MISSING_PHOTOS_PERMISSION'
  | 'APP_PERMISSION_NOT_GRANTED'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_ACCESS_DENIED'
  | 'VK_API_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN'
  | 'VK_USER_OAUTH_EXPIRED'
  | 'VK_USER_PERMISSION_MISSING'
  | 'VK_COMMUNITY_TOKEN_INVALID'
  | 'VK_COMMUNITY_TOKEN_REVOKED'
  | 'VK_COMMUNITY_WALL_PERMISSION_MISSING'
  | 'VK_COMMUNITY_PHOTO_UPLOAD_UNAVAILABLE';

export interface VkApiRequestDiagnostic {
  method: string;
  httpStatus?: number | null;
  vkErrorCode?: number | null;
  vkErrorMessage?: string | null;
  requiredPermission?: string | null;
  failureKind: VkApiErrorKind;
}

export function classifyVkApiFailure(input: {
  method?: string;
  vkErrorCode?: number | null;
  vkErrorMessage?: string | null;
  networkError?: boolean;
  missingScope?: 'groups' | 'wall' | 'photos' | null;
  tokenInvalid?: boolean;
}): VkApiErrorKind {
  if (input.networkError) return 'NETWORK_ERROR';
  if (input.tokenInvalid) return 'TOKEN_INVALID';
  if (input.missingScope === 'groups') return 'MISSING_GROUPS_PERMISSION';
  if (input.missingScope === 'wall') return 'MISSING_WALL_PERMISSION';
  if (input.missingScope === 'photos') return 'MISSING_PHOTOS_PERMISSION';
  if (input.vkErrorCode === 1051) return 'APP_PERMISSION_NOT_GRANTED';
  if (input.vkErrorCode === 5) {
    const msg = (input.vkErrorMessage ?? '').toLowerCase();
    if (msg.includes('access_token has expired') || msg.includes('invalid access_token')) {
      return 'TOKEN_INVALID';
    }
    return 'MISSING_GROUPS_PERMISSION';
  }
  if (input.vkErrorCode === 7 || input.vkErrorCode === 15) return 'TARGET_ACCESS_DENIED';
  if (input.vkErrorCode === 100 && input.method === 'utils.resolveScreenName') {
    return 'TARGET_NOT_FOUND';
  }
  if (input.vkErrorCode === 6 || input.vkErrorCode === 10) return 'VK_API_UNAVAILABLE';
  return 'UNKNOWN';
}
