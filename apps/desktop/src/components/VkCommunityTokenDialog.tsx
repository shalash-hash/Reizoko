import { useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { Button, IconButton } from '@reizoko/ui';
import {
  type VkCommunityTokenVerification,
  type VkCommunityTokenVerifyState,
} from '@reizoko/core';
import { AccountDialogOverlay } from './AccountDialogOverlay';
import { VkCommunityPermissionsRow } from './VkCommunityPermissionsRow';
import './account-dialog.css';

interface VkCommunityTokenDialogProps {
  open: boolean;
  loading?: boolean;
  verifyState?: VkCommunityTokenVerifyState;
  verification?: VkCommunityTokenVerification | null;
  error?: string | null;
  communityInput: string;
  accessToken: string;
  onCommunityInputChange: (value: string) => void;
  onAccessTokenChange: (value: string) => void;
  onClose: () => void;
  onVerify: (input: { communityInput: string; accessToken: string }) => void | Promise<void>;
  onConnect?: () => void | Promise<void>;
}

export function VkCommunityTokenDialog({
  open,
  loading = false,
  verifyState = 'idle',
  verification = null,
  error = null,
  communityInput,
  accessToken,
  onCommunityInputChange,
  onAccessTokenChange,
  onClose,
  onVerify,
  onConnect,
}: VkCommunityTokenDialogProps) {
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowToken(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading && verifyState !== 'checking') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, verifyState, onClose]);

  if (!open) return null;

  const checking = verifyState === 'checking' || loading;
  const canConnect = verifyState === 'valid' && verification && !checking;

  const handleVerify = () => {
    if (checking || !communityInput.trim() || !accessToken.trim()) return;
    void onVerify({ communityInput: communityInput.trim(), accessToken });
  };

  return (
    <AccountDialogOverlay onClose={onClose} disabled={checking}>
      <div
        className="account-dialog account-dialog--wide"
        data-testid="vk-community-token-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Подключить сообщество ВКонтакте"
      >
        <header className="account-dialog__header">
          <div>
            <h3>Подключить сообщество ВКонтакте</h3>
            <p className="account-dialog__intro">
              Используйте ключ из «Работа с API» конкретного сообщества.
            </p>
          </div>
          <IconButton label="Закрыть" size="sm" disabled={checking} onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </IconButton>
        </header>

        <div className="account-dialog__body">
          <label className="account-dialog__field">
            <span>Ссылка, короткое имя или ID сообщества</span>
            <input
              value={communityInput}
              placeholder="https://vk.com/alephmap"
              disabled={checking}
              onChange={(event) => onCommunityInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleVerify();
              }}
            />
          </label>

          <label className="account-dialog__field">
            <span>Ключ доступа сообщества</span>
            <div className="vk-community-token__token-row">
              <input
                type={showToken ? 'text' : 'password'}
                value={accessToken}
                placeholder="Вставьте ключ доступа"
                disabled={checking}
                autoComplete="off"
                onChange={(event) => onAccessTokenChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleVerify();
                }}
              />
              <IconButton
                label={showToken ? 'Скрыть ключ' : 'Показать ключ'}
                size="sm"
                disabled={checking}
                onClick={() => setShowToken((current) => !current)}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </IconButton>
            </div>
          </label>

          <p className="account-dialog__note">
            Ключ создаётся в: Сообщество → Управление → Работа с API → Ключи доступа
          </p>

          <details className="vk-community-token__hint">
            <summary>Где взять ключ?</summary>
            <p>
              Откройте нужное сообщество ВКонтакте: Управление → Работа с API → Ключи доступа →
              Создать ключ. Для текстовых публикаций требуется доступ к стене.
            </p>
          </details>

          {checking ? (
            <p className="account-dialog__note" data-testid="vk-community-token-checking">
              Проверяем ключ…
            </p>
          ) : null}

          {error ? (
            <p className="account-dialog__error" data-testid="vk-community-token-error">
              {error}
            </p>
          ) : null}

          {verification && verifyState === 'valid' ? (
            <div className="vk-community-token__result" data-testid="vk-community-token-success">
              <p className="account-dialog__note">✓ {verification.displayName}</p>
              <p className="account-dialog__note">
                Сообщество ВКонтакте
                {verification.screenName ? ` · vk.com/${verification.screenName}` : ''}
              </p>

              <VkCommunityPermissionsRow permissions={verification.permissions} />
            </div>
          ) : null}
        </div>

        <footer className="account-dialog__footer">
          <Button variant="ghost" disabled={checking} onClick={onClose}>
            Отмена
          </Button>
          {canConnect ? (
            <Button
              variant="primary"
              data-testid="vk-community-token-connect"
              disabled={checking}
              onClick={() => void onConnect?.()}
            >
              Подключить сообщество
            </Button>
          ) : (
            <Button
              variant="primary"
              data-testid="vk-community-token-verify"
              disabled={checking || !communityInput.trim() || !accessToken.trim()}
              onClick={handleVerify}
            >
              {checking ? 'Проверяем…' : 'Проверить'}
            </Button>
          )}
        </footer>
      </div>
    </AccountDialogOverlay>
  );
}
