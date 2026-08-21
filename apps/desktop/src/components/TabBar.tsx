import type { CSSProperties } from 'react';
import { PenLine, Plus, X, ChevronDown, Menu } from 'lucide-react';
import { platformRegistry } from '@reizoko/platform-sdk';
import { IconButton } from '@reizoko/ui';
import { useAppStore, type SaveStatus } from '../stores/app-store';
import { PlatformIcon } from './PlatformIcon';
import './tab-bar.css';

interface TabBarProps {
  saveStatus: SaveStatus;
}

export function TabBar({ saveStatus }: TabBarProps) {
  const workspace = useAppStore((s) => s.workspace);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closePlatformTab = useAppStore((s) => s.closePlatformTab);
  const setShowPlatformPicker = useAppStore((s) => s.setShowPlatformPicker);

  const platformTabs = workspace.openPlatformTabs
    .map((id) => platformRegistry.get(id))
    .filter(Boolean);

  const savedLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Error' : 'Saved';

  return (
    <div className="tab-bar" role="tablist" aria-label="Вкладки рабочего пространства">
      <div className="tab-bar__scroll">
        <button
          type="button"
          role="tab"
          aria-selected={workspace.activeTabId === 'editor'}
          className={`tab-bar__tab tab-bar__tab--pinned ${workspace.activeTabId === 'editor' ? 'tab-bar__tab--active' : ''}`}
          onClick={() => void setActiveTab('editor')}
        >
          <PenLine className="tab-bar__tab-icon" strokeWidth={1.75} aria-hidden />
          <span>Редактор</span>
        </button>

        {platformTabs.map((platform) => {
          const adapter = platform!.adapter;
          const tabId = `platform-${adapter.id}`;
          const isActive = workspace.activeTabId === tabId;
          return (
            <div
              key={adapter.id}
              className={`tab-bar__tab tab-bar__tab--platform ${isActive ? 'tab-bar__tab--active' : ''}`}
              role="tab"
              aria-selected={isActive}
              style={{ '--platform-accent': adapter.color } as CSSProperties}
            >
              <button
                type="button"
                className="tab-bar__tab-main"
                onClick={() => void setActiveTab(tabId)}
              >
                <PlatformIcon platformId={adapter.id} size={16} />
                <span>{adapter.name}</span>
                <ChevronDown size={12} strokeWidth={2} className="tab-bar__chevron" aria-hidden />
              </button>
              <IconButton
                label={`Закрыть ${adapter.name}`}
                size="sm"
                className="tab-bar__close"
                onClick={() => void closePlatformTab(adapter.id)}
              >
                <X strokeWidth={2} />
              </IconButton>
            </div>
          );
        })}

        <button
          type="button"
          className="tab-bar__add tab-bar__add--inline"
          aria-label="Добавить площадку"
          onClick={() => setShowPlatformPicker(true)}
        >
          <Plus strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="tab-bar__status">
        <span className="tab-bar__status-pill">
          <span className="tab-bar__status-dot" data-status={saveStatus} />
          Local • {savedLabel}
        </span>
        <button type="button" className="tab-bar__menu" aria-label="Меню">
          <Menu size={18} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
