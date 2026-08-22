import { useEffect, useState } from 'react';
import type { PlatformAdapter } from '@reizoko/platform-sdk';
import type { CreateSocialAccountInput, SocialAccount } from '@reizoko/shared';
import { Button, IconButton } from '@reizoko/ui';
import { X } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { PlatformSelect } from './PlatformSelect';
import './account-dialog.css';

interface AccountDialogProps {
  platforms: PlatformAdapter[];
  initialPlatformId?: string;
  account?: SocialAccount | null;
  onClose: () => void;
  onSubmit: (input: CreateSocialAccountInput) => Promise<void>;
}

export function AccountDialog({
  platforms,
  initialPlatformId,
  account,
  onClose,
  onSubmit,
}: AccountDialogProps) {
  const [platformId, setPlatformId] = useState(account?.platformId ?? initialPlatformId ?? platforms[0]?.id ?? '');
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [handle, setHandle] = useState(account?.handle ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const selectedPlatform = platforms.find((platform) => platform.id === platformId);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        platformId,
        displayName,
        handle: handle.trim() || null,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить профиль');
      setSubmitting(false);
    }
  };

  return (
    <div className="account-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="account-dialog"
        data-testid="account-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={account ? 'Изменить профиль' : 'Добавить профиль'}
      >
        <header className="account-dialog__header">
          <h3>{account ? 'Изменить профиль' : 'Добавить профиль'}</h3>
          <IconButton label="Закрыть" size="sm" onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </IconButton>
        </header>

        <div className="account-dialog__body">
          <label className="account-dialog__field">
            <span>Площадка</span>
            <PlatformSelect
              platforms={platforms}
              value={platformId}
              disabled={Boolean(account)}
              onChange={setPlatformId}
            />
          </label>

          {selectedPlatform && !selectedPlatform.available ? (
            <p className="account-dialog__note">Предпросмотр пока недоступен для этой площадки.</p>
          ) : null}

          <label className="account-dialog__field">
            <span>Название</span>
            <input
              type="text"
              value={displayName}
              data-testid="account-display-name"
              placeholder="Компания"
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <label className="account-dialog__field">
            <span>Handle / username</span>
            <input
              type="text"
              value={handle}
              data-testid="account-handle"
              placeholder="@reizoko"
              onChange={(event) => setHandle(event.target.value)}
            />
          </label>

          {selectedPlatform ? (
            <div className="account-dialog__preview">
              <PlatformIcon platformId={selectedPlatform.id} size={18} />
              <span>{selectedPlatform.name}</span>
            </div>
          ) : null}

          {error ? <p className="account-dialog__error">{error}</p> : null}
        </div>

        <footer className="account-dialog__footer">
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            data-testid="account-save"
            disabled={submitting}
            onClick={() => void handleSave()}
          >
            {account ? 'Сохранить' : 'Добавить'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
