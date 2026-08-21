import {
  PenLine,
  Library,
  Calendar,
  History,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeft,
  CalendarClock,
  BarChart3,
  UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { getDisabledReason } from '@reizoko/core';
import { PlannedFeature, Sidebar, type SidebarItem } from '@reizoko/ui';
import { useAppStore } from '../stores/app-store';
import { TabBar } from './TabBar';
import { PlatformPicker } from './PlatformPicker';
import { LibraryView } from './LibraryView';
import { PlatformPreviewPanel } from './PlatformPreviewPanel';
import { SettingsView } from './SettingsView';
import { StatusBar } from './StatusBar';
import { InspectorPanel } from './InspectorPanel';
import { BlockEditor } from '@reizoko/editor';
import { platformRegistry } from '@reizoko/platform-sdk';
import { getAllPlatformCatalog } from '../platforms/planned-catalog';
import { pickAndStoreImage, getMediaUrl, loadMediaPath } from '../services/media-service';
import { createBlock } from '@reizoko/core';
import './app-shell.css';

const PRIMARY_NAV: SidebarItem[] = [
  { id: 'editor', label: 'Редактор', icon: PenLine, enabled: true },
  { id: 'library', label: 'Библиотека', icon: Library, enabled: true },
];

const WORK_PLANNED_NAV: SidebarItem[] = [
  {
    id: 'calendar',
    label: 'Календарь',
    icon: Calendar,
    enabled: false,
    plannedMessage: getDisabledReason('serverScheduler'),
    plannedStage: 3,
  },
  {
    id: 'history',
    label: 'История',
    icon: History,
    enabled: false,
    plannedMessage: 'Запланировано — история публикаций появится на Stage 3.',
    plannedStage: 3,
  },
  {
    id: 'accounts',
    label: 'Аккаунты',
    icon: Users,
    enabled: false,
    plannedMessage: 'Запланировано — подключение аккаунтов появится на Stage 3.',
    plannedStage: 3,
  },
];

const SOON_NAV: SidebarItem[] = [
  {
    id: 'planning',
    label: 'Планирование',
    icon: CalendarClock,
    enabled: false,
    plannedMessage: 'Запланировано на Stage 3.',
    plannedStage: 3,
  },
  {
    id: 'analytics',
    label: 'Аналитика',
    icon: BarChart3,
    enabled: false,
    plannedMessage: 'Запланировано на Stage 3.',
    plannedStage: 3,
  },
  {
    id: 'teams',
    label: 'Команды',
    icon: UsersRound,
    enabled: false,
    plannedMessage: 'Запланировано на Stage 3.',
    plannedStage: 3,
  },
];

const FOOTER_NAV: SidebarItem[] = [
  { id: 'settings', label: 'Настройки', icon: Settings, enabled: true },
];

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const workspace = useAppStore((s) => s.workspace);
  const blocks = useAppStore((s) => s.blocks);
  const content = useAppStore((s) => s.content);
  const db = useAppStore((s) => s.db);
  const saveStatus = useAppStore((s) => s.saveStatus);
  const showPlatformPicker = useAppStore((s) => s.showPlatformPicker);
  const setBlocks = useAppStore((s) => s.setBlocks);
  const setTitle = useAppStore((s) => s.setTitle);
  const setSidebarSection = useAppStore((s) => s.setSidebarSection);
  const openPlatformTab = useAppStore((s) => s.openPlatformTab);
  const setShowPlatformPicker = useAppStore((s) => s.setShowPlatformPicker);
  const registerMediaPath = useAppStore((s) => s.registerMediaPath);
  const mediaPaths = useAppStore((s) => s.mediaPaths);

  const activePlatformId = workspace.activeTabId.startsWith('platform-')
    ? workspace.activeTabId.replace('platform-', '')
    : workspace.openPlatformTabs[0] ?? 'instagram';

  const inspectorPlatformId =
    workspace.activeTabId.startsWith('platform-')
      ? workspace.activeTabId.replace('platform-', '')
      : workspace.openPlatformTabs[0] ?? 'instagram';

  const handleAddImage = async () => {
    if (!db) return;
    const mediaId = await pickAndStoreImage(db);
    if (!mediaId) return;
    const path = await loadMediaPath(db, mediaId);
    if (path) registerMediaPath(mediaId, path);
    setBlocks([...blocks, createBlock('image', blocks.length, { mediaId })]);
  };

  const renderEditorWorkspace = () => {
    if (activePlatformId && workspace.activeTabId.startsWith('platform-')) {
      return <PlatformPreviewPanel platformId={activePlatformId} />;
    }

    return (
      <BlockEditor
        blocks={blocks}
        onChange={setBlocks}
        onAddImage={() => void handleAddImage()}
        getMediaUrl={(mediaId) => getMediaUrl(mediaId, mediaPaths[mediaId])}
        title={content?.metadata.title ?? ''}
        onTitleChange={setTitle}
      />
    );
  };

  const renderMain = () => {
    if (workspace.sidebarSection === 'library') return <LibraryView />;
    if (workspace.sidebarSection === 'settings') return <SettingsView />;

    if (workspace.sidebarSection !== 'editor') {
      const item = [...WORK_PLANNED_NAV, ...SOON_NAV].find((i) => i.id === workspace.sidebarSection);
      return (
        <PlannedFeature
          title={item?.label ?? ''}
          description={item?.plannedMessage ?? 'Раздел в разработке'}
          stage={item?.plannedStage}
        />
      );
    }

    return (
      <div className="app-shell__workspace">
        <div className="app-shell__canvas">{renderEditorWorkspace()}</div>
        <InspectorPanel platformId={inspectorPlatformId} />
      </div>
    );
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'app-shell--collapsed' : ''}`}>
      <div className="app-shell__body">
        <aside className="app-shell__sidebar">
          <div className="app-shell__sidebar-top">
            {!sidebarCollapsed && (
              <div className="app-shell__sidebar-brand">
                <span className="app-shell__sidebar-logo">R</span>
                <span>Reizoko</span>
              </div>
            )}
          </div>

          <Sidebar
            primaryItems={PRIMARY_NAV}
            workPlannedItems={WORK_PLANNED_NAV}
            plannedItems={SOON_NAV}
            footerItems={FOOTER_NAV}
            activeId={workspace.sidebarSection}
            collapsed={sidebarCollapsed}
            onSelect={(id) => void setSidebarSection(id as typeof workspace.sidebarSection)}
          />

          <button
            type="button"
            className="app-shell__collapse"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'Развернуть' : 'Свернуть'}
          >
            {sidebarCollapsed ? <PanelLeft strokeWidth={1.75} /> : <PanelLeftClose strokeWidth={1.75} />}
            {!sidebarCollapsed && <span>Свернуть</span>}
          </button>
        </aside>

        <div className="app-shell__main">
          {workspace.sidebarSection === 'editor' && <TabBar saveStatus={saveStatus} />}
          <main className="app-shell__content">{renderMain()}</main>
          {workspace.sidebarSection === 'editor' && (
            <StatusBar
              saveStatus={saveStatus}
              blockCount={blocks.length}
              openTabCount={workspace.openPlatformTabs.length}
            />
          )}
        </div>
      </div>

      {showPlatformPicker && (
        <PlatformPicker
          platforms={getAllPlatformCatalog(platformRegistry)}
          openPlatformIds={workspace.openPlatformTabs}
          onSelect={(id) => void openPlatformTab(id)}
          onClose={() => setShowPlatformPicker(false)}
        />
      )}
    </div>
  );
}
