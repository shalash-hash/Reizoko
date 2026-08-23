import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { normalizeTelegramDestinationInput, TelegramDestinationInputError } from '@reizoko/core';
import { Button, IconButton } from '@reizoko/ui';
import { AccountDialogOverlay } from './AccountDialogOverlay';
import './account-dialog.css';

interface TelegramDestinationDialogProps {
  open: boolean;
  connectionLabel: string;
  onClose: () => void;
  onSubmit: (chatRef: string) => void | Promise<void>;
  onReconnect?: () => void;
  loading?: boolean;
  error?: string | null;
  permissionError?: string | null;
  missingSecret?: boolean;
}

export function TelegramDestinationDialog({
  open,
  connectionLabel,
  onClose,
  onSubmit,
  onReconnect,
  loading = false,
  error = null,
  permissionError = null,
  missingSecret = false,
}: TelegramDestinationDialogProps) {
  const [chatRef, setChatRef] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChatRef('');
    setValidationError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleSubmit = () => {
    if (loading) return;
    setValidationError(null);
    try {
      const normalized = normalizeTelegramDestinationInput(chatRef);
      void onSubmit(normalized.apiChatId);
    } catch (submitError) {
      if (submitError instanceof TelegramDestinationInputError) {
        setValidationError(submitError.message);
        return;
      }
      setValidationError('Не удалось распознать канал или чат.');
    }
  };

  return (
    <AccountDialogOverlay onClose={onClose} disabled={loading}>
      <div
        className="account-dialog"
        data-testid="telegram-destination-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Добавить канал или чат"
      >
        <header className="account-dialog__header">
          <h3>Добавить канал или чат</h3>
          <IconButton label="Закрыть" size="sm" disabled={loading} onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </IconButton>
        </header>

        <div className="account-dialog__body">
          <p className="account-dialog__note">
            Укажите канал или чат. Можно вставить ссылку Telegram, например{' '}
            <code>t.me/my_channel</code>, имя <code>@my_channel</code> или числовой ID. Бот{' '}
            <strong>{connectionLabel}</strong> должен быть администратором с правом публикации сообщений.
          </p>

          <label className="account-dialog__field">
            <span>Канал или чат</span>
            <input
              type="text"
              value={chatRef}
              placeholder="t.me/my_channel"
              data-testid="telegram-chat-ref-input"
              disabled={loading}
              onChange={(event) => {
                setChatRef(event.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmit();
              }}
            />
          </label>

          {validationError ? (
            <p className="account-dialog__error" data-testid="telegram-destination-validation-error">
              {validationError}
            </p>
          ) : null}

          {missingSecret ? (
            <div className="account-dialog__reconnect" data-testid="telegram-destination-missing-secret">
              <p className="account-dialog__error">
                Подключение Telegram требует повторного входа.
              </p>
              <p className="account-dialog__note">
                Сохранённый ключ бота не найден в защищённом хранилище Windows. Подключите бота заново.
              </p>
            </div>
          ) : null}

          {permissionError ? (
            <p className="account-dialog__error" data-testid="telegram-destination-permission-error">
              {permissionError}
            </p>
          ) : null}

          {error ? (
            <p className="account-dialog__error" data-testid="telegram-destination-error">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="account-dialog__footer">
          <Button variant="ghost" data-testid="telegram-destination-cancel" disabled={loading} onClick={onClose}>
            Отмена
          </Button>
          {missingSecret && onReconnect ? (
            <Button
              variant="primary"
              data-testid="telegram-destination-reconnect"
              disabled={loading}
              onClick={onReconnect}
            >
              Подключить снова
            </Button>
          ) : (
            <Button
              variant="primary"
              data-testid="telegram-destination-submit"
              disabled={loading || !chatRef.trim()}
              onClick={handleSubmit}
            >
              {loading ? 'Проверка…' : 'Проверить и добавить'}
            </Button>
          )}
        </footer>
      </div>
    </AccountDialogOverlay>
  );
}
