import { create } from 'zustand';
import type { ContentBlock, ContentItemWithRevision, ContentItemSummary, WorkspaceState } from '@reizoko/shared';
import type { ThemeMode } from '@reizoko/ui';
import { THEME_SETTINGS_KEY, readStoredThemeMode, persistThemeMode } from '@reizoko/ui';
import { ContentService } from '@reizoko/core';
import type { DatabaseContext } from '@reizoko/database';
import { DEFAULT_WORKSPACE } from '@reizoko/core';
import { createBlock } from '@reizoko/core';
import { generateId, nowIso } from '@reizoko/shared';

export type SaveStatus = 'saved' | 'saving' | 'error';

interface AppState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  db: DatabaseContext | null;
  contentService: ContentService | null;
  content: ContentItemWithRevision | null;
  blocks: ContentBlock[];
  workspace: WorkspaceState;
  library: ContentItemSummary[];
  libraryQuery: string;
  mediaPaths: Record<string, string>;
  showPlatformPicker: boolean;
  themeMode: ThemeMode;
  saveStatus: SaveStatus;

  initialize: (db: DatabaseContext) => Promise<void>;
  setBlocks: (blocks: ContentBlock[]) => void;
  setTitle: (title: string) => void;
  saveContent: () => Promise<void>;
  openPlatformTab: (platformId: string) => Promise<void>;
  closePlatformTab: (platformId: string) => Promise<void>;
  setActiveTab: (tabId: string) => Promise<void>;
  setSidebarSection: (section: WorkspaceState['sidebarSection']) => Promise<void>;
  setShowPlatformPicker: (show: boolean) => void;
  loadLibrary: (query?: string) => Promise<void>;
  openContentItem: (id: string) => Promise<void>;
  duplicateContentItem: (id: string) => Promise<void>;
  createNewDraft: () => Promise<void>;
  registerMediaPath: (mediaId: string, localPath: string) => void;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  initializeDemo: () => void;
  applyScreenshotScene: (scene: ScreenshotScene) => void;
}

