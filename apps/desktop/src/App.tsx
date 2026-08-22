import { useEffect } from 'react';
import { ThemeProvider, persistThemeMode } from '@reizoko/ui';
import { bootstrapDatabase } from '@reizoko/database';
import { TauriDatabaseClient } from './db/tauri-database-client';
import { useAppStore, type ScreenshotScene } from './stores/app-store';
import { AppShell } from './components/AppShell';
import { createBlock } from '@reizoko/core';
import { generateId } from '@reizoko/shared';
import { getDatabasePath, isSmokeTestMode } from './config/smoke-test';
import { copySmokeFixtureToMedia, validateUserBackup } from './services/backup-runtime';

const IS_SCREENSHOT = import.meta.env.VITE_SCREENSHOT_MODE === '1';

declare global {
  interface Window {
    __REIZOKO_SCREENSHOT__?: {
      applyScene: (scene: ScreenshotScene) => void;
    };
  }
}

export function App() {
  const initialize = useAppStore((s) => s.initialize);
  const initializeDemo = useAppStore((s) => s.initializeDemo);
  const applyScreenshotScene = useAppStore((s) => s.applyScreenshotScene);
  const initialized = useAppStore((s) => s.initialized);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  useEffect(() => {
    if (IS_SCREENSHOT) {
      initializeDemo();
      window.__REIZOKO_SCREENSHOT__ = { applyScene: applyScreenshotScene };
      document.documentElement.setAttribute('data-screenshot-ready', '1');
      return;
    }

    void (async () => {
      const client = await TauriDatabaseClient.connect(getDatabasePath());
      const db = await bootstrapDatabase(client);
      await initialize(db);
    })();
  }, [initialize, initializeDemo, applyScreenshotScene]);

  useEffect(() => {
    if (!initialized || !isSmokeTestMode()) return;
    window.__REIZOKO_SMOKE__ = {
      getState: () => {
        const s = useAppStore.getState();
        return {
          title: s.content?.metadata.title ?? '',
          contentId: s.content?.id ?? null,
          blockCount: s.blocks.length,
          blockOrders: [...s.blocks].sort((a, b) => a.order - b.order).map((b) => b.order),
          hasImage: s.blocks.some((b) => b.type === 'image'),
          workspace: {
            currentContentItemId: s.workspace.currentContentItemId,
            sidebarSection: s.workspace.sidebarSection,
            activeTabId: s.workspace.activeTabId,
            openPlatformTargets: s.workspace.openPlatformTargets.map((target) => ({ ...target })),
            openPlatformTabs: s.workspace.openPlatformTargets
              .filter((target) => !target.socialAccountId)
              .map((target) => target.platformId),
          },
          accounts: s.accounts.map((account) => ({
            id: account.id,
            platformId: account.platformId,
            displayName: account.displayName,
            handle: account.handle,
            isActive: account.isActive,
            deletedAt: account.deletedAt,
          })),
          themeMode: s.themeMode,
          resolvedTheme: document.documentElement.getAttribute('data-theme'),
          libraryCount: s.library.length,
          showPlatformPicker: s.showPlatformPicker,
          publicationPrepareError: s.publicationPrepareError,
        };
      },
      navigateSection: (section) => useAppStore.getState().setSidebarSection(section),
      setActiveTab: (tabId) => useAppStore.getState().setActiveTab(tabId),
      createDraft: () => useAppStore.getState().createNewDraft(),
      setPickerOpen: (open) => useAppStore.getState().setShowPlatformPicker(open),
      openPlatform: (platformId) => useAppStore.getState().openPlatformTab(platformId),
      openPlatformTarget: (platformId, socialAccountId) =>
        useAppStore.getState().openPlatformTarget(platformId, socialAccountId ?? null),
      closePlatform: (platformId) => useAppStore.getState().closePlatformTab(platformId),
      createAccount: (input) => useAppStore.getState().createAccount(input),
      setAccountActive: (id, isActive) => useAppStore.getState().setAccountActive(id, isActive),
      removeAccount: (id) => useAppStore.getState().removeAccount(id),
      setTheme: (mode) => useAppStore.getState().setThemeMode(mode),
      preparePublication: () => useAppStore.getState().preparePublicationBatch(),
      connectTelegramBot: (token: string, connectionId?: string | null) =>
        useAppStore.getState().connectTelegramBot(token, connectionId),
      addTelegramDestination: (connectionId: string, chatRef: string) =>
        useAppStore.getState().addTelegramDestination(connectionId, chatRef),
      publishNow: () => useAppStore.getState().publishNowBatch(),
      getConnections: () => useAppStore.getState().connections,
      getPublicationState: () => useAppStore.getState().getPublicationState(),
      getAccounts: () => useAppStore.getState().accounts,
      setTitle: (title) => useAppStore.getState().setTitle(title),
      createNewDraft: () => useAppStore.getState().createNewDraft(),
      createBackup: () => useAppStore.getState().createBackup(),
      beginRestoreBackup: () => useAppStore.getState().beginRestoreBackup(),
      confirmRestoreBackup: () => useAppStore.getState().confirmRestoreBackup(),
      validateBackupFile: async (path: string) => {
        const result = await validateUserBackup(path);
        if (!result.valid) {
          throw new Error(result.errors.join('; '));
        }
        return result;
      },
      addImageFromPath: async (sourcePath: string) => {
        const state = useAppStore.getState();
        if (!state.db) return null;
        const mediaId = generateId();
        const localPath = await copySmokeFixtureToMedia(
          state.db,
          sourcePath,
          mediaId,
          'smoke-test.png',
        );
        state.registerMediaPath(mediaId, localPath);
        state.setBlocks([...state.blocks, createBlock('image', state.blocks.length, { mediaId })]);
        return mediaId;
      },
      getAutomatedTestWindowState: async () => {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const window = getCurrentWindow();
        return {
          backgroundLaunch: true,
          isMinimized: await window.isMinimized(),
          isVisible: await window.isVisible(),
          isFocused: await window.isFocused(),
        };
      },
    };
  }, [initialized]);

  if (loading && !IS_SCREENSHOT) {
    return <div className="app-loading">Загрузка Reizoko…</div>;
  }

  if (error) {
    return <div className="app-error">Ошибка: {error}</div>;
  }

  if (!initialized) {
    return null;
  }

  return (
    <ThemeProvider
      mode={themeMode}
      onModeChange={(mode) => {
        persistThemeMode(mode);
        void setThemeMode(mode);
      }}
    >
      <AppShell />
    </ThemeProvider>
  );
}
