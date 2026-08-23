import { create } from 'zustand';
import type {
  ContentBlock,
  ContentItemWithRevision,
  ContentItemSummary,
  CreateSocialAccountInput,
  MediaTransform,
  PlatformConnection,
  PlatformPresentationOverrides,
  Publication,
  SocialAccount,
  UpdateSocialAccountInput,
  WorkspaceState,
} from '@reizoko/shared';
import { VK_CANONICAL_REDIRECT_URI, VK_DEFAULT_SERVER_BASE_URL, VK_OAUTH_SCOPES } from '@reizoko/shared';
import type { VkOAuthConfig } from '@reizoko/shared';
import type { ThemeMode } from '@reizoko/ui';
import { THEME_SETTINGS_KEY, readStoredThemeMode, persistThemeMode } from '@reizoko/ui';
import {
  ContentService,
  PublicationService,
  SocialAccountService,
  TelegramConnectionService,
  VkConnectionService,
  PlatformConnectionService,
  addPlatformTarget,
  createPlatformTarget,
  getPlatformTargetLabel,
  getTabIdForTarget,
  normalizeWorkspaceState,
  parsePlatformTabId,
  removePlatformTarget,
  removeTargetsForAccount,
  toPublicationTarget,
  upsertMediaTransform,
  validateVkOAuthConfig,
  loadVkOAuthConfig,
  saveVkOAuthConfig,
  loadVkIntegrationFormState,
  buildVkOAuthConfigFromDraft,
  verifyVkIntegrationSettings,
  buildVkOAuthMetaSettingsKey,
  parseVkOAuthConnectionMeta,
  serializeVkOAuthConnectionMeta,
  type VkIntegrationDraft,
  type VkIntegrationFormState,
  type VkIntegrationVerificationResult,
  type VkTargetCandidate,
  type VkTargetDiscoveryResult,
  type VkCommunityTokenVerification,
  type GroupedRevisionHistory,
} from '@reizoko/core';
import { platformRegistry } from '@reizoko/platform-sdk';
import type { DatabaseContext } from '@reizoko/database';
import { DEFAULT_WORKSPACE } from '@reizoko/core';
import { createBlock } from '@reizoko/core';
import { generateId, nowIso } from '@reizoko/shared';
import type { BackupSummary } from '@reizoko/shared';
import {
  createUserBackup,
  exportUserJson,
  pickBackupFile,
  restoreUserBackup,
  validateUserBackup,
  writeBackupToPath,
  restoreBackupFromPath,
  createBackupService,
  writeBytesToPath,
} from '../services/backup-runtime';
import { isSmokeTestMode } from '../config/smoke-test';
import { appDataDir, join } from '@tauri-apps/api/path';
import { getAllPlatformCatalog } from '../platforms/planned-catalog';
import { createAppServices } from '../services/app-services';
import { probeVkServerFromNative } from '../services/vk-server-probe-runtime';
import { createSecretStore } from '../services/secret-store';
import {
  applyAspectRatio,
  applyPlatformText,
  applyTextOverrideMode,
  buildPresentationByTargetKey,
  buildPresentationPatch,
  getOverridesForTarget,
  loadPresentationOverridesForItem,
  persistPresentationOverrides,
  presentationStorageKey,
} from './presentation-overrides';

function isValidPlatformId(platformId: string): boolean {
  return getAllPlatformCatalog(platformRegistry).some((platform) => platform.id === platformId);
}

export type PublicationResultSummary = Pick<
  Publication,
  'id' | 'platformId' | 'status' | 'remotePostId' | 'remoteUrl' | 'errorMessage' | 'publishedAt'
>;

export type SaveStatus = 'saved' | 'saving' | 'error';

