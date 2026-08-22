import { useState } from 'react';
import { Database, Download, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@reizoko/ui';
import { useAppStore } from '../stores/app-store';
import './backup-settings.css';

export function BackupSettingsPanel() {
  const createBackup = useAppStore((s) => s.createBackup);
  const exportJson = useAppStore((s) => s.exportJsonBackup);
  const beginRestore = useAppStore((s) => s.beginRestoreBackup);
  const confirmRestore = useAppStore((s) => s.confirmRestoreBackup);
  const cancelRestore = useAppStore((s) => s.cancelRestoreBackup);
  const restoreCandidate = useAppStore((s) => s.restoreCandidate);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Не удалось выполнить операцию с резервной копией',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-panel" data-testid="backup-settings-panel">
      <h2>Данные и резервные копии</h2>
      <p className="settings-panel__desc">
        Полная резервная копия сохраняет библиотеку, версии, медиа и настройки в переносимый архив.
        JSON-экспорт содержит только данные без медиафайлов.
      </p>

      <div className="backup-settings__actions">
        <Button
          variant="primary"
          data-testid="backup-create"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await createBackup();
              setStatus(
                result.warnings.length
                  ? `Резервная копия создана с предупреждениями (${result.warnings.length})`
                  : 'Резервная копия создана',
              );
            })
          }
        >
          <Download size={16} strokeWidth={2} aria-hidden />
          Создать резервную копию
        </Button>

        <Button
          variant="secondary"
          data-testid="backup-restore-open"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await beginRestore();
            })
          }
        >
          <Upload size={16} strokeWidth={2} aria-hidden />
          Восстановить из резервной копии
        </Button>

        <Button
          variant="ghost"
          data-testid="backup-export-json"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const path = await exportJson();
              setStatus(`JSON экспортирован: ${path}`);
            })
          }
        >
          <Database size={16} strokeWidth={2} aria-hidden />
          Экспортировать JSON
        </Button>
      </div>

      {status ? <p className="backup-settings__status">{status}</p> : null}
      {error ? <p className="backup-settings__error">{error}</p> : null}

      {restoreCandidate ? (
        <div className="backup-restore-dialog" role="dialog" aria-modal="true" data-testid="backup-restore-dialog">
          <div className="backup-restore-dialog__panel">
            <h3>Резервная копия</h3>
            <p className="backup-restore-dialog__meta">
              Создана: {new Date(restoreCandidate.summary.createdAt).toLocaleString('ru-RU')}
            </p>
            <ul className="backup-restore-dialog__stats">
              <li>Публикации библиотеки: {restoreCandidate.summary.contentItems}</li>
              <li>Версии: {restoreCandidate.summary.contentRevisions}</li>
              <li>Медиафайлы: {restoreCandidate.summary.mediaItems}</li>
              <li>Аккаунты: {restoreCandidate.summary.socialAccounts}</li>
              <li>Черновики публикаций: {restoreCandidate.summary.publications}</li>
            </ul>
            {restoreCandidate.summary.warnings.length ? (
              <div className="backup-restore-dialog__warnings">
                <strong>Предупреждения:</strong>
                <ul>
                  {restoreCandidate.summary.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="backup-restore-dialog__note">
              Текущая библиотека будет заменена содержимым резервной копии. Перед восстановлением
              Reizoko автоматически создаст резервную копию текущих данных.
            </p>
            <div className="backup-restore-dialog__actions">
              <Button variant="ghost" data-testid="backup-restore-cancel" onClick={() => cancelRestore()}>
                Отмена
              </Button>
              <Button
                variant="primary"
                data-testid="backup-restore-confirm"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await confirmRestore();
                    setStatus('Библиотека восстановлена из резервной копии');
                  })
                }
              >
                <RotateCcw size={16} strokeWidth={2} aria-hidden />
                Восстановить
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
