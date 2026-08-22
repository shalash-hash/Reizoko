import { WorkspaceState } from '@reizoko/shared';
import {
  addPlatformTarget,
  getTabIdForTarget,
  normalizeWorkspaceState,
  removePlatformTarget,
} from './platform-targets.js';

export const DEFAULT_WORKSPACE: WorkspaceState = {
  activeTabId: 'editor',
  openPlatformTargets: [],
  currentContentItemId: null,
  sidebarSection: 'editor',
};

export class WorkspaceService {
  private state: WorkspaceState = { ...DEFAULT_WORKSPACE };

  getState(): WorkspaceState {
    return { ...this.state };
  }

  setState(state: WorkspaceState): void {
    this.state = normalizeWorkspaceState(state);
  }

  openPlatformTarget(platformId: string, socialAccountId?: string | null): WorkspaceState {
    const normalized = normalizeWorkspaceState(this.state);
    const nextTargets = addPlatformTarget(
      normalized.openPlatformTargets,
      platformId,
      socialAccountId,
    );
    const opened = nextTargets.find(
      (target) =>
        target.platformId === platformId &&
        (target.socialAccountId ?? null) === (socialAccountId ?? null),
    );
    this.state = {
      ...normalized,
      openPlatformTargets: nextTargets,
      activeTabId: opened ? getTabIdForTarget(opened) : normalized.activeTabId,
    };
    return this.getState();
  }

  closePlatformTarget(targetId: string): WorkspaceState {
    const normalized = normalizeWorkspaceState(this.state);
    const closingTabId = getTabIdForTarget({ id: targetId, platformId: '', socialAccountId: null });
    this.state = {
      ...normalized,
      openPlatformTargets: removePlatformTarget(normalized.openPlatformTargets, targetId),
      activeTabId: normalized.activeTabId === closingTabId ? 'editor' : normalized.activeTabId,
    };
    return this.getState();
  }

  setActiveTab(tabId: string): WorkspaceState {
    this.state = { ...normalizeWorkspaceState(this.state), activeTabId: tabId };
    return this.getState();
  }

  setCurrentContentItem(contentItemId: string | null): WorkspaceState {
    this.state = { ...normalizeWorkspaceState(this.state), currentContentItemId: contentItemId };
    return this.getState();
  }

  setSidebarSection(section: WorkspaceState['sidebarSection']): WorkspaceState {
    this.state = { ...normalizeWorkspaceState(this.state), sidebarSection: section };
    return this.getState();
  }
}

export {
  addPlatformTarget,
  createPlatformTarget,
  getAccountConnectionLabel,
  getAccountDisplayLabel,
  getPlatformTargetLabel,
  getTabIdForTarget,
  isSameTarget,
  isTargetOpen,
  normalizeWorkspaceState,
  parsePlatformTabId,
  removePlatformTarget,
  removeTargetsForAccount,
  targetKey,
  toPreviewAccountContext,
  toPublicationTarget,
} from './platform-targets.js';
