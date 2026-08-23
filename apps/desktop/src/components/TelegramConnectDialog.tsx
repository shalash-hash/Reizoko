import { useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { Button, IconButton } from '@reizoko/ui';
import { AccountDialogOverlay } from './AccountDialogOverlay';
import './account-dialog.css';

interface TelegramConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (token: string) => void | Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function TelegramConnectDialog({
  open,
  onClose,
  onSubmit,
  loading = false,
  error = null,
}: TelegramConnectDialogProps) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToken('');
    setShowToken(false);
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
    const trimmed = token.trim();
    if (!trimmed || loading) return;
    void onSubmit(trimmed);
  };

  return (
    <AccountDialogOverlay onClose={onClose} disabled={loading}>
      <div
        className="account-dialog"
        data-testid="telegram-connect-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Подключить Telegram-бота"
      >
        <header className="account-dialog__header">
          <h3>Подключить Telegram-бота</h3>
          <IconButton label="Закрыть" size="sm" disabled={loading} onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </IconButton>
        </header>

        <div className="account-dialog__body">
          <p className="account-dialog__note">
            Создайте бота через{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">
              @BotFather
            </a>{' '}
            и вставьте выданный токен. Токен хранится локально в защищённом хранилище системы.
          </p>

          <label className="account-dialog__field">
            <span>Токен бота</span>
            <div className="account-dialog__password-wrap">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                autoComplete="off"
                spellCheck={false}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                data-testid="telegram-token-input"
                disabled={loading}
                onChange={(event) => setToken(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSubmit();
                }}
              />
              <IconButton
                label={showToken ? 'Скрыть токен' : 'Показать токен'}
                size="sm"
                data-testid="telegram-token-toggle"
                disabled={loading}
                onClick={() => setShowToken((value) => !value)}
              >
                {showToken ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
              </IconButton>
            </div>
          </label>

          {error ? (
            <p className="account-dialog__error" data-testid="telegram-connect-error">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="account-dialog__footer">
          <Button variant="ghost" data-testid="telegram-connect-cancel" disabled={loading} onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            data-testid="telegram-connect-submit"
            disabled={loading || !token.trim()}
            onClick={handleSubmit}
          >
            {loading ? 'Проверка…' : 'Проверить и подключить'}
          </Button>
        </footer>
      </div>
    </AccountDialogOverlay>
  );
}
