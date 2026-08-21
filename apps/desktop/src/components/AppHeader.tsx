import { CloudOff } from 'lucide-react';
import type { SaveStatus } from '../stores/app-store';
import './app-header.css';

interface AppHeaderProps {
  saveStatus: SaveStatus;
}

export function AppHeader({ saveStatus }: AppHeaderProps) {
  const statusText =
    saveStatus === 'saving' ? 'Сохранение…' : saveStatus === 'error' ? 'Ошибка' : 'Сохранено';

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo" aria-hidden>
          R
        </span>
        <span className="app-header__title">Reizoko</span>
      </div>

      <div className="app-header__status">
        <span className="app-header__pill">
          <CloudOff size={13} strokeWidth={2} aria-hidden />
          Локально
        </span>
        <span className="app-header__dot" data-status={saveStatus} aria-hidden />
        <span className="app-header__saved">{statusText}</span>
      </div>
    </header>
  );
}
