import type { OpenPlatformTarget, SocialAccount, WorkspaceState } from '@reizoko/shared';
import { generateId } from '@reizoko/shared';

export function targetKey(platformId: string, socialAccountId?: string | null): string {
  return `${platformId}:${socialAccountId ?? ''}`;
}

export function createPlatformTarget(
  platformId: string,
  socialAccountId?: string | null,
): OpenPlatformTarget {
  return {
    id: socialAccountId ? generateId() : platformId,
    platformId,
    socialAccountId: socialAccountId ?? null,
  };
}

export function getTabIdForTarget(target: OpenPlatformTarget): string {
  return `platform-${target.id}`;
}

export function parsePlatformTabId(tabId: string): string | null {
  if (!tabId.startsWith('platform-')) return null;
  return tabId.slice('platform-'.length);
}

export function isSameTarget(
  a: Pick<OpenPlatformTarget, 'platformId' | 'socialAccountId'>,
  b: Pick<OpenPlatformTarget, 'platformId' | 'socialAccountId'>,
): boolean {
  return targetKey(a.platformId, a.socialAccountId) === targetKey(b.platformId, b.socialAccountId);
}

export function isTargetOpen(
  targets: OpenPlatformTarget[],
  platformId: string,
  socialAccountId?: string | null,
): boolean {
  const key = targetKey(platformId, socialAccountId);
  return targets.some((target) => targetKey(target.platformId, target.socialAccountId) === key);
}

export function addPlatformTarget(
  targets: OpenPlatformTarget[],
  platformId: string,
  socialAccountId?: string | null,
): OpenPlatformTarget[] {
  if (isTargetOpen(targets, platformId, socialAccountId)) {
    return targets;
  }
  return [...targets, createPlatformTarget(platformId, socialAccountId)];
}

export function removePlatformTarget(
  targets: OpenPlatformTarget[],
  targetId: string,
): OpenPlatformTarget[] {
  return targets.filter((target) => target.id !== targetId);
}

export function removeTargetsForAccount(
  targets: OpenPlatformTarget[],
  socialAccountId: string,
): OpenPlatformTarget[] {
  return targets.filter((target) => target.socialAccountId !== socialAccountId);
}

export function normalizeWorkspaceState(state: WorkspaceState): WorkspaceState {
  let openPlatformTargets = state.openPlatformTargets;

  if (!openPlatformTargets?.length && state.openPlatformTabs?.length) {
    openPlatformTargets = state.openPlatformTabs.map((platformId) =>
      createPlatformTarget(platformId, null),
    );
  }

  if (!openPlatformTargets) {
    openPlatformTargets = [];
  }

  return {
    activeTabId: state.activeTabId,
    currentContentItemId: state.currentContentItemId,
    sidebarSection: state.sidebarSection,
    openPlatformTargets,
  };
}

export function getPlatformTargetLabel(
  platformName: string,
  account?: Pick<SocialAccount, 'displayName'> | null,
): string {
  if (!account) return platformName;
  return `${platformName} · ${account.displayName}`;
}

export function getAccountConnectionLabel(connectionState: SocialAccount['connectionState']): string {
  if (connectionState === 'connected') return 'Подключён';
  if (connectionState === 'needs_reconnect') return 'Требуется переподключение';
  return 'Локальный профиль';
}

export function getAccountDisplayLabel(
  account: Pick<SocialAccount, 'displayName' | 'deletedAt' | 'isActive'>,
): string {
  if (account.deletedAt) return `${account.displayName} · Удалённый локальный профиль`;
  if (!account.isActive) return `${account.displayName} · Неактивен`;
  return account.displayName;
}

export function toPublicationTarget(target: OpenPlatformTarget): {
  platformId: string;
  socialAccountId?: string | null;
} {
  return {
    platformId: target.platformId,
    socialAccountId: target.socialAccountId ?? null,
  };
}

export function toPreviewAccountContext(
  account?: SocialAccount | null,
): { displayName: string; handle?: string | null; avatarMediaId?: string | null } | null {
  if (!account) return null;
  return {
    displayName: getAccountDisplayLabel(account),
    handle: account.handle ?? null,
    avatarMediaId: account.avatarMediaId ?? null,
  };
}
