import { useEffect, useMemo, useState } from 'react';
import type { PlatformAdapter } from '@reizoko/platform-sdk';
import type { CreateSocialAccountInput, SocialAccount } from '@reizoko/shared';
import {
  getPlatformDisplayName,
  getPlatformProfileFormConfig,
  normalizePlatformIdentifier,
  PROFILE_DIALOG_INTRO,
  PROFILE_DISPLAY_NAME_HELP,
  PROFILE_DISPLAY_NAME_LABEL,
  PROFILE_DISPLAY_NAME_PLACEHOLDER,
} from '@reizoko/core';
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
  onConnectTelegram?: () => void;
}

export function AccountDialog({
  platforms,
  initialPlatformId,
  account,
  onClose,
  onSubmit,
  onConnectTelegram,
}: AccountDialogProps) {
  const isEditing = Boolean(account?.id);
  const [platformId, setPlatformId] = useState(account?.platformId ?? initialPlatformId ?? platforms[0]?.id ?? '');
  const [displayName, setDisplayName] = useState(account?.displayName ?? '');
  const [handle, setHandle] = useState(account?.handle ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlatform = platforms.find((platform) => platform.id === platformId);
  const formConfig = useMemo(() => getPlatformProfileFormConfig(platformId), [platformId]);
  const platformLabel = getPlatformDisplayName(platformId, selectedPlatform?.name);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        platformId,
        displayName,
        handle: normalizePlatformIdentifier(platformId, handle),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось сохранить профиль');
      setSubmitting(false);
    }
  };

  const handleConnectTelegram = () => {
    onConnectTelegram?.();
    onClose();
  };

  const dialogTitle = isEditing ? 'Изменить профиль площадки' : 'Добавить профиль площадки';
  const showTelegramConnect =
    !isEditing && formConfig.connectionCapability === 'telegram_bot' && Boolean(onConnectTelegram);

  return (
    <div className="account-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="account-dialog"
        data-testid="account-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={dialogTitle}
      >
        <header className="account-dialog__header">
          <div>
            <h3>{dialogTitle}</h3>
            {!isEditing ? <p className="account-dialog__intro">{PROFILE_DIALOG_INTRO}</p> : null}
          </div>
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
              disabled={isEditing}
              onChange={setPlatformId}
            />
          </label>

          {selectedPlatform ? (
            <div className="account-dialog__platform-summary" data-testid="account-platform-summary">
              <div className="account-dialog__platform-summary-main">
                <PlatformIcon platformId={selectedPlatform.id} size={20} muted={!selectedPlatform.available} />
                <span className="account-dialog__platform-summary-name">{platformLabel}</span>
              </div>
              <span className="account-dialog__platform-summary-status">{formConfig.localProfileStatusTitle}</span>
            </div>
          ) : null}

          {showTelegramConnect ? (
            <section className="account-dialog__connect-card" data-testid="account-telegram-connect-card">
              <p className="account-dialog__connect-card-text">{formConfig.realConnectionHint}</p>
              <Button
                variant="primary"
                data-testid="account-telegram-connect"
                onClick={handleConnectTelegram}
              >
                {formConfig.realConnectionActionLabel}
              </Button>
            </section>
          ) : null}

          {showTelegramConnect ? (
            <div className="account-dialog__section-divider" aria-hidden>
              <span>или создайте локальный профиль</span>
            </div>
          ) : null}

          <label className="account-dialog__field">
            <span>{PROFILE_DISPLAY_NAME_LABEL}</span>
            <input
              type="text"
              value={displayName}
              data-testid="account-display-name"
              placeholder={PROFILE_DISPLAY_NAME_PLACEHOLDER}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <span className="account-dialog__field-help">{PROFILE_DISPLAY_NAME_HELP}</span>
          </label>

          <label className="account-dialog__field">
            <span>{formConfig.identifierLabel}</span>
            <input
              type="text"
              value={handle}
              data-testid="account-identifier"
              placeholder={formConfig.identifierPlaceholder}
              onChange={(event) => setHandle(event.target.value)}
            />
            <span className="account-dialog__field-help">{formConfig.identifierHelp}</span>
          </label>

          {selectedPlatform ? (
            <aside className="account-dialog__status-block" data-testid="account-local-profile-status">
              <strong>{formConfig.localProfileStatusTitle}</strong>
              <p>{formConfig.localProfileStatusBody}</p>
              {selectedPlatform && !selectedPlatform.available ? (
                <p className="account-dialog__status-note">Предпросмотр для этой площадки пока недоступен.</p>
              ) : null}
            </aside>
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
            {isEditing ? 'Сохранить профиль' : 'Добавить профиль'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
