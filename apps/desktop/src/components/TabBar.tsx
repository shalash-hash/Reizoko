import type { CSSProperties } from 'react';
import { PenLine, Plus, X, ChevronDown, History } from 'lucide-react';
import { platformRegistry } from '@reizoko/platform-sdk';
import { getPlatformTargetLabel } from '@reizoko/core';
import { IconButton } from '@reizoko/ui';
import { useAppStore, type SaveStatus } from '../stores/app-store';
import { PlatformIcon } from './PlatformIcon';
import './tab-bar.css';

interface TabBarProps {
  saveStatus: SaveStatus;
}

export function TabBar({ saveStatus }: TabBarProps) {
  const workspace = useAppStore((s) => s.workspace);
  const accounts = useAppStore((s) => s.accounts);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closePlatformTarget = useAppStore((s) => s.closePlatformTarget);
  const setShowPlatformPicker = useAppStore((s) => s.setShowPlatformPicker);
  const openRevisionHistory = useAppStore((s) => s.openRevisionHistory);

  const savedLabel =
    saveStatus === 'saving' ? 'Сохранение…' : saveStatus === 'error' ? 'Ошибка' : 'Сохранено';

  return (
    <div className="tab-bar" role="tablist" aria-label="Вкладки рабочего пространства">
      <div className="tab-bar__scroll">
        <button
          type="button"
          role="tab"
          data-testid="editor-tab"
          aria-selected={workspace.activeTabId === 'editor'}
          className={`tab-bar__tab tab-bar__tab--pinned ${workspace.activeTabId === 'editor' ? 'tab-bar__tab--active' : ''}`}
          onClick={() => void setActiveTab('editor')}
        >
          <PenLine className="tab-bar__tab-icon" strokeWidth={1.75} aria-hidden />
          <span>Редактор</span>
        </button>

        {workspace.openPlatformTargets.map((target) => {
          const adapter = platformRegistry.get(target.platformId)?.adapter;
          if (!adapter) return null;
          const tabId = `platform-${target.id}`;
          const isActive = workspace.activeTabId === tabId;
          const account = target.socialAccountId
            ? accounts.find((item) => item.id === target.socialAccountId)
            : null;
          const label = getPlatformTargetLabel(adapter.id, account);

          return (
            <div
              key={target.id}
              className={`tab-bar__tab tab-bar__tab--platform ${isActive ? 'tab-bar__tab--active' : ''}`}
              role="tab"
              data-testid={`platform-tab-${target.id}`}
              aria-selected={isActive}
              data-platform={adapter.id}
              style={{ '--platform-accent': adapter.color } as CSSProperties}
            >
              <button type="button" className="tab-bar__tab-main" onClick={() => void setActiveTab(tabId)}>
                <PlatformIcon platformId={adapter.id} size={16} />
                <span>{label}</span>
                <ChevronDown size={12} strokeWidth={2} className="tab-bar__chevron" aria-hidden />
              </button>
              <IconButton
                label={`Закрыть ${label}`}
                size="sm"
                className="tab-bar__close"
                data-testid={`platform-tab-close-${target.id}`}
                onClick={() => void closePlatformTarget(target.id)}
              >
                <X strokeWidth={2} />
              </IconButton>
            </div>
          );
        })}

        <button
          type="button"
          className="tab-bar__add tab-bar__add--inline"
          data-testid="platform-picker-open"
          aria-label="Добавить площадку"
          onClick={() => setShowPlatformPicker(true)}
        >
          <Plus strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="tab-bar__status">
        {workspace.activeTabId === 'editor' ? (
          <button
            type="button"
            className="tab-bar__history"
            data-testid="revision-history-open"
            aria-label="История версий"
            onClick={() => void openRevisionHistory()}
          >
            <History size={16} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
        <span className="tab-bar__status-pill">
          <span className="tab-bar__status-dot" data-testid="save-status" data-status={saveStatus} />
          Локально · {savedLabel}
        </span>
      </div>
    </div>
  );
}
