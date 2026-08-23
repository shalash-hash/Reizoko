import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button, IconButton } from '@reizoko/ui';
import { VK_CANONICAL_REDIRECT_URI, VK_DEFAULT_SERVER_BASE_URL } from '@reizoko/shared';
import {
  getVkIntegrationMissingFields,
  isVkIntegrationInitialSetup,
  type VkIntegrationDraft,
  type VkIntegrationFormState,
  type VkIntegrationMissingField,
  type VkIntegrationVerificationResult,
  type VkServerProbeStep,
} from '@reizoko/core';
import { useAppStore } from '../stores/app-store';
import { VkServerProbeTrace } from './VkServerProbeTrace';
import './vk-integration-settings.css';

export type VkIntegrationSetupPresentation = 'settings' | 'inline';

export interface VkIntegrationSetupHandle {
  saveAndVerify: () => Promise<VkIntegrationVerificationResult>;
  verify: () => Promise<VkIntegrationVerificationResult>;
  canSave: () => boolean;
  reload: () => Promise<void>;
}

export interface VkIntegrationSetupProps {
  presentation: VkIntegrationSetupPresentation;
  showAllFields?: boolean;
  onShowAllFieldsChange?: (show: boolean) => void;
  disabled?: boolean;
  onCanSaveChange?: (canSave: boolean) => void;
  onStatusChange?: (status: {
    verifyState: 'idle' | 'verifying' | 'success' | 'error';
    message: string | null;
    details: string[];
  }) => void;
}

const FIELD_LABELS: Record<VkIntegrationMissingField, string> = {
  appId: 'ID приложения VK',
  clientSecret: 'Защищённый ключ',
  serviceToken: 'Сервисный ключ доступа',
};

function shouldShowField(
  field: 'appId' | 'clientSecret' | 'serviceToken' | 'server' | 'redirect',
  options: {
    presentation: VkIntegrationSetupPresentation;
    showAllFields: boolean;
    missingFields: VkIntegrationMissingField[];
    initialSetup: boolean;
  },
): boolean {
  if (options.presentation === 'settings' || options.showAllFields) return true;
  if (field === 'server' || field === 'redirect') return options.initialSetup;
  if (field === 'appId') return options.missingFields.includes('appId');
  if (field === 'clientSecret') return options.missingFields.includes('clientSecret');
  if (field === 'serviceToken') return options.missingFields.includes('serviceToken');
  return false;
}

