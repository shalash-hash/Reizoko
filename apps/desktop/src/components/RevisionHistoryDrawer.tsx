import { useEffect, useMemo, useState } from 'react';
import { History, X } from 'lucide-react';
import type { ContentRevision } from '@reizoko/shared';
import { getRevisionOriginLabel } from '@reizoko/core';
import { BlockEditor } from '@reizoko/editor';
import { Button, EmptyState, IconButton } from '@reizoko/ui';
import { useAppStore } from '../stores/app-store';
import { getMediaUrl } from '../services/media-service';
import './revision-history-drawer.css';

function formatRevisionTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRevisionRelative(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 60_000) return 'Изменено только что';
  if (diffMs < 3_600_000) return `Изменено ${Math.max(1, Math.round(diffMs / 60_000))} мин назад`;
  return `Изменено ${new Date(isoDate).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function RevisionHistoryDrawer() {
  const content = useAppStore((s) => s.content);
  const mediaPaths = useAppStore((s) => s.mediaPaths);
  const groupedHistory = useAppStore((s) => s.groupedHistory);
  const selectedRevisionId = useAppStore((s) => s.selectedRevisionId);
  const restoreCandidateId = useAppStore((s) => s.restoreCandidateId);
  const closeRevisionHistory = useAppStore((s) => s.closeRevisionHistory);
  const selectRevisionPreview = useAppStore((s) => s.selectRevisionPreview);
  const createRevisionCheckpoint = useAppStore((s) => s.createRevisionCheckpoint);
  const requestRestoreRevision = useAppStore((s) => s.requestRestoreRevision);
  const confirmRestoreRevision = useAppStore((s) => s.confirmRestoreRevision);
  const cancelRestoreRevision = useAppStore((s) => s.cancelRestoreRevision);
  const loadRevisionHistory = useAppStore((s) => s.loadRevisionHistory);

  const [previewRevision, setPreviewRevision] = useState<ContentRevision | null>(null);

  useEffect(() => {
    void loadRevisionHistory();
  }, [loadRevisionHistory, content?.currentRevisionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (restoreCandidateId) {
          cancelRestoreRevision();
          return;
        }
        closeRevisionHistory();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [restoreCandidateId, cancelRestoreRevision, closeRevisionHistory]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!selectedRevisionId || !content) {
        setPreviewRevision(null);
        return;
      }
      if (selectedRevisionId === content.currentRevisionId) {
        setPreviewRevision(content.revision);
        return;
      }

      setPreviewRevision(null);
      const revision = await useAppStore.getState().fetchRevision(selectedRevisionId);
      if (cancelled || useAppStore.getState().selectedRevisionId !== selectedRevisionId) {
        return;
      }
      setPreviewRevision(revision);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRevisionId, content]);

  const totalHistorical = useMemo(
    () => groupedHistory.reduce((count, group) => count + group.revisions.length, 0),
    [groupedHistory],
  );

  if (!content) return null;

  const isCurrentSelected = selectedRevisionId === content.currentRevisionId;

  return (
    <aside className="revision-history-drawer" data-testid="revision-history-drawer" aria-label="История версий">
      <header className="revision-history-drawer__header">
        <div className="revision-history-drawer__title-row">
          <History size={18} strokeWidth={1.75} aria-hidden />
          <h2>История версий</h2>
        </div>
        <IconButton label="Закрыть историю" size="sm" data-testid="revision-history-close" onClick={() => closeRevisionHistory()}>
          <X size={18} strokeWidth={2} />
        </IconButton>
      </header>

      <div className="revision-history-drawer__actions">
        <Button
          variant="secondary"
          size="sm"
          data-testid="revision-create-checkpoint"
          onClick={() => void createRevisionCheckpoint()}
        >
          Создать версию
        </Button>
      </div>

      <div className="revision-history-drawer__body">
        <div className="revision-history-drawer__list" data-testid="revision-history-list">
          {totalHistorical <= 1 ? (
            <EmptyState
              title="История пока пуста"
              description="Reizoko будет сохранять предыдущие версии публикации по мере редактирования."
            />
          ) : null}

          {groupedHistory.map((group) => (
            <section key={group.group} className="revision-history-group">
              <h3>{group.label}</h3>
              <ul>
                {group.revisions.map((revision) => {
                  const isCurrent = revision.id === content.currentRevisionId;
                  const selected = revision.id === selectedRevisionId;
                  return (
                    <li key={revision.id}>
                      <button
                        type="button"
                        className={`revision-history-item ${selected ? 'revision-history-item--selected' : ''}`}
                        data-testid={`revision-item-${revision.version}`}
                        onClick={() => selectRevisionPreview(revision.id)}
                      >
                        <span className="revision-history-item__marker" aria-hidden />
                        <span className="revision-history-item__main">
                          <strong>{isCurrent ? 'Текущая версия' : `Версия ${revision.version}`}</strong>
                          <span>{formatRevisionTime(revision.createdAt)}</span>
                          <span>
                            {isCurrent
                              ? formatRevisionRelative(revision.updatedAt)
                              : getRevisionOriginLabel(revision)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="revision-history-drawer__preview" data-testid="revision-history-preview">
          <h3>Просмотр версии</h3>
          {previewRevision ? (
            <div className="revision-history-drawer__preview-canvas">
              <BlockEditor
                blocks={previewRevision.blocks}
                title={previewRevision.metadata.title}
                onChange={() => undefined}
                onTitleChange={() => undefined}
                onAddImage={() => undefined}
                getMediaUrl={(mediaId) => getMediaUrl(mediaId, mediaPaths[mediaId])}
                readOnly
              />
            </div>
          ) : (
            <p className="revision-history-drawer__preview-empty">Выберите версию для просмотра</p>
          )}

          {!isCurrentSelected && selectedRevisionId ? (
            <Button
              variant="primary"
              data-testid="revision-restore"
              onClick={() => requestRestoreRevision(selectedRevisionId)}
            >
              Восстановить эту версию
            </Button>
          ) : null}
        </div>
      </div>

      {restoreCandidateId ? (
        <div className="revision-restore-dialog" role="dialog" aria-modal="true" aria-label="Подтверждение восстановления">
          <div className="revision-restore-dialog__panel">
            <h3>Восстановить версию?</h3>
            <p>
              Текущая версия не будет потеряна. Перед восстановлением Reizoko сохранит текущее состояние в
              истории, а выбранная версия станет новой текущей версией.
            </p>
            <div className="revision-restore-dialog__actions">
              <Button variant="ghost" data-testid="revision-restore-cancel" onClick={() => cancelRestoreRevision()}>
                Отмена
              </Button>
              <Button variant="primary" data-testid="revision-restore-confirm" onClick={() => void confirmRestoreRevision()}>
                Восстановить
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