interface AppState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  db: DatabaseContext | null;
  contentService: ContentService | null;
  publicationService: PublicationService | null;
  socialAccountService: SocialAccountService | null;
  telegramConnectionService: TelegramConnectionService | null;
  vkConnectionService: VkConnectionService | null;
  platformConnectionService: PlatformConnectionService | null;
  connections: PlatformConnection[];
  accounts: SocialAccount[];
  content: ContentItemWithRevision | null;
  blocks: ContentBlock[];
  workspace: WorkspaceState;
  library: ContentItemSummary[];
  libraryQuery: string;
  mediaPaths: Record<string, string>;
  showPlatformPicker: boolean;
  themeMode: ThemeMode;
  saveStatus: SaveStatus;
  showRevisionHistory: boolean;
  groupedHistory: GroupedRevisionHistory[];
  selectedRevisionId: string | null;
  restoreCandidateId: string | null;
  publicationPrepareConfirmation: string[] | null;
  publicationPrepareError: string | null;
  lastPreparedBatchId: string | null;
  publishing: boolean;
  publicationPublishError: string | null;
  publicationResults: PublicationResultSummary[] | null;
  restoreCandidate: { path: string; summary: BackupSummary } | null;
  presentationOverrides: Record<string, PlatformPresentationOverrides>;
  activeComposerMediaId: string | null;

  initialize: (db: DatabaseContext) => Promise<void>;
  setBlocks: (blocks: ContentBlock[]) => void;
  setTitle: (title: string) => void;
  saveContent: () => Promise<void>;
  openPlatformTarget: (platformId: string, socialAccountId?: string | null) => Promise<void>;
  closePlatformTarget: (targetId: string) => Promise<void>;
  openPlatformTab: (platformId: string) => Promise<void>;
  closePlatformTab: (platformId: string) => Promise<void>;
  setActiveTab: (tabId: string) => Promise<void>;
  setSidebarSection: (section: WorkspaceState['sidebarSection']) => Promise<void>;
  setShowPlatformPicker: (show: boolean) => void;
  loadLibrary: (query?: string) => Promise<void>;
  loadAccounts: () => Promise<void>;
  createAccount: (input: CreateSocialAccountInput) => Promise<SocialAccount>;
  updateAccount: (id: string, input: UpdateSocialAccountInput) => Promise<SocialAccount>;
  removeAccount: (id: string) => Promise<void>;
  setAccountActive: (id: string, isActive: boolean) => Promise<void>;
  getAccountById: (id?: string | null) => SocialAccount | null;
  openContentItem: (id: string) => Promise<void>;
  duplicateContentItem: (id: string) => Promise<void>;
  createNewDraft: () => Promise<void>;
  registerMediaPath: (mediaId: string, localPath: string) => void;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  initializeDemo: () => void;
  applyScreenshotScene: (scene: ScreenshotScene) => void;
  openRevisionHistory: () => Promise<void>;
  closeRevisionHistory: () => void;
  loadRevisionHistory: () => Promise<void>;
  selectRevisionPreview: (revisionId: string) => void;
  createRevisionCheckpoint: () => Promise<void>;
  requestRestoreRevision: (revisionId: string) => void;
  confirmRestoreRevision: () => Promise<void>;
  cancelRestoreRevision: () => void;
  fetchRevision: (revisionId: string) => Promise<ContentItemWithRevision['revision'] | null>;
  preparePublicationBatch: () => Promise<void>;
  publishNowBatch: () => Promise<void>;
  retryPublication: (publicationId: string) => Promise<void>;
  dismissPublicationResults: () => void;
  refreshPublicationResults: () => Promise<void>;
  getLatestBatchPublishStatuses: () => Promise<
    Awaited<ReturnType<PublicationService['assessBatchPublishability']>>
  >;
  loadConnections: () => Promise<void>;
  connectTelegramBot: (token: string, existingConnectionId?: string | null) => Promise<void>;
  addTelegramDestination: (connectionId: string, chatRef: string) => Promise<void>;
  connectVkOAuth: (existingConnectionId?: string | null, options?: { upgradePermissions?: boolean }) => Promise<string | null>;
  loadVkIntegrationConfig: () => Promise<VkOAuthConfig>;
  loadVkIntegrationFormState: () => Promise<VkIntegrationFormState>;
  saveVkIntegrationDraft: (draft: VkIntegrationDraft) => Promise<void>;
  verifyVkIntegrationDraft: (draft: VkIntegrationDraft) => Promise<VkIntegrationVerificationResult>;
  saveVkIntegrationConfig: (config: VkOAuthConfig) => Promise<void>;
  verifyVkIntegrationConfig: () => Promise<VkIntegrationVerificationResult>;
  loadVkTargetsForConnection: (connectionId: string) => Promise<VkTargetDiscoveryResult>;
  addVkPublicationTargets: (connectionId: string, targets: VkTargetCandidate[]) => Promise<void>;
  resolveVkExternalWall: (connectionId: string, input: string) => Promise<VkTargetCandidate>;
  verifyVkCommunityToken: (input: {
    communityInput: string;
    accessToken: string;
  }) => Promise<VkCommunityTokenVerification>;
  connectVkCommunityToken: (input: {
    verification: VkCommunityTokenVerification;
    accessToken: string;
  }) => Promise<void>;
  replaceVkCommunityToken: (connectionId: string, accessToken: string) => Promise<void>;
  refreshVkCommunityTokenStatus: (connectionId: string) => Promise<VkCommunityTokenVerification>;
  disconnectConnection: (connectionId: string) => Promise<void>;
  linkAccountToConnection: (accountId: string, connectionId: string) => Promise<void>;
  dismissPublicationConfirmation: () => void;
  getPublicationState: () => Promise<{
    batches: Awaited<ReturnType<PublicationService['listBatchesByContentItem']>>;
    publications: Awaited<ReturnType<PublicationService['listPublicationsByContentItem']>>;
  } | null>;
  createBackup: () => Promise<{ path: string; warnings: string[] }>;
  exportJsonBackup: () => Promise<string>;
  beginRestoreBackup: () => Promise<void>;
  confirmRestoreBackup: () => Promise<void>;
  cancelRestoreBackup: () => void;
  reloadApplicationState: () => Promise<void>;
  getPresentationOverrides: (
    platformId: string,
    socialAccountId?: string | null,
  ) => PlatformPresentationOverrides | null;
  setMediaTransform: (
    platformId: string,
    socialAccountId: string | null | undefined,
    transform: MediaTransform,
  ) => Promise<void>;
  setAspectRatio: (
    platformId: string,
    socialAccountId: string | null | undefined,
    mediaId: string,
    aspectRatioId: string,
  ) => Promise<void>;
  setTextOverrideMode: (
    platformId: string,
    socialAccountId: string | null | undefined,
    useMasterText: boolean,
  ) => Promise<void>;
  setPlatformTextOverride: (
    platformId: string,
    socialAccountId: string | null | undefined,
    text: string,
  ) => Promise<void>;
  resetPlatformPresentation: (
    platformId: string,
    socialAccountId?: string | null,
  ) => Promise<void>;
  selectComposerMedia: (mediaId: string | null) => void;
}

export type ScreenshotScene =
  | 'editor-light'
  | 'editor-dark'
  | 'library-light'
  | 'library-dark'
  | 'instagram-light'
  | 'instagram-dark'
  | 'telegram-light'
  | 'telegram-dark'
  | 'vk-light'
  | 'vk-dark'
  | 'platform-picker-light'
  | 'platform-picker-dark'
  | 'settings-light'
  | 'settings-dark';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let presentationSaveTimer: ReturnType<typeof setTimeout> | null = null;

function cancelScheduledPresentationSave() {
  if (presentationSaveTimer) {
    clearTimeout(presentationSaveTimer);
    presentationSaveTimer = null;
  }
}

function schedulePresentationSave(get: () => AppState) {
  cancelScheduledPresentationSave();
  presentationSaveTimer = setTimeout(() => {
    void persistPresentationOverridesState(get);
  }, 800);
}

