import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { platformRegistry } from '@reizoko/platform-sdk';
import type { SaveStatus } from '../stores/app-store';
import './status-bar.css';

interface StatusBarProps {
  saveStatus: SaveStatus;
  blockCount: number;
  canPreparePublication: boolean;
  prepareDisabledReason?: string;
  prepareConfirmation: string[] | null;
  onPreparePublication: () => void;
  onDismissConfirmation: () => void;
}

function formatTime() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function platformLabel(platformId: string): string {
  return platformRegistry.get(platformId)?.adapter.name ?? platformId;
}

export function StatusBar({
  saveStatus,
  blockCount,
  canPreparePublication,
  prepareDisabledReason,
  prepareConfirmation,
  onPreparePublication,
  onDismissConfirmation,
}: StatusBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!prepareConfirmation) return;
    const timer = setTimeout(() => onDismissConfirmation(), 6000);
    return () => clearTimeout(timer);
  }, [prepareConfirmation, onDismissConfirmation]);

  const handlePrepare = () => {
    setMenuOpen(false);
    onPreparePublication();
  };

  return (
    <footer className="status-bar" data-testid="status-bar" aria-live="polite">
      <div className="status-bar__left">
        <span className={`status-bar__save status-bar__save--${saveStatus}`}>
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="status-bar__icon status-bar__icon--spin" strokeWidth={2} aria-hidden />
              Сохранение…
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="status-bar__icon" strokeWidth={2} aria-hidden />
              Сохранено {formatTime()}
            </>
          )}
          {saveStatus === 'error' && <>Ошибка сохранения</>}
        </span>
        <span className="status-bar__meta">Блоков: {blockCount}</span>
        <span className="status-bar__autosave">
          <RefreshCw size={12} strokeWidth={2} aria-hidden />
          Автосохранение включено
        </span>
      </div>

      {prepareConfirmation && prepareConfirmation.length > 0 && (
        <div className="status-bar__confirmation" data-testid="publication-prepare-confirmation" role="status">
          <strong>Черновик публикации создан</strong>
          <span>{prepareConfirmation.map(platformLabel).join(' · ')}</span>
        </div>
      )}

      <div className="status-bar__right">
        <div className="status-bar__publish-group" ref={menuRef}>
          <button
            type="button"
            className="status-bar__publish"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-testid="publish-menu-trigger"
            onClick={() => setMenuOpen((open) => !open)}
          >
            Опубликовать
          </button>
          <button
            type="button"
            className="status-bar__publish-menu"
            aria-label="Дополнительные действия публикации"
            data-testid="publish-menu-toggle"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <ChevronDown size={16} strokeWidth={2} />
          </button>

          {menuOpen && (
            <div className="status-bar__publish-dropdown" role="menu" data-testid="publish-menu">
              <button
                type="button"
                role="menuitem"
                className="status-bar__publish-item status-bar__publish-item--active"
                data-testid="publication-prepare"
                disabled={!canPreparePublication}
                title={!canPreparePublication ? prepareDisabledReason : undefined}
                onClick={handlePrepare}
              >
                Подготовить публикацию
              </button>
              <button
                type="button"
                role="menuitem"
                className="status-bar__publish-item status-bar__publish-item--soon"
                disabled
                title="Скоро — реальная публикация появится на Stage 3"
              >
                Опубликовать сейчас
                <span className="status-bar__soon">скоро</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="status-bar__publish-item status-bar__publish-item--soon"
                disabled
                title="Скоро — планирование появится на Stage 3"
              >
                Запланировать
                <span className="status-bar__soon">скоро</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
