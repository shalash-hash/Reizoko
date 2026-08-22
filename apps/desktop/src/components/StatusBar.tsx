import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, RefreshCw, X } from 'lucide-react';
import { platformRegistry } from '@reizoko/platform-sdk';
import type { SaveStatus } from '../stores/app-store';
import './status-bar.css';

export interface PublishStatusItem {
  label: string;
  publishable: boolean;
  reason?: string;
}

export interface PublicationResultView {
  id: string;
  platformId: string;
  status: string;
  remotePostId?: string | null;
  remoteUrl?: string | null;
  errorMessage?: string | null;
  publishedAt?: string | null;
}

interface StatusBarProps {
  saveStatus: SaveStatus;
  blockCount: number;
  canPreparePublication: boolean;
  prepareDisabledReason?: string;
  prepareConfirmation: string[] | null;
  onPreparePublication: () => void;
  onDismissConfirmation: () => void;
  canPublishNow?: boolean;
  publishNowDisabledReason?: string;
  onPublishNow?: () => void;
  publishing?: boolean;
  publishStatuses?: PublishStatusItem[];
  publicationPublishError?: string | null;
  publicationResults?: PublicationResultView[] | null;
  onRetryPublication?: (publicationId: string) => void;
  onDismissPublicationResults?: () => void;
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
  canPublishNow = false,
  publishNowDisabledReason,
  onPublishNow,
  publishing = false,
  publishStatuses = [],
  publicationPublishError = null,
  publicationResults = null,
  onRetryPublication,
  onDismissPublicationResults,
}: StatusBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasMixedPublishStatus =
    publishStatuses.length > 0 &&
    publishStatuses.some((item) => item.publishable) &&
    publishStatuses.some((item) => !item.publishable);

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

  const handlePublishNow = () => {
    if (!canPublishNow || publishing || !onPublishNow) return;
    setMenuOpen(false);
    onPublishNow();
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

      {(publicationPublishError || (publicationResults && publicationResults.length > 0)) && (
        <div className="status-bar__publication-result" data-testid="publication-result" role="status">
          {publicationPublishError ? (
            <p className="status-bar__publication-result-error">{publicationPublishError}</p>
          ) : null}
          {publicationResults?.map((result) => (
            <div key={result.id} className="status-bar__publication-result-item">
              <span className="status-bar__publication-result-label">
                {platformLabel(result.platformId)} · {result.status}
                {result.remotePostId ? ` · #${result.remotePostId}` : ''}
              </span>
              {result.remoteUrl ? (
                <a
                  href={result.remoteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="status-bar__publication-result-link"
                  data-testid={`publication-remote-url-${result.id}`}
                >
                  Открыть пост
                </a>
              ) : null}
              {result.status === 'failed' && result.errorMessage ? (
                <span className="status-bar__publication-result-error">{result.errorMessage}</span>
              ) : null}
              {result.status === 'failed' && onRetryPublication ? (
                <button
                  type="button"
                  className="status-bar__publication-retry"
                  data-testid={`publication-retry-${result.id}`}
                  disabled={publishing}
                  onClick={() => onRetryPublication(result.id)}
                >
                  Повторить
                </button>
              ) : null}
            </div>
          ))}
          {onDismissPublicationResults ? (
            <button
              type="button"
              className="status-bar__publication-result-dismiss"
              aria-label="Скрыть результат публикации"
              onClick={onDismissPublicationResults}
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
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
                className={`status-bar__publish-item ${
                  canPublishNow ? 'status-bar__publish-item--active' : 'status-bar__publish-item--soon'
                }`}
                data-testid="publication-publish-now"
                disabled={!canPublishNow || publishing}
                title={!canPublishNow ? publishNowDisabledReason : undefined}
                onClick={handlePublishNow}
              >
                <span className="status-bar__publish-item-label">
                  {publishing ? (
                    <>
                      <Loader2 className="status-bar__icon status-bar__icon--spin" strokeWidth={2} aria-hidden />
                      Публикация…
                    </>
                  ) : (
                    'Опубликовать сейчас'
                  )}
                </span>
                {!canPublishNow && !publishing ? (
                  <span className="status-bar__soon">недоступно</span>
                ) : null}
              </button>

              {hasMixedPublishStatus ? (
                <div className="status-bar__publish-status" data-testid="publish-status-mixed">
                  <p className="status-bar__publish-status-title">Статус целей публикации</p>
                  <ul className="status-bar__publish-status-list">
                    {publishStatuses.map((item) => (
                      <li
                        key={item.label}
                        className={`status-bar__publish-status-item ${
                          item.publishable
                            ? 'status-bar__publish-status-item--ok'
                            : 'status-bar__publish-status-item--blocked'
                        }`}
                        title={item.reason}
                      >
                        <span>{item.label}</span>
                        {item.publishable ? (
                          <Check size={14} strokeWidth={2} aria-hidden />
                        ) : (
                          <X size={14} strokeWidth={2} aria-hidden />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

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