function StoredSecretField({
  label,
  hasValue,
  editing,
  value,
  placeholder,
  disabled,
  testId,
  onStartEdit,
  onChange,
}: {
  label: string;
  hasValue: boolean;
  editing: boolean;
  value: string;
  placeholder: string;
  disabled?: boolean;
  testId: string;
  onStartEdit: () => void;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  if (hasValue && !editing) {
    return (
      <label className="vk-settings__field">
        <span>{label}</span>
        <div className="vk-settings__stored-secret">
          <input value="••••••••••••••••••" readOnly disabled data-testid={`${testId}-masked`} />
          <Button variant="ghost" size="sm" disabled={disabled} onClick={onStartEdit}>
            Изменить
          </Button>
        </div>
      </label>
    );
  }

  return (
    <label className="vk-settings__field">
      <span>{label}</span>
      <div className="vk-settings__password-wrap">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          data-testid={testId}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <IconButton
          label={visible ? 'Скрыть значение' : 'Показать значение'}
          size="sm"
          disabled={disabled}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
        </IconButton>
      </div>
    </label>
  );
}

export const VkIntegrationSetup = forwardRef<VkIntegrationSetupHandle, VkIntegrationSetupProps>(
  function VkIntegrationSetup(
    {
      presentation,
      showAllFields = false,
      onShowAllFieldsChange,
      disabled = false,
      onCanSaveChange,
      onStatusChange,
    },
    ref,
  ) {
    const loadVkIntegrationFormState = useAppStore((s) => s.loadVkIntegrationFormState);
    const saveVkIntegrationDraft = useAppStore((s) => s.saveVkIntegrationDraft);
    const verifyVkIntegrationDraft = useAppStore((s) => s.verifyVkIntegrationDraft);

    const [formState, setFormState] = useState<VkIntegrationFormState | null>(null);
    const [loading, setLoading] = useState(true);
    const [appId, setAppId] = useState('');
    const [serverBaseUrl, setServerBaseUrl] = useState(VK_DEFAULT_SERVER_BASE_URL);
    const [clientSecretDraft, setClientSecretDraft] = useState('');
    const [serviceTokenDraft, setServiceTokenDraft] = useState('');
    const [editingClientSecret, setEditingClientSecret] = useState(false);
    const [editingServiceToken, setEditingServiceToken] = useState(false);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [details, setDetails] = useState<string[]>([]);
    const [probeTrace, setProbeTrace] = useState<VkServerProbeStep[]>([]);
    const [copied, setCopied] = useState(false);

    const reload = useCallback(async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const loaded = await loadVkIntegrationFormState();
        setFormState(loaded);
        setAppId(loaded.appId);
        setServerBaseUrl(loaded.serverBaseUrl);
        setClientSecretDraft('');
        setServiceTokenDraft('');
        setEditingClientSecret(false);
        setEditingServiceToken(false);
      } catch (loadError) {
        setErrorMessage(
          loadError instanceof Error ? loadError.message : 'Не удалось загрузить настройки VK',
        );
      } finally {
        setLoading(false);
      }
    }, [loadVkIntegrationFormState]);

    useEffect(() => {
      void reload();
    }, [reload]);

    const missingFields = useMemo(
      () => (formState ? getVkIntegrationMissingFields(formState) : []),
      [formState],
    );

    const initialSetup = formState ? isVkIntegrationInitialSetup(formState) : true;

    const buildDraft = useCallback((): VkIntegrationDraft => {
      const draft: VkIntegrationDraft = {
        appId,
        serverBaseUrl,
      };
      if (clientSecretDraft.trim()) {
        draft.clientSecret = clientSecretDraft.trim();
      }
      if (serviceTokenDraft.trim()) {
        draft.serviceToken = serviceTokenDraft.trim();
      }
      return draft;
    }, [appId, clientSecretDraft, serverBaseUrl, serviceTokenDraft]);

    const canSave = useCallback(() => {
      if (!formState) return false;
      const draft = buildDraft();
      const effectiveMissing = getVkIntegrationMissingFields({
        ...formState,
        appId: draft.appId.trim() || formState.appId,
        hasClientSecret: formState.hasClientSecret || Boolean(draft.clientSecret?.trim()),
        hasServiceToken: formState.hasServiceToken || Boolean(draft.serviceToken?.trim()),
      });
      return effectiveMissing.length === 0;
    }, [buildDraft, formState]);

    useEffect(() => {
      onCanSaveChange?.(canSave());
    }, [canSave, onCanSaveChange, appId, clientSecretDraft, serviceTokenDraft, formState]);

    const publishStatus = useCallback(
      (verifyState: 'idle' | 'verifying' | 'success' | 'error', message: string | null, nextDetails: string[]) => {
        onStatusChange?.({ verifyState, message, details: nextDetails });
      },
      [onStatusChange],
    );

    const verify = useCallback(async (): Promise<VkIntegrationVerificationResult> => {
      setVerifying(true);
      setStatusMessage(null);
      setErrorMessage(null);
      setDetails([]);
      setProbeTrace([]);
      publishStatus('verifying', 'Проверяем настройки…', []);
      try {
        const draft = buildDraft();
        await saveVkIntegrationDraft(draft);
        const result = await verifyVkIntegrationDraft(draft);
        setProbeTrace(result.trace ?? []);
        if (result.ok) {
          setStatusMessage(result.message);
          setDetails(result.details ?? []);
          publishStatus('success', result.message, result.details ?? []);
          await reload();
        } else {
          setErrorMessage(result.message);
          setDetails(result.details ?? []);
          publishStatus('error', result.message, result.details ?? []);
        }
        return result;
      } catch (verifyError) {
        const message =
          verifyError instanceof Error ? verifyError.message : 'Не удалось проверить настройки';
        setErrorMessage(message);
        publishStatus('error', message, []);
        return { ok: false, message };
      } finally {
        setVerifying(false);
      }
    }, [buildDraft, publishStatus, reload, saveVkIntegrationDraft, verifyVkIntegrationDraft]);

    const save = useCallback(async () => {
      setSaving(true);
      setStatusMessage(null);
      setErrorMessage(null);
      setDetails([]);
      try {
        await saveVkIntegrationDraft(buildDraft());
        setStatusMessage('Настройки сохранены');
        await reload();
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : 'Не удалось сохранить настройки';
        setErrorMessage(message);
        publishStatus('error', message, []);
      } finally {
        setSaving(false);
      }
    }, [buildDraft, publishStatus, reload, saveVkIntegrationDraft]);

    const saveAndVerify = useCallback(async (): Promise<VkIntegrationVerificationResult> => {
      setSaving(true);
      setStatusMessage(null);
      setErrorMessage(null);
      setDetails([]);
      try {
        await saveVkIntegrationDraft(buildDraft());
        setStatusMessage('Настройки сохранены');
        return await verify();
      } catch (saveError) {
        const message =
          saveError instanceof Error ? saveError.message : 'Не удалось сохранить настройки';
        setErrorMessage(message);
        publishStatus('error', message, []);
        return { ok: false, message };
      } finally {
        setSaving(false);
      }
    }, [buildDraft, publishStatus, saveVkIntegrationDraft, verify]);

    useImperativeHandle(
      ref,
      () => ({
        saveAndVerify,
        verify,
        canSave,
        reload,
      }),
      [canSave, reload, saveAndVerify, verify],
    );

    const busy = disabled || loading || saving || verifying;
    const fieldOptions = {
      presentation,
      showAllFields,
      missingFields,
      initialSetup,
    };

    const showPartialHint =
      presentation === 'inline' &&
      !showAllFields &&
      !initialSetup &&
      missingFields.length > 0;

    const handleCopyRedirect = async () => {
      try {
        await navigator.clipboard.writeText(VK_CANONICAL_REDIRECT_URI);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setErrorMessage('Не удалось скопировать Redirect URI');
      }
    };

    if (loading && !formState) {
      return <p className="vk-settings__hint">Загрузка настроек…</p>;
    }

    return (
      <div className="vk-settings" data-testid="vk-integration-setup">
        {showPartialHint ? (
          <p className="vk-settings__intro">Для завершения настройки не хватает:</p>
        ) : null}

        {shouldShowField('appId', fieldOptions) ? (
          <label className="vk-settings__field">
            <span>{FIELD_LABELS.appId}</span>
            <input
              value={appId}
              inputMode="numeric"
              placeholder="12345678"
              data-testid="vk-settings-app-id"
              disabled={busy}
              onChange={(event) => setAppId(event.target.value)}
            />
          </label>
        ) : null}

        {shouldShowField('clientSecret', fieldOptions) ? (
          <StoredSecretField
            label={FIELD_LABELS.clientSecret}
            hasValue={Boolean(formState?.hasClientSecret)}
            editing={editingClientSecret}
            value={clientSecretDraft}
            placeholder="Секрет из кабинета VK ID"
            disabled={busy}
            testId="vk-settings-client-secret"
            onStartEdit={() => setEditingClientSecret(true)}
            onChange={setClientSecretDraft}
          />
        ) : null}

        {shouldShowField('serviceToken', fieldOptions) ? (
          <StoredSecretField
            label={FIELD_LABELS.serviceToken}
            hasValue={Boolean(formState?.hasServiceToken)}
            editing={editingServiceToken}
            value={serviceTokenDraft}
            placeholder="Service access token приложения VK"
            disabled={busy}
            testId="vk-settings-service-token"
            onStartEdit={() => setEditingServiceToken(true)}
            onChange={setServiceTokenDraft}
          />
        ) : null}

        {shouldShowField('server', fieldOptions) ? (
          <label className="vk-settings__field">
            <span>Сервер Reizoko</span>
            <input
              value={serverBaseUrl}
              placeholder={VK_DEFAULT_SERVER_BASE_URL}
              data-testid="vk-settings-server-url"
              disabled={busy}
              onChange={(event) => setServerBaseUrl(event.target.value)}
            />
          </label>
        ) : null}

        {shouldShowField('redirect', fieldOptions) ? (
          <label className="vk-settings__field">
            <span>Redirect URI</span>
            <div className="vk-settings__readonly-row">
              <input
                value={VK_CANONICAL_REDIRECT_URI}
                readOnly
                data-testid="vk-settings-redirect-uri"
              />
              <Button
                variant="ghost"
                size="sm"
                data-testid="vk-settings-copy-redirect"
                disabled={busy}
                onClick={() => void handleCopyRedirect()}
              >
                {copied ? (
                  <Check size={16} strokeWidth={2} aria-hidden />
                ) : (
                  <Copy size={16} strokeWidth={2} aria-hidden />
                )}
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
            </div>
            <span className="vk-settings__hint">
              Укажите этот URL в кабинете VK ID как доверенный Redirect URI.
            </span>
          </label>
        ) : null}

        {presentation === 'inline' && !showAllFields && !initialSetup ? (
          <button
            type="button"
            className="vk-settings__link"
            data-testid="vk-settings-show-all"
            disabled={busy}
            onClick={() => onShowAllFieldsChange?.(true)}
          >
            Показать все настройки
          </button>
        ) : null}

        {presentation === 'settings' ? (
          <div className="vk-settings__actions">
            <Button
              variant="primary"
              data-testid="vk-settings-save"
              disabled={busy || !canSave()}
              onClick={() => void save()}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
            <Button
              variant="secondary"
              data-testid="vk-settings-verify"
              disabled={busy}
              onClick={() => void verify()}
            >
              {verifying ? 'Проверка…' : 'Проверить настройки'}
            </Button>
          </div>
        ) : (
          <div className="vk-settings__actions">
            <Button
              variant="secondary"
              data-testid="vk-settings-verify"
              disabled={busy}
              onClick={() => void verify()}
            >
              {verifying ? 'Проверяем настройки…' : 'Проверить настройки'}
            </Button>
          </div>
        )}

        {statusMessage ? (
          <p className="vk-settings__status vk-settings__status--ok" data-testid="vk-settings-status">
            {statusMessage.startsWith('Настройки') ? statusMessage : `✓ ${statusMessage}`}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="vk-settings__status vk-settings__status--error" data-testid="vk-settings-error">
            {errorMessage}
          </p>
        ) : null}
        {details.length > 0 ? (
          <ul className="vk-settings__details">
            {details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {probeTrace.length > 0 ? <VkServerProbeTrace trace={probeTrace} /> : null}
      </div>
    );
  },
);
