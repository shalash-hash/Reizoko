import { Check, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import type { SaveStatus } from '../stores/app-store';
import './status-bar.css';

interface StatusBarProps {
  saveStatus: SaveStatus;
  blockCount: number;
  openTabCount: number;
}

function formatTime() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function StatusBar({ saveStatus, blockCount }: StatusBarProps) {
  return (
    <footer className="status-bar" aria-live="polite">
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

      <div className="status-bar__right">
        <button type="button" className="status-bar__publish" disabled title="Публикация — Stage 3">
          Опубликовать
        </button>
        <button type="button" className="status-bar__publish-menu" disabled aria-label="Дополнительно">
          <ChevronDown size={16} strokeWidth={2} />
        </button>
      </div>
    </footer>
  );
}
