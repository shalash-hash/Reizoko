/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SCREENSHOT_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __REIZOKO_SMOKE_TEST__?: boolean;
  __REIZOKO_AUTOMATED_TEST_CONFIG__?: import('./config/smoke-test.js').AutomatedTestConfig;
  __REIZOKO_SMOKE_IMAGE__?: string;
  __REIZOKO_SMOKE__?: {
    getState: () => import('./config/smoke-test.js').SmokeAppState;
    navigateSection: (section: 'editor' | 'library' | 'accounts' | 'settings') => Promise<void>;
    setActiveTab: (tabId: string) => Promise<void>;
    createDraft: () => Promise<void>;
    createNewDraft: () => Promise<void>;
    setPickerOpen: (open: boolean) => void;
    openPlatform: (platformId: string) => Promise<void>;
    openPlatformTarget: (platformId: string, socialAccountId?: string | null) => Promise<void>;
    closePlatform: (platformId: string) => Promise<void>;
    createAccount: (input: {
      platformId: string;
      displayName: string;
      handle?: string | null;
    }) => Promise<{ id: string; platformId: string; displayName: string; handle?: string | null }>;
    getAccounts: () => Array<{
      id: string;
      platformId: string;
      displayName: string;
      handle?: string | null;
      isActive: boolean;
      deletedAt?: string | null;
    }>;
    setAccountActive: (id: string, isActive: boolean) => Promise<void>;
    removeAccount: (id: string) => Promise<void>;
    setTitle: (title: string) => void;
    setTheme: (mode: 'light' | 'dark' | 'system') => Promise<void>;
    preparePublication: () => Promise<void>;
    connectTelegramBot: (token: string, connectionId?: string | null) => Promise<void>;
    addTelegramDestination: (connectionId: string, chatRef: string) => Promise<void>;
    publishNow: () => Promise<void>;
    getConnections: () => import('@reizoko/shared').PlatformConnection[];
    getPublicationState: () => Promise<{
      batches: Array<{ id: string; contentItemId: string; contentRevisionId: string }>;
      publications: Array<{
        id: string;
        batchId: string;
        platformId: string;
        socialAccountId?: string | null;
        status: string;
        remotePostId?: string | null;
        remoteUrl?: string | null;
        preparedSnapshot: { transformedContent: { text: string } };
      }>;
    } | null>;
    createBackup: () => Promise<{ path: string; warnings: string[] }>;
    beginRestoreBackup: () => Promise<void>;
    confirmRestoreBackup: () => Promise<void>;
    validateBackupFile: (path: string) => Promise<unknown>;
    addImageFromPath: (sourcePath: string) => Promise<string | null>;
    getAutomatedTestWindowState: () => Promise<import('./config/smoke-test.js').AutomatedTestWindowState>;
  };
}
