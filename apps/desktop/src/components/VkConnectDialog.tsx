import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from '@reizoko/ui';
import {
  isVkIntegrationComplete,
  isVkIntegrationInitialSetup,
  toUserFacingVkError,
  type VkIntegrationFormState,
} from '@reizoko/core';
import { useAppStore } from '../stores/app-store';
import {
  VkIntegrationSetup,
  type VkIntegrationSetupHandle,
} from './VkIntegrationSetup';
import { AccountDialogOverlay } from './AccountDialogOverlay';
import './account-dialog.css';
import './vk-integration-settings.css';

type ConnectPhase = 'loading' | 'ready' | 'setup' | 'configured';

interface VkConnectDialogProps {
  open: boolean;
  reconnectConnectionId?: string | null;
  onClose: () => void;
  onOAuthSuccess: (connectionId: string) => void | Promise<void>;
}

export function VkConnectDialog({
  open,
  reconnectConnectionId = null,
  onClose,
  onOAuthSuccess,
}: VkConnectDialogProps) {
  const connectVkOAuth = useAppStore((s) => s.connectVkOAuth);
  const loadVkIntegrationFormState = useAppStore((s) => s.loadVkIntegrationFormState);

  const setupRef = useRef<VkIntegrationSetupHandle>(null);
  const [phase, setPhase] = useState<ConnectPhase>('loading');
  const [formState, setFormState] = useState<VkIntegrationFormState | null>(null);
  const [showAllSettings, setShowAllSettings] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [canSaveDraft, setCanSaveDraft] = useState(false);

  const resetState = useCallback(async () => {
    setPhase('loading');
    setShowAllSettings(false);
    setShowAdvancedSettings(false);
    setOauthError(null);
    setSaveLoading(false);
    setOauthLoading(false);
    setCanSaveDraft(false);
    try {
      const loaded = await loadVkIntegrationFormState();
      setFormState(loaded);
      setPhase(isVkIntegrationComplete(loaded) ? 'ready' : 'setup');
    } catch {
      setFormState(null);
      setPhase('setup');
    }
  }, [loadVkIntegrationFormState]);

  useEffect(() => {
    if (!open) return;
    void resetState();
  }, [open, resetState]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !oauthLoading && !saveLoading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, oauthLoading, saveLoading, onClose]);

  const handleOAuth = async () => {
    setOauthLoading(true);
    setOauthError(null);
    try {
      const connectionId = await connectVkOAuth(reconnectConnectionId);
      if (connectionId) {
        await onOAuthSuccess(connectionId);
      }
    } catch (error) {
      setOauthError(toUserFacingVkError(error));
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSaveAndContinue = async () => {
    if (!setupRef.current) return;
    setSaveLoading(true);
    setOauthError(null);
    try {
      const result = await setupRef.current.saveAndVerify();
      if (result.ok) {
        const loaded = await loadVkIntegrationFormState();
        setFormState(loaded);
        setPhase('configured');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  if (!open) return null;

  const busy = oauthLoading || saveLoading;
  const showSetupForm = phase === 'setup' || showAdvancedSettings;
  const initialSetup = formState ? isVkIntegrationInitialSetup(formState) : true;
  const dialogClassName = showSetupForm
    ? 'account-dialog account-dialog--vk-setup'
    : 'account-dialog';

  return (
    <AccountDialogOverlay onClose={onClose} disabled={busy}>
      <div
        className={dialogClassName}
        data-testid="vk-connect-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Подключить ВКонтакте"
      >
        <header className="account-dialog__header">
          <h3>Подключить ВКонтакте</h3>
          <IconButton label="Закрыть" size="sm" disabled={busy} onClick={onClose}>
            <X size={18} strokeWidth={2} />
          </IconButton>
        </header>

        <div className="account-dialog__body account-dialog__body--scrollable">
          {phase === 'loading' ? (
            <p className="account-dialog__note">Загрузка…</p>
          ) : null}

          {phase === 'ready' && !showAdvancedSettings ? (
            <>
              <p className="account-dialog__note">
                Авторизация откроется в системном браузере. После входа и разрешения доступа
                вернитесь в Reizoko — подключение продолжится автоматически. Затем вы сможете
                выбрать, куда публиковать: личную страницу, сообщества или другую доступную стену.
              </p>
              <button
                type="button"
                className="vk-settings__link"
                data-testid="vk-connect-open-settings"
                disabled={busy}
                onClick={() => setShowAdvancedSettings(true)}
              >
                Настройки подключения
              </button>
            </>
          ) : null}

          {phase === 'configured' ? (
            <>
              <p className="vk-settings__status vk-settings__status--ok" data-testid="vk-connect-configured">
                ✓ Интеграция ВКонтакте настроена
              </p>
              <p className="account-dialog__note">
                Теперь можно войти в VK и выбрать, куда Reizoko сможет публиковать.
              </p>
            </>
          ) : null}

          {showSetupForm ? (
            <>
              {initialSetup && !showAdvancedSettings ? (
                <p className="account-dialog__note">
                  Для первого подключения нужно один раз настроить приложение VK ID. Это потребуется
                  сделать только один раз.
                </p>
              ) : null}
              <VkIntegrationSetup
                ref={setupRef}
                presentation="inline"
                showAllFields={showAllSettings || showAdvancedSettings}
                disabled={busy}
                onShowAllFieldsChange={setShowAllSettings}
                onCanSaveChange={setCanSaveDraft}
              />
              <p className="vk-settings__hint">
                После сохранения эти данные будут использоваться для следующих подключений
                ВКонтакте.
              </p>
            </>
          ) : null}

          {oauthError ? (
            <p className="account-dialog__error" data-testid="vk-connect-error">
              {oauthError}
            </p>
          ) : null}
        </div>

        <footer className="account-dialog__footer">
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Отмена
          </Button>

          {phase === 'setup' ? (
            <Button
              variant="primary"
              data-testid="vk-connect-save-continue"
              disabled={busy || !canSaveDraft}
              onClick={() => void handleSaveAndContinue()}
            >
              {saveLoading ? 'Сохранение…' : 'Сохранить и продолжить'}
            </Button>
          ) : (
            <Button
              variant="primary"
              data-testid="vk-connect-submit"
              disabled={busy || phase === 'loading'}
              onClick={() => void handleOAuth()}
            >
              {oauthLoading ? 'Ожидание авторизации…' : 'Войти через ВКонтакте'}
            </Button>
          )}
        </footer>
      </div>
    </AccountDialogOverlay>
  );
}
