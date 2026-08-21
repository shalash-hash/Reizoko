import { useEffect } from 'react';
import { ThemeProvider, persistThemeMode } from '@reizoko/ui';
import { bootstrapDatabase } from '@reizoko/database';
import { TauriDatabaseClient } from './db/tauri-database-client';
import { useAppStore, type ScreenshotScene } from './stores/app-store';
import { AppShell } from './components/AppShell';

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
      const client = await TauriDatabaseClient.connect();
      const db = await bootstrapDatabase(client);
      await initialize(db);
    })();
  }, [initialize, initializeDemo, applyScreenshotScene]);

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