async function persistPresentationOverridesState(get: () => AppState) {
  const { db, content, presentationOverrides } = get();
  if (!db || !content) return;
  const rows = Object.values(presentationOverrides).filter(
    (item) => item.contentItemId === content.id,
  );
  for (const row of rows) {
    await persistPresentationOverrides(db, row);
  }
}

function cancelScheduledSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function demoPlatformTargets(platformIds: string[]) {
  return platformIds.map((platformId) => createPlatformTarget(platformId, null));
}

async function persistWorkspace(
  db: DatabaseContext,
  workspace: WorkspaceState,
): Promise<WorkspaceState> {
  const normalized = normalizeWorkspaceState(workspace);
  await db.workspace.saveState(normalized);
  return normalized;
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  loading: true,
  error: null,
  db: null,
  contentService: null,
  publicationService: null,
  socialAccountService: null,
  accounts: [],
  content: null,
  blocks: [],
  workspace: { ...DEFAULT_WORKSPACE },
  library: [],
  libraryQuery: '',
  mediaPaths: {},
  showPlatformPicker: false,
  themeMode: readStoredThemeMode(),
  saveStatus: 'saved',
  showRevisionHistory: false,
  groupedHistory: [],
  selectedRevisionId: null,
  restoreCandidateId: null,
  publicationPrepareConfirmation: null,
  publicationPrepareError: null,
  lastPreparedBatchId: null,
  publishing: false,
  publicationPublishError: null,
  publicationResults: null,
  connections: [],
  telegramConnectionService: null,
  vkConnectionService: null,
  platformConnectionService: null,
  restoreCandidate: null,
  presentationOverrides: {},
  activeComposerMediaId: null,

  initialize: async (db) => {
    try {
      const contentService = new ContentService(db.content);
      const services = createAppServices(db);
      const socialAccountService = new SocialAccountService(
        db.socialAccounts,
        isValidPlatformId,
      );
      const connections = await db.platformConnections.listAll();

      let workspace = await db.workspace.getState();
      const storedTheme = await db.settings.get<ThemeMode>(THEME_SETTINGS_KEY, readStoredThemeMode());
      persistThemeMode(storedTheme);

      let content: ContentItemWithRevision | null = null;
      if (workspace.currentContentItemId) {
        content = await db.content.getItem(workspace.currentContentItemId);
      }
      if (!content) {
        content = await contentService.createDraft();
        workspace = await persistWorkspace(db, {
          ...workspace,
          currentContentItemId: content.id,
        });
      }

      const mediaItems = await db.media.list();
      const mediaPaths = Object.fromEntries(mediaItems.map((m) => [m.id, m.localPath]));
      const accounts = await socialAccountService.listAllAccountsIncludingInactive();
      const presentationOverrides = await loadPresentationOverridesForItem(db, content.id);

      set({
        initialized: true,
        loading: false,
        db,
        contentService,
        publicationService: services.publicationService,
        socialAccountService,
        telegramConnectionService: services.telegramConnectionService,
        vkConnectionService: services.vkConnectionService,
        platformConnectionService: services.platformConnectionService,
        connections,
        accounts,
        content,
        blocks: content.revision.blocks,
        workspace,
        mediaPaths,
        presentationOverrides,
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
      const nextWorkspace = await persistWorkspace(db, {
        ...workspace,
        currentContentItemId: updated.id,
      });
      set({ content: updated, blocks: updated.revision.blocks, workspace: nextWorkspace, saveStatus: 'saved' });
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

  openPlatformTarget: async (platformId, socialAccountId = null) => {
    const { db, workspace } = get();
    if (!db) return;

    const nextTargets = addPlatformTarget(
      workspace.openPlatformTargets,
      platformId,
      socialAccountId,
    );
    const opened = nextTargets.find(
      (target) =>
        target.platformId === platformId &&
        (target.socialAccountId ?? null) === (socialAccountId ?? null),
    );
    const nextWorkspace = await persistWorkspace(db, {
      ...workspace,
      openPlatformTargets: nextTargets,
      activeTabId: opened ? getTabIdForTarget(opened) : workspace.activeTabId,
    });
    set({ workspace: nextWorkspace, showPlatformPicker: false });
  },

  closePlatformTarget: async (targetId) => {
    const { db, workspace } = get();
    if (!db) return;

    const closingTabId = getTabIdForTarget({
      id: targetId,
      platformId: '',
      socialAccountId: null,
    });
    const nextWorkspace = await persistWorkspace(db, {
      ...workspace,
      openPlatformTargets: removePlatformTarget(workspace.openPlatformTargets, targetId),
      activeTabId: workspace.activeTabId === closingTabId ? 'editor' : workspace.activeTabId,
    });
    set({ workspace: nextWorkspace });
  },

  openPlatformTab: async (platformId) => {
    await get().openPlatformTarget(platformId, null);
  },

  closePlatformTab: async (platformId) => {
    const target = get().workspace.openPlatformTargets.find(
      (item) => item.platformId === platformId && !item.socialAccountId,
    );
    if (target) {
      await get().closePlatformTarget(target.id);
    }
  },

  setActiveTab: async (tabId) => {
    const { db, workspace } = get();
    if (!db) return;
    const nextWorkspace = await persistWorkspace(db, { ...workspace, activeTabId: tabId });
    set({ workspace: nextWorkspace });
  },

  setSidebarSection: async (section) => {
    const { db, workspace } = get();
    if (!db) return;
    const nextWorkspace = await persistWorkspace(db, {
      ...workspace,
      sidebarSection: section,
      ...(section === 'editor' ? { activeTabId: 'editor' } : {}),
    });
    set({ workspace: nextWorkspace });
    if (section === 'library') {
      await get().loadLibrary();
    }
    if (section === 'accounts') {
      await get().loadAccounts();
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

  loadAccounts: async () => {
    const { socialAccountService } = get();
    if (!socialAccountService) return;
    const accounts = await socialAccountService.listAllAccountsIncludingInactive();
    set({ accounts });
  },

  createAccount: async (input) => {
    const { socialAccountService } = get();
    if (!socialAccountService) throw new Error('Accounts service unavailable');
    const account = await socialAccountService.createAccount(input);
    await get().loadAccounts();
    return account;
  },

  updateAccount: async (id, input) => {
    const { socialAccountService } = get();
    if (!socialAccountService) throw new Error('Accounts service unavailable');
    const account = await socialAccountService.updateAccount(id, input);
    await get().loadAccounts();
    return account;
  },

  removeAccount: async (id) => {
    const { socialAccountService, db, workspace } = get();
    if (!socialAccountService || !db) return;
    await socialAccountService.removeAccount(id);
    const nextTargets = removeTargetsForAccount(workspace.openPlatformTargets, id);
    const removedTabIds = new Set(
      workspace.openPlatformTargets
        .filter((target) => target.socialAccountId === id)
        .map((target) => getTabIdForTarget(target)),
    );
    const nextWorkspace = await persistWorkspace(db, {
      ...workspace,
      openPlatformTargets: nextTargets,
      activeTabId: removedTabIds.has(workspace.activeTabId) ? 'editor' : workspace.activeTabId,
    });
    await get().loadAccounts();
    set({ workspace: nextWorkspace });
  },

  setAccountActive: async (id, isActive) => {
    const { socialAccountService, db, workspace } = get();
    if (!socialAccountService || !db) return;
    await socialAccountService.setAccountActive(id, isActive);
    let nextWorkspace = workspace;
    if (!isActive) {
      const nextTargets = removeTargetsForAccount(workspace.openPlatformTargets, id);
      const removedTabIds = new Set(
        workspace.openPlatformTargets
          .filter((target) => target.socialAccountId === id)
          .map((target) => getTabIdForTarget(target)),
      );
      nextWorkspace = await persistWorkspace(db, {
        ...workspace,
        openPlatformTargets: nextTargets,
        activeTabId: removedTabIds.has(workspace.activeTabId) ? 'editor' : workspace.activeTabId,
      });
    }
    await get().loadAccounts();
    set({ workspace: nextWorkspace });
  },

  getAccountById: (id) => {
    if (!id) return null;
    return get().accounts.find((account) => account.id === id) ?? null;
  },

  openContentItem: async (id) => {
    const { db, contentService, workspace } = get();
    if (!db || !contentService) return;
    const content = await contentService.load(id);
    if (!content) return;
    const presentationOverrides = await loadPresentationOverridesForItem(db, content.id);
    const nextWorkspace = await persistWorkspace(db, {
      ...workspace,
      currentContentItemId: content.id,
      sidebarSection: 'editor',
      activeTabId: 'editor',
    });
    set({
      content,
      blocks: content.revision.blocks,
      workspace: nextWorkspace,
      presentationOverrides,
      activeComposerMediaId: null,
    });
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
    const nextWorkspace = await persistWorkspace(db, {
      ...workspace,
      currentContentItemId: content.id,
      sidebarSection: 'editor',
      activeTabId: 'editor',
    });
    set({ content, blocks: content.revision.blocks, workspace: nextWorkspace });
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
      revision: {
        id: revisionId,
        contentItemId: itemId,
        createdAt: now,
        updatedAt: now,
        blocks,
        metadata: { title: 'Запуск Reizoko' },
        version: 1,
        origin: 'auto',
        kind: 'working',
      },
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
        openPlatformTargets: demoPlatformTargets(['instagram', 'telegram', 'vk']),
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

    const openTargets = demoPlatformTargets(['instagram', 'telegram', 'vk']);

    if (scene === 'editor-light') {
      applyTheme('light');
      set({ workspace: { ...get().workspace, ...base } });
    } else if (scene === 'editor-dark') {
      applyTheme('dark');
      set({ workspace: { ...get().workspace, ...base } });
    } else if (scene === 'library-light') {
      applyTheme('light');
      set({ workspace: { ...get().workspace, sidebarSection: 'library', activeTabId: 'editor' } });
    } else if (scene === 'library-dark') {
      applyTheme('dark');
      set({ workspace: { ...get().workspace, sidebarSection: 'library', activeTabId: 'editor' } });
    } else if (scene === 'instagram-light') {
      applyTheme('light');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-instagram',
          openPlatformTargets: openTargets,
        },
      });
    } else if (scene === 'instagram-dark') {
      applyTheme('dark');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-instagram',
          openPlatformTargets: openTargets,
        },
      });
    } else if (scene === 'telegram-light') {
      applyTheme('light');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-telegram',
          openPlatformTargets: openTargets,
        },
      });
    } else if (scene === 'telegram-dark') {
      applyTheme('dark');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-telegram',
          openPlatformTargets: openTargets,
        },
      });
    } else if (scene === 'vk-light') {
      applyTheme('light');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-vk',
          openPlatformTargets: openTargets,
        },
      });
    } else if (scene === 'vk-dark') {
      applyTheme('dark');
      set({
        workspace: {
          ...get().workspace,
          ...base,
          activeTabId: 'platform-vk',
          openPlatformTargets: openTargets,
        },
      });
    } else if (scene === 'platform-picker-light') {
      applyTheme('light');
      set({
        workspace: { ...get().workspace, ...base },
        showPlatformPicker: true,
      });
    } else if (scene === 'platform-picker-dark') {
      applyTheme('dark');
      set({
        workspace: { ...get().workspace, ...base },
        showPlatformPicker: true,
      });
    } else if (scene === 'settings-light') {
      applyTheme('light');
      set({ workspace: { ...get().workspace, sidebarSection: 'settings', activeTabId: 'editor' } });
    } else if (scene === 'settings-dark') {
      applyTheme('dark');
      set({ workspace: { ...get().workspace, sidebarSection: 'settings', activeTabId: 'editor' } });
    }
  },

  openRevisionHistory: async () => {
    const { content } = get();
    if (!content) return;
    set({
      showRevisionHistory: true,
      selectedRevisionId: content.currentRevisionId,
      restoreCandidateId: null,
    });
    await get().loadRevisionHistory();
  },

  closeRevisionHistory: () => {
    set({
      showRevisionHistory: false,
      selectedRevisionId: null,
      restoreCandidateId: null,
    });
  },

  loadRevisionHistory: async () => {
    const { contentService, content } = get();
    if (!contentService || !content) return;
    const groupedHistory = await contentService.getGroupedHistory(content.id, content.currentRevisionId);
    set({ groupedHistory });
  },

  selectRevisionPreview: (revisionId) => {
    set({ selectedRevisionId: revisionId, restoreCandidateId: null });
  },

  createRevisionCheckpoint: async () => {
    const { contentService, content } = get();
    if (!contentService || !content) return;
    await get().saveContent();
    const updated = await contentService.createCheckpoint(content.id);
    set({
      content: updated,
      blocks: updated.revision.blocks,
      selectedRevisionId: updated.currentRevisionId,
      saveStatus: 'saved',
    });
    await get().loadRevisionHistory();
  },

  requestRestoreRevision: (revisionId) => {
    set({ restoreCandidateId: revisionId });
  },

  cancelRestoreRevision: () => {
    set({ restoreCandidateId: null });
  },

  confirmRestoreRevision: async () => {
    const { contentService, content, restoreCandidateId } = get();
    if (!contentService || !content || !restoreCandidateId) return;

    cancelScheduledSave();
    await get().saveContent();
    cancelScheduledSave();
    const updated = await contentService.restoreRevision(content.id, restoreCandidateId);
    cancelScheduledSave();
    set({
      content: updated,
      blocks: updated.revision.blocks,
      selectedRevisionId: updated.currentRevisionId,
      restoreCandidateId: null,
      saveStatus: 'saved',
    });
    await get().loadRevisionHistory();
  },

  fetchRevision: async (revisionId) => {
    const { contentService } = get();
    if (!contentService) return null;
    return contentService.getRevision(revisionId);
  },

  preparePublicationBatch: async () => {
    const { publicationService, content, workspace, accounts } = get();
    if (!publicationService || !content) return;

    const openTargets = workspace.openPlatformTargets;
    if (openTargets.length === 0) {
      set({ publicationPrepareError: 'Откройте хотя бы одну площадку, чтобы подготовить публикацию.' });
      return;
    }

    await get().saveContent();

    try {
      const result = await publicationService.prepareBatch({
        contentItemId: content.id,
        targets: openTargets.map((target) => toPublicationTarget(target)),
        presentationByTargetKey: buildPresentationByTargetKey(get().presentationOverrides),
      });

      const confirmationLabels = openTargets.map((target) => {
        const account = target.socialAccountId
          ? accounts.find((item) => item.id === target.socialAccountId)
          : null;
        return getPlatformTargetLabel(target.platformId, account);
      });

      set({
        content: result.item,
        blocks: result.item.revision.blocks,
        publicationPrepareConfirmation: confirmationLabels,
        publicationPrepareError: null,
        lastPreparedBatchId: result.batch.id,
        saveStatus: 'saved',
      });
    } catch (error) {
      set({
        publicationPrepareError:
          error instanceof Error ? error.message : 'Не удалось подготовить публикацию',
      });
    }
  },

  publishNowBatch: async () => {
    const { publicationService, lastPreparedBatchId, mediaPaths } = get();
    if (!publicationService || !lastPreparedBatchId) {
      set({ publicationPublishError: 'Сначала подготовьте публикацию.' });
      return;
    }
    set({ publishing: true, publicationPublishError: null });
    try {
      const statuses = await publicationService.assessBatchPublishability(lastPreparedBatchId);
      const publishableIds = statuses.filter((status) => status.publishable).map((s) => s.publicationId);
      if (publishableIds.length === 0) {
        set({ publicationPublishError: 'Нет готовых Telegram-целей для публикации.' });
        return;
      }
      await publicationService.publishBatchNow(lastPreparedBatchId, mediaPaths, {
        publicationIds: publishableIds,
      });
      const publications = await publicationService.listPublicationsByBatch(lastPreparedBatchId);
      set({
        publicationPrepareConfirmation: ['Telegram'],
        publicationPublishError: null,
        publicationResults: publications.map(toPublicationResultSummary),
      });
    } catch (error) {
      set({
        publicationPublishError:
          error instanceof Error ? error.message : 'Не удалось опубликовать.',
      });
    } finally {
      set({ publishing: false });
    }
  },

  retryPublication: async (publicationId: string) => {
    const { publicationService, mediaPaths, lastPreparedBatchId } = get();
    if (!publicationService) return;
    set({ publishing: true, publicationPublishError: null });
    try {
      await publicationService.retryPublication(publicationId, mediaPaths);
      if (lastPreparedBatchId) {
        const publications = await publicationService.listPublicationsByBatch(lastPreparedBatchId);
        set({ publicationResults: publications.map(toPublicationResultSummary) });
      }
    } catch (error) {
      set({
        publicationPublishError:
          error instanceof Error ? error.message : 'Не удалось повторить публикацию.',
      });
    } finally {
      set({ publishing: false });
    }
  },

  dismissPublicationResults: () => {
    set({ publicationResults: null, publicationPublishError: null });
  },

  refreshPublicationResults: async () => {
    const { publicationService, lastPreparedBatchId } = get();
    if (!publicationService || !lastPreparedBatchId) return;
    const publications = await publicationService.listPublicationsByBatch(lastPreparedBatchId);
    set({ publicationResults: publications.map(toPublicationResultSummary) });
  },

  getLatestBatchPublishStatuses: async () => {
    const { publicationService, lastPreparedBatchId } = get();
    if (!publicationService || !lastPreparedBatchId) return [];
    return publicationService.assessBatchPublishability(lastPreparedBatchId);
  },

  loadConnections: async () => {
    const { db, telegramConnectionService, vkConnectionService } = get();
    if (!db) return;
    const raw = await db.platformConnections.listAll();
    let connections = raw;
    if (telegramConnectionService) {
      connections = await telegramConnectionService.verifyAllConnectionsHealth(connections);
    }
    if (vkConnectionService) {
      connections = await Promise.all(
        connections.map((connection) =>
          connection.platformId === 'vk'
            ? vkConnectionService.verifyConnectionHealth(connection)
            : connection,
        ),
      );
    }
    set({ connections });
  },

  connectTelegramBot: async (token: string, existingConnectionId?: string | null) => {
    const { telegramConnectionService, db } = get();
    if (!telegramConnectionService || !db) throw new Error('Сервис подключений недоступен');
    await telegramConnectionService.connectBot(token, existingConnectionId);
    await get().loadConnections();
  },

  addTelegramDestination: async (connectionId: string, chatRef: string) => {
    const { telegramConnectionService, db, socialAccountService } = get();
    if (!telegramConnectionService || !db || !socialAccountService) {
      throw new Error('Сервис подключений недоступен');
    }
    const connection = await db.platformConnections.getById(connectionId);
    if (!connection) throw new Error('Подключение не найдено');
    const validation = await telegramConnectionService.validateDestination(connection, chatRef);
    if (!validation.canPublish) {
      throw new Error(validation.reason ?? 'TELEGRAM_PERMISSION_DENIED');
    }
    const handle = validation.chat.username ? `@${validation.chat.username}` : null;
    await socialAccountService.createAccount({
      platformId: 'telegram',
      displayName: validation.chat.title ?? chatRef,
      handle,
      connectionId,
      externalAccountId: String(validation.chat.id),
    });
    await get().loadAccounts();
  },

  connectVkOAuth: async (existingConnectionId?: string | null, options?: { upgradePermissions?: boolean }) => {
    const { vkConnectionService, db } = get();
    if (!vkConnectionService || !db) throw new Error('Сервис подключений недоступен');
    const secrets = createSecretStore();
    const config = await loadVkOAuthConfig(
      {
        get: async (key) => db.settings.get<string>(key, ''),
        set: async (key, value) => db.settings.set(key, value),
      },
      secrets,
    );
    const configError = validateVkOAuthConfig(config);
    if (configError) throw new Error(configError);
    const { connection, oauthMeta } = await vkConnectionService.connectOAuth(
      {
        appId: config.appId,
        serverBaseUrl: config.serverBaseUrl ?? VK_DEFAULT_SERVER_BASE_URL,
        redirectUri: config.redirectUri ?? VK_CANONICAL_REDIRECT_URI,
      },
      [...VK_OAUTH_SCOPES],
      existingConnectionId,
      { forceConsent: options?.upgradePermissions ?? Boolean(existingConnectionId) },
    );
    if (oauthMeta) {
      await db.settings.set(
        buildVkOAuthMetaSettingsKey(connection.id),
        serializeVkOAuthConnectionMeta(oauthMeta),
      );
    }
    await get().loadConnections();
    return connection.id;
  },

  loadVkIntegrationConfig: async () => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');
    return loadVkOAuthConfig(
      {
        get: async (key) => db.settings.get<string>(key, ''),
        set: async (key, value) => db.settings.set(key, value),
      },
      createSecretStore(),
    );
  },

  loadVkIntegrationFormState: async () => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');
    const reader = {
      get: async (key: string) => db.settings.get<string>(key, ''),
      set: async (key: string, value: string) => db.settings.set(key, value),
    };
    return loadVkIntegrationFormState(reader, createSecretStore());
  },

  saveVkIntegrationDraft: async (draft: VkIntegrationDraft) => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');
    const reader = {
      get: async (key: string) => db.settings.get<string>(key, ''),
      set: async (key: string, value: string) => db.settings.set(key, value),
    };
    const secrets = createSecretStore();
    const config = await buildVkOAuthConfigFromDraft(reader, secrets, draft);
    await saveVkOAuthConfig(reader, secrets, config);
  },

  verifyVkIntegrationDraft: async (draft: VkIntegrationDraft) => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');
    const reader = {
      get: async (key: string) => db.settings.get<string>(key, ''),
      set: async (key: string, value: string) => db.settings.set(key, value),
    };
    const secrets = createSecretStore();
    const config = await buildVkOAuthConfigFromDraft(reader, secrets, draft);
    let nativeProbeSteps: Awaited<ReturnType<typeof probeVkServerFromNative>> = [];
    try {
      nativeProbeSteps = await probeVkServerFromNative(config.serverBaseUrl ?? VK_DEFAULT_SERVER_BASE_URL);
    } catch (error) {
      nativeProbeSteps = [
        {
          id: 'native-probe-command',
          label: 'Нативная проверка (Tauri)',
          channel: 'native',
          status: 'fail',
          detail: error instanceof Error ? error.message : String(error),
        },
      ];
    }
    return verifyVkIntegrationSettings(config, { nativeProbeSteps });
  },

  saveVkIntegrationConfig: async (config: VkOAuthConfig) => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');
    await saveVkOAuthConfig(
      {
        get: async (key) => db.settings.get<string>(key, ''),
        set: async (key, value) => db.settings.set(key, value),
      },
      createSecretStore(),
      {
        ...config,
        redirectUri: VK_CANONICAL_REDIRECT_URI,
      },
    );
  },

  verifyVkIntegrationConfig: async () => {
    const config = await get().loadVkIntegrationConfig();
    let nativeProbeSteps: Awaited<ReturnType<typeof probeVkServerFromNative>> = [];
    try {
      nativeProbeSteps = await probeVkServerFromNative(config.serverBaseUrl ?? VK_DEFAULT_SERVER_BASE_URL);
    } catch (error) {
      nativeProbeSteps = [
        {
          id: 'native-probe-command',
          label: 'Нативная проверка (Tauri)',
          channel: 'native',
          status: 'fail',
          detail: error instanceof Error ? error.message : String(error),
        },
      ];
    }
    return verifyVkIntegrationSettings(config, { nativeProbeSteps });
  },

  loadVkTargetsForConnection: async (connectionId: string) => {
    const { vkConnectionService, db } = get();
    if (!vkConnectionService || !db) throw new Error('Сервис подключений недоступен');
    const rawMeta = await db.settings.get<string>(buildVkOAuthMetaSettingsKey(connectionId), '');
    const oauthMeta = parseVkOAuthConnectionMeta(rawMeta || null);
    return vkConnectionService.listAvailableTargets(connectionId, oauthMeta);
  },

  addVkPublicationTargets: async (connectionId: string, targets: VkTargetCandidate[]) => {
    const { vkConnectionService } = get();
    if (!vkConnectionService) throw new Error('Сервис подключений недоступен');
    await vkConnectionService.addPublicationTargets({ connectionId, targets });
    await get().loadAccounts();
  },

  resolveVkExternalWall: async (connectionId: string, input: string) => {
    const { vkConnectionService } = get();
    if (!vkConnectionService) throw new Error('Сервис подключений недоступен');
    const candidate = await vkConnectionService.resolveExternalWall(connectionId, input);
    if (!candidate.canPost) {
      throw new Error(
        'На эту стену нельзя публиковать через подключённый аккаунт ВКонтакте.',
      );
    }
    return candidate;
  },

  verifyVkCommunityToken: async (input: { communityInput: string; accessToken: string }) => {
    const { vkConnectionService } = get();
    if (!vkConnectionService) throw new Error('Сервис подключений недоступен');
    const userOAuth = await vkConnectionService.findUserOAuthConnection();
    return vkConnectionService.verifyCommunityToken({
      communityInput: input.communityInput,
      accessToken: input.accessToken,
      userOAuthSecretRef: userOAuth?.secretRef ?? null,
    });
  },

  connectVkCommunityToken: async (input: {
    verification: VkCommunityTokenVerification;
    accessToken: string;
  }) => {
    const { vkConnectionService } = get();
    if (!vkConnectionService) throw new Error('Сервис подключений недоступен');
    await vkConnectionService.connectCommunityToken(input);
    await get().loadConnections();
    await get().loadAccounts();
  },

  replaceVkCommunityToken: async (connectionId: string, accessToken: string) => {
    const { vkConnectionService } = get();
    if (!vkConnectionService) throw new Error('Сервис подключений недоступен');
    await vkConnectionService.replaceCommunityToken(connectionId, accessToken);
    await get().loadConnections();
  },

  refreshVkCommunityTokenStatus: async (connectionId: string) => {
    const { vkConnectionService } = get();
    if (!vkConnectionService) throw new Error('Сервис подключений недоступен');
    const verification = await vkConnectionService.refreshCommunityTokenStatus(connectionId);
    await get().loadConnections();
    await get().loadAccounts();
    return verification;
  },

  disconnectConnection: async (connectionId: string) => {
    const { telegramConnectionService, vkConnectionService, db } = get();
    if (!db) return;
    const connection = await db.platformConnections.getById(connectionId);
    if (!connection) return;
    if (connection.platformId === 'vk' && vkConnectionService) {
      await vkConnectionService.disconnect(connectionId);
    } else if (telegramConnectionService) {
      await telegramConnectionService.disconnect(connectionId);
    }
    await db.socialAccounts.clearConnectionForAccounts(connectionId);
    await get().loadConnections();
    await get().loadAccounts();
  },

  linkAccountToConnection: async (accountId: string, connectionId: string) => {
    const { socialAccountService } = get();
    if (!socialAccountService) return;
    await socialAccountService.updateAccount(accountId, {
      connectionId,
      connectionState: 'connected',
    });
    await get().loadAccounts();
  },

  dismissPublicationConfirmation: () => {
    set({ publicationPrepareConfirmation: null, publicationPrepareError: null });
  },

  getPublicationState: async () => {
    const { publicationService, content } = get();
    if (!publicationService || !content) return null;
    const batches = await publicationService.listBatchesByContentItem(content.id);
    const publications = await publicationService.listPublicationsByContentItem(content.id);
    return { batches, publications };
  },

  createBackup: async () => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');

    if (isSmokeTestMode()) {
      const dir = await appDataDir();
      const path = (await join(dir, 'smoke-backup.reizoko-backup')).replace(/\//g, '\\');
      const result = await writeBackupToPath(db, path);
      return { path, warnings: result.warnings };
    }

    return createUserBackup(db);
  },

  exportJsonBackup: async () => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');
    if (isSmokeTestMode()) {
      const dir = await appDataDir();
      const path = (await join(dir, 'smoke-export.json')).replace(/\//g, '\\');
      const service = createBackupService(db);
      const exported = await service.exportJson();
      await writeBytesToPath(path, new TextEncoder().encode(exported.json));
      return path;
    }
    return exportUserJson(db);
  },

  beginRestoreBackup: async () => {
    const { db } = get();
    if (!db) throw new Error('База данных недоступна');

    const path = isSmokeTestMode()
      ? (await join(await appDataDir(), 'smoke-backup.reizoko-backup')).replace(/\//g, '\\')
      : await pickBackupFile();

    if (!path) return;

    const validation = await validateUserBackup(path);
    if (!validation.valid || !validation.manifest) {
      throw new Error(
        validation.errors[0] ??
          'Не удалось восстановить резервную копию: файл повреждён или содержит неполные данные.',
      );
    }

    const service = createBackupService(db);
    set({
      restoreCandidate: {
        path,
        summary: service.summarize(validation.manifest),
      },
    });
  },

  confirmRestoreBackup: async () => {
    const { db, restoreCandidate } = get();
    if (!db || !restoreCandidate) return;

    if (isSmokeTestMode()) {
      await restoreBackupFromPath(db, restoreCandidate.path);
    } else {
      await restoreUserBackup(db, restoreCandidate.path);
    }

    set({ restoreCandidate: null });
    await get().reloadApplicationState();
  },

  cancelRestoreBackup: () => {
    set({ restoreCandidate: null });
  },

  reloadApplicationState: async () => {
    const { db, contentService, socialAccountService } = get();
    if (!db || !contentService || !socialAccountService) return;

    const workspace = await db.workspace.getState();
    const storedTheme = await db.settings.get<ThemeMode>(THEME_SETTINGS_KEY, readStoredThemeMode());
    persistThemeMode(storedTheme);

    let content: ContentItemWithRevision | null = null;
    if (workspace.currentContentItemId) {
      content = await db.content.getItem(workspace.currentContentItemId);
    }
    if (!content) {
      content = await contentService.createDraft();
      const nextWorkspace = await persistWorkspace(db, {
        ...workspace,
        currentContentItemId: content.id,
      });
      set({
        workspace: nextWorkspace,
        content,
        blocks: content.revision.blocks,
        themeMode: storedTheme,
      });
    } else {
      set({
        workspace,
        content,
        blocks: content.revision.blocks,
        themeMode: storedTheme,
      });
    }

    const mediaItems = await db.media.list();
    const mediaPaths = Object.fromEntries(mediaItems.map((item) => [item.id, item.localPath]));
    const accounts = await socialAccountService.listAllAccountsIncludingInactive();
    const currentContent = get().content;
    const presentationOverrides = currentContent
      ? await loadPresentationOverridesForItem(db, currentContent.id)
      : {};
    set({ mediaPaths, accounts, presentationOverrides });
    await get().loadLibrary();
  },

  getPresentationOverrides: (platformId, socialAccountId) => {
    const { content, presentationOverrides } = get();
    return getOverridesForTarget(presentationOverrides, content?.id, platformId, socialAccountId);
  },

  setMediaTransform: async (platformId, socialAccountId, transform) => {
    const { content, presentationOverrides } = get();
    if (!content) return;
    const existing = getOverridesForTarget(
      presentationOverrides,
      content.id,
      platformId,
      socialAccountId,
    );
    const base = buildPresentationPatch({
      contentItemId: content.id,
      platformId,
      socialAccountId,
      existing,
      patch: {},
    });
    const next = upsertMediaTransform(base, transform);
    const storageKey = presentationStorageKey(content.id, next.targetKey);
    set({
      presentationOverrides: { ...presentationOverrides, [storageKey]: next },
    });
    schedulePresentationSave(get);
  },

  setAspectRatio: async (platformId, socialAccountId, mediaId, aspectRatioId) => {
    const { content, presentationOverrides } = get();
    if (!content) return;
    const existing = getOverridesForTarget(
      presentationOverrides,
      content.id,
      platformId,
      socialAccountId,
    );
    const base = buildPresentationPatch({
      contentItemId: content.id,
      platformId,
      socialAccountId,
      existing,
      patch: {},
    });
    const next = applyAspectRatio(base, mediaId, aspectRatioId);
    const storageKey = presentationStorageKey(content.id, next.targetKey);
    set({
      presentationOverrides: { ...presentationOverrides, [storageKey]: next },
    });
    schedulePresentationSave(get);
  },

  setTextOverrideMode: async (platformId, socialAccountId, useMasterText) => {
    const { content, presentationOverrides } = get();
    if (!content) return;
    const existing = getOverridesForTarget(
      presentationOverrides,
      content.id,
      platformId,
      socialAccountId,
    );
    const base = buildPresentationPatch({
      contentItemId: content.id,
      platformId,
      socialAccountId,
      existing,
      patch: {},
    });
    const next = applyTextOverrideMode(base, useMasterText);
    const storageKey = presentationStorageKey(content.id, next.targetKey);
    set({
      presentationOverrides: { ...presentationOverrides, [storageKey]: next },
    });
    schedulePresentationSave(get);
  },

  setPlatformTextOverride: async (platformId, socialAccountId, text) => {
    const { content, presentationOverrides } = get();
    if (!content) return;
    const existing = getOverridesForTarget(
      presentationOverrides,
      content.id,
      platformId,
      socialAccountId,
    );
    const base = buildPresentationPatch({
      contentItemId: content.id,
      platformId,
      socialAccountId,
      existing,
      patch: {},
    });
    const next = applyPlatformText(base, text);
    const storageKey = presentationStorageKey(content.id, next.targetKey);
    set({
      presentationOverrides: { ...presentationOverrides, [storageKey]: next },
    });
    schedulePresentationSave(get);
  },

  resetPlatformPresentation: async (platformId, socialAccountId) => {
    const { db, content, presentationOverrides } = get();
    if (!db || !content) return;
    const targetKey = `${platformId}:${socialAccountId ?? ''}`;
    await db.presentationOverrides.deleteByTarget(content.id, targetKey);
    const storageKey = presentationStorageKey(content.id, targetKey);
    const nextMap = { ...presentationOverrides };
    delete nextMap[storageKey];
    set({ presentationOverrides: nextMap, activeComposerMediaId: null });
  },

  selectComposerMedia: (mediaId) => {
    set({ activeComposerMediaId: mediaId });
  },
}));

function scheduleSave(get: () => AppState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void get().saveContent();
  }, 600);
}

export function resolveActivePlatformTarget(workspace: WorkspaceState) {
  const targetId = parsePlatformTabId(workspace.activeTabId);
  if (!targetId) return null;
  return workspace.openPlatformTargets.find((target) => target.id === targetId) ?? null;
}

function toPublicationResultSummary(publication: Publication): PublicationResultSummary {
  return {
    id: publication.id,
    platformId: publication.platformId,
    status: publication.status,
    remotePostId: publication.remotePostId ?? null,
    remoteUrl: publication.remoteUrl ?? null,
    errorMessage: publication.errorMessage ?? null,
    publishedAt: publication.publishedAt ?? null,
  };
}
