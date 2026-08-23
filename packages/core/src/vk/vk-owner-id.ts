/** Map VK community id to wall owner_id (negative). */
export function communityIdToOwnerId(communityId: number): number {
  if (communityId <= 0) {
    throw new Error('Community id must be positive');
  }
  return -communityId;
}

/** Map VK user id to wall owner_id (positive). */
export function userIdToOwnerId(userId: number): number {
  if (userId <= 0) {
    throw new Error('User id must be positive');
  }
  return userId;
}

export function ownerIdToCommunityId(ownerId: number): number | null {
  if (ownerId >= 0) return null;
  return Math.abs(ownerId);
}

export function isCommunityOwnerId(ownerId: number): boolean {
  return ownerId < 0;
}

export function buildVkRemotePostId(ownerId: number, postId: number): string {
  return `wall${ownerId}_${postId}`;
}

export function buildVkRemoteUrl(ownerId: number, postId: number): string {
  return `https://vk.com/wall${ownerId}_${postId}`;
}