export type ScreenshotScene =
  | 'editor-light'
  | 'editor-dark'
  | 'instagram-light'
  | 'telegram-dark'
  | 'library-light'
  | 'platform-picker';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  loading: true,
  error: null,
  db: null,
  contentService: null,
  content: null,
  blocks: [],
  workspace: { ...DEFAULT_WORKSPACE },
  library: [],
  libraryQuery: '',
  mediaPaths: {},
  showPlatformPicker: false,
  themeMode: readStoredThemeMode(),
  saveStatus: 'saved',

  initialize: async (db) => {
    try {
      const contentService = new ContentService(db.content);
      const workspace = await db.workspace.getState();
      const storedTheme = await db.settings.get<ThemeMode>(THEME_SETTINGS_KEY, readStoredThemeMode());
      persistThemeMode(storedTheme);

      let content: ContentItemWithRevision | null = null;
      if (workspace.currentContentItemId) {
        content = await db.content.getItem(workspace.currentContentItemId);
      }
      if (!content) {
        content = await contentService.createDraft();
        workspace.currentContentItemId = content.id;
        await db.workspace.saveState(workspace);
      }

      const mediaItems = await db.media.list();
      const mediaPaths = Object.fromEntries(mediaItems.map((m) => [m.id, m.localPath]));

      set({
        initialized: true,
        loading: false,
        db,
        contentService,
        content,
        blocks: content.revision.blocks,
        workspace,
        mediaPaths,
        themeMode: storedTheme,
      });

      await get().loadLibrary();
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Ошибка инициализации',
      });
    }
  },

  setBlocks: (blocks) => {
    set({ blocks, saveStatus: 'saving' });
    scheduleSave(get);
  },

  setTitle: (title) => {
    const { content } = get();
    if (!content) return;
    set({
      content: {
        ...content,
        metadata: { ...content.metadata, title },
      },
      saveStatus: 'saving',
    });
    scheduleSave(get);
  },

  saveContent: async () => {
    const { db, contentService, content, blocks, workspace } = get();
    if (!db || !contentService || !content) return;

    try {
      set({ saveStatus: 'saving' });
      const updated = await contentService.save(content, blocks);
      workspace.currentContentItemId = updated.id;
      await db.workspace.saveState(workspace);
      set({ content: updated, blocks: updated.revision.blocks, saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  },

  setThemeMode: async (mode) => {
    const { db } = get();
    persistThemeMode(mode);
    set({ themeMode: mode });
    if (db) {
      await db.settings.set(THEME_SETTINGS_KEY, mode);
    }
  },

  openPlatformTab: async (platformId) => {
    const { db, workspace } = get();
    if (!db) return;

    if (!workspace.openPlatformTabs.includes(platformId)) {
      workspace.openPlatformTabs = [...workspace.openPlatformTabs, platformId];
    }
    workspace.activeTabId = `platform-${platformId}`;
    await db.workspace.saveState(workspace);
    set({ workspace, showPlatformPicker: false });
  },

  closePlatformTab: async (platformId) => {
    const { db, workspace } = get();
    if (!db) return;

    workspace.openPlatformTabs = workspace.openPlatformTabs.filter((id) => id !== platformId);
    if (workspace.activeTabId === `platform-${platformId}`) {
      workspace.activeTabId = 'editor';
    }
    await db.workspace.saveState(workspace);
    set({ workspace });
  },

  setActiveTab: async (tabId) => {
    const { db, workspace } = get();
    if (!db) return;
    workspace.activeTabId = tabId;
    await db.workspace.saveState(workspace);
    set({ workspace });
  },

  setSidebarSection: async (section) => {
    const { db, workspace } = get();
    if (!db) return;
    workspace.sidebarSection = section;
    if (section === 'editor') {
      workspace.activeTabId = 'editor';
    }
    await db.workspace.saveState(workspace);
    set({ workspace });
    if (section === 'library') {
      await get().loadLibrary();
    }
  },

  setShowPlatformPicker: (show) => set({ showPlatformPicker: show }),

  loadLibrary: async (query) => {
    const { contentService, libraryQuery } = get();
    if (!contentService) return;
    const q = query ?? libraryQuery;
    const library = await contentService.searchLibrary(q);
    set({ library, libraryQuery: q });
  },

  openContentItem: async (id) => {
    const { db, contentService, workspace } = get();
    if (!db || !contentService) return;
    const content = await contentService.load(id);
    if (!content) return;
    workspace.currentContentItemId = content.id;
    workspace.sidebarSection = 'editor';
    workspace.activeTabId = 'editor';
    await db.workspace.saveState(workspace);
    set({ content, blocks: content.revision.blocks, workspace });
  },

  duplicateContentItem: async (id) => {
    const { contentService } = get();
    if (!contentService) return;
    await contentService.duplicate(id);
    await get().loadLibrary();
  },

  createNewDraft: async () => {
    const { db, contentService, workspace } = get();
    if (!db || !contentService) return;
    const content = await contentService.createDraft();
    workspace.currentContentItemId = content.id;
    workspace.sidebarSection = 'editor';
    workspace.activeTabId = 'editor';
    await db.workspace.saveState(workspace);
    set({ content, blocks: content.revision.blocks, workspace });
    await get().loadLibrary();
  },

  registerMediaPath: (mediaId, localPath) => {
    set((state) => ({
      mediaPaths: { ...state.mediaPaths, [mediaId]: localPath },
    }));
  },

  initializeDemo: () => {
    const now = nowIso();
    const itemId = generateId();
    const revisionId = generateId();
    const blocks = [
      createBlock('heading', 0, { text: 'Запуск Reizoko — единый центр контента', level: 1 }),
      createBlock('text', 1, {
        text: 'Reizoko помогает создавать Master Post один раз и мгновенно видеть, как он будет выглядеть в Instagram, Telegram и VK.',
      }),
      createBlock('text', 2, {
        text: 'Редактор поддерживает блоки, drag-and-drop и autosave. Preview обновляется в реальном времени.',
      }),
    ];

    const content: ContentItemWithRevision = {
      id: itemId,
      createdAt: now,
      updatedAt: now,
      currentRevisionId: revisionId,
      metadata: { title: 'Запуск Reizoko' },
      syncState: 'local',
      revision: { id: revisionId, contentItemId: itemId, createdAt: now, blocks, version: 1 },
    };

    const library: ContentItemSummary[] = [
      {
        id: itemId,
        title: 'Запуск Reizoko',
        previewText: blocks[1]?.type === 'text' ? (blocks[1].data as { text: string }).text : '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: generateId(),
        title: 'Анонс обновления',
        previewText: 'Скоро добавим новые платформы и серверный планировщик.',
        createdAt: now,
        updatedAt: now,
      },
    ];

    set({
      initialized: true,
      loading: false,
      content,
      blocks,
      library,
      saveStatus: 'saved',
      workspace: {
        ...DEFAULT_WORKSPACE,
        openPlatformTabs: ['instagram', 'telegram', 'vk'],
        currentContentItemId: itemId,
      },
    });
  },

  applyScreenshotScene: (scene) => {
    get().initializeDemo();

    const applyTheme = (theme: 'light' | 'dark') => {
      persistThemeMode(theme);
      set({ themeMode: theme });
    };

    const base = {
      sidebarSection: 'editor' as const,
      activeTabId: 'editor',
      showPlatformPicker: false,
    };

    if (scene === 'editor-light') {
      applyTheme('light');
      set({ workspace: { ...get().workspace, ...base } });
    } else if (scene === 'editor-dark') {
      applyTheme('dark');
      set({ workspace: { ...get().workspace, ...base } });
    } else if (scene === 'instagram-light') {
      applyTheme('light');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-instagram',
          openPlatformTabs: ['instagram', 'telegram', 'vk'],
        },
      });
    } else if (scene === 'telegram-dark') {
      applyTheme('dark');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-telegram',
          openPlatformTabs: ['instagram', 'telegram', 'vk'],
        },
      });
    } else if (scene === 'library-light') {
      applyTheme('light');
      set({ workspace: { ...get().workspace, sidebarSection: 'library', activeTabId: 'editor' } });
    } else if (scene === 'platform-picker') {
      applyTheme('light');
      set({
        workspace: { ...get().workspace, ...base },
        showPlatformPicker: true,
      });
    }
  },
}));

function scheduleSave(get: () => AppState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void get().saveContent();
  }, 600);
}
