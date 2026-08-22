export type WorkspaceTabType = 'editor' | 'platform' | 'library' | 'calendar' | 'history' | 'accounts' | 'settings';

export interface EditorTab {
  type: 'editor';
  id: 'editor';
  label: string;
  closable: false;
}

export interface PlatformTab {
  type: 'platform';
  id: string;
  platformId: string;
  socialAccountId?: string | null;
  label: string;
  closable: true;
}

export interface NavTab {
  type: 'library' | 'calendar' | 'history' | 'accounts' | 'settings';
  id: string;
  label: string;
  closable: false;
  enabled: boolean;
  plannedMessage?: string;
}

export type WorkspaceTab = EditorTab | PlatformTab | NavTab;

export interface OpenPlatformTarget {
  id: string;
  platformId: string;
  socialAccountId?: string | null;
}

export interface WorkspaceState {
  activeTabId: string;
  openPlatformTargets: OpenPlatformTarget[];
  /** @deprecated Legacy Stage 1 format — migrated to openPlatformTargets on load */
  openPlatformTabs?: string[];
  currentContentItemId: string | null;
  sidebarSection: 'editor' | 'library' | 'calendar' | 'history' | 'accounts' | 'settings';
}
