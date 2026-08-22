export interface SmokeOpenPlatformTarget {
  id: string;
  platformId: string;
  socialAccountId?: string | null;
}

export interface SmokeAppState {
  title: string;
  contentId: string | null;
  blockCount: number;
  blockOrders: number[];
  hasImage: boolean;
  workspace: {
    currentContentItemId: string | null;
    sidebarSection: string;
    activeTabId: string;
    openPlatformTargets: SmokeOpenPlatformTarget[];
    /** Derived legacy view for platform-only tabs */
    openPlatformTabs: string[];
  };
  accounts: Array<{
    id: string;
    platformId: string;
    displayName: string;
    handle?: string | null;
    isActive: boolean;
    deletedAt?: string | null;
  }>;
  themeMode: string;
  resolvedTheme: string | null;
  showPlatformPicker: boolean;
  publicationPrepareError?: string | null;
}

export interface AutomatedTestWindowState {
  backgroundLaunch: boolean;
  isMinimized: boolean;
  isVisible: boolean;
  isFocused: boolean;
}

export interface AutomatedTestConfig {
  backgroundLaunch: boolean;
}

export function isSmokeTestMode(): boolean {
  return typeof window !== 'undefined' && window.__REIZOKO_SMOKE_TEST__ === true;
}

/** Automated smoke/E2E launch (REIZOKO_SMOKE_TEST=1). Normal user launch is unaffected. */
export function isAutomatedTestMode(): boolean {
  return isSmokeTestMode();
}

export function getAutomatedTestConfig(): AutomatedTestConfig | null {
  if (!isAutomatedTestMode()) return null;
  return window.__REIZOKO_AUTOMATED_TEST_CONFIG__ ?? { backgroundLaunch: true };
}

export function satisfiesBackgroundWindowContract(state: AutomatedTestWindowState): boolean {
  if (!state.backgroundLaunch) return false;
  if (state.isFocused) return false;
  return !state.isVisible || state.isMinimized;
}

export function getDatabasePath(): string {
  return isSmokeTestMode() ? 'sqlite:reizoko-smoke.db' : 'sqlite:reizoko.db';
}

export function getMediaRelativeDir(): string {
  return isSmokeTestMode() ? 'media-smoke' : 'media';
}
