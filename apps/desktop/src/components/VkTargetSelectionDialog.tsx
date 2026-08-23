import { useEffect, useMemo, useState } from 'react';

import { Plus, X } from 'lucide-react';

import { Button, IconButton } from '@reizoko/ui';

import {

  resolveVkTargetEmptyState,

  type VkTargetCandidate,

  type VkTargetDiscoveryResult,

} from '@reizoko/core';

import { AccountDialogOverlay } from './AccountDialogOverlay';

import './account-dialog.css';



type DialogPhase = 'loading' | 'select' | 'external' | 'checking';



interface VkTargetSelectionDialogProps {

  open: boolean;

  connectionLabel: string;

  loading?: boolean;

  phase?: DialogPhase;

  targets: VkTargetCandidate[];

  discovery?: VkTargetDiscoveryResult | null;

  existingOwnerIds?: string[];

  externalLoading?: boolean;

  externalError?: string | null;

  submitError?: string | null;

  onClose: () => void;

  onSubmit: (selected: VkTargetCandidate[]) => void | Promise<void>;

  onResolveExternalWall?: (input: string) => void | Promise<void>;

  externalCandidate?: VkTargetCandidate | null;

  onUpgradePermissions?: () => void | Promise<void>;

  onOpenCommunityToken?: () => void;

}



function formatScreenName(screenName?: string | null): string | null {

  if (!screenName) return null;

  return screenName.startsWith('@') ? screenName : `@${screenName}`;

}



export function VkTargetSelectionDialog({

  open,

  connectionLabel,

  loading = false,

  phase = 'select',

  targets,

  discovery = null,

  existingOwnerIds = [],

  externalLoading = false,

  externalError = null,

  submitError = null,

  onClose,

  onSubmit,

  onResolveExternalWall,

  externalCandidate = null,

  onUpgradePermissions,

  onOpenCommunityToken,

}: VkTargetSelectionDialogProps) {

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [externalInput, setExternalInput] = useState('');

  const [showExternal, setShowExternal] = useState(false);

  const [showAddOptions, setShowAddOptions] = useState(false);



  const emptyState = useMemo(

    () => resolveVkTargetEmptyState({ targets, existingOwnerIds, discovery }),

    [targets, existingOwnerIds, discovery],

  );



  const availableTargets = emptyState.availableTargets;



  const selfTargets = availableTargets.filter((target) => target.targetType === 'self_wall');

  const communityTargets = availableTargets.filter((target) => target.targetType === 'community_wall');

  const otherTargets = availableTargets.filter(

    (target) => target.targetType !== 'self_wall' && target.targetType !== 'community_wall',

  );



  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(availableTargets.map((target) => target.ownerId)));
    setExternalInput('');
    setShowExternal(false);
    setShowAddOptions(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(availableTargets.map((target) => target.ownerId)));
  }, [open, availableTargets]);



  useEffect(() => {

    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {

      if (event.key === 'Escape' && !loading && !externalLoading) onClose();

    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);

  }, [open, loading, externalLoading, onClose]);



  if (!open) return null;



  const toggleTarget = (ownerId: number) => {

    setSelectedIds((current) => {

      const next = new Set(current);

      if (next.has(ownerId)) next.delete(ownerId);

      else next.add(ownerId);

      return next;

    });

  };



  const handleSubmit = () => {

    const selected = availableTargets.filter((target) => selectedIds.has(target.ownerId));

    const withExternal =

      externalCandidate?.canPost &&

      !existingOwnerIds.includes(String(externalCandidate.ownerId))

        ? [...selected, externalCandidate]

        : selected;

    if (withExternal.length === 0 || loading) return;

    void onSubmit(withExternal);

  };



  const handleExternalCheck = () => {

    const trimmed = externalInput.trim();

    if (!trimmed || externalLoading || !onResolveExternalWall) return;

    void onResolveExternalWall(trimmed);

  };



  const phaseLabel =
    phase === 'loading'
      ? 'Получаем данные профиля…'
      : phase === 'checking' || externalLoading
        ? 'Проверяем стену…'
        : null;

  const scopeAnalysis = discovery?.scopes;
  const groupsPermissionMissing = scopeAnalysis ? !scopeAnalysis.hasGroups : false;
  const appGroupsBlocked = discovery?.groups.failureKind === 'APP_PERMISSION_NOT_GRANTED';



  const renderTarget = (target: VkTargetCandidate) => (

    <label key={target.ownerId} className="vk-target-item">

      <input

        type="checkbox"

        checked={selectedIds.has(target.ownerId)}

        disabled={loading}

        onChange={() => toggleTarget(target.ownerId)}

      />

      <div className="vk-target-item__main">

        <div className="vk-target-item__name">{target.displayName}</div>

        <div className="vk-target-item__kind">

          {target.destinationKindLabel}

          {formatScreenName(target.screenName) ? ` · ${formatScreenName(target.screenName)}` : ''}

        </div>

      </div>

    </label>

  );



  const externalCanSubmit =

    externalCandidate?.canPost &&

    !existingOwnerIds.includes(String(externalCandidate.ownerId));



  return (

    <AccountDialogOverlay onClose={onClose} disabled={loading || externalLoading}>

      <div

        className="account-dialog account-dialog--wide"

        data-testid="vk-target-selection-dialog"

        role="dialog"

        aria-modal="true"

        aria-label="Куда публиковать во ВКонтакте"

      >

        <header className="account-dialog__header">

          <div>

            <h3>Куда публиковать?</h3>

            <p className="account-dialog__intro">Подключён как {connectionLabel}</p>

          </div>

          <IconButton label="Закрыть" size="sm" disabled={loading || externalLoading} onClick={onClose}>

            <X size={18} strokeWidth={2} />

          </IconButton>

        </header>



        <div className="account-dialog__body">

          {phaseLabel ? (

            <p className="account-dialog__note" data-testid="vk-target-phase">

              {phaseLabel}

            </p>

          ) : null}



          {discovery?.fatalError ? (
            <p className="account-dialog__error" data-testid="vk-target-fatal-error">
              {discovery.fatalError}
            </p>
          ) : null}

          {discovery && !discovery.fatalError ? (
            <div className="vk-target-status" data-testid="vk-target-connection-status">
              <p className="account-dialog__note">✓ ВКонтакте подключён</p>
              {discovery.selfWall.available ? (
                <p className="account-dialog__note">✓ Личная страница доступна</p>
              ) : (
                <p className="account-dialog__note">⚠ Личная страница недоступна для публикации</p>
              )}
              {groupsPermissionMissing || discovery.groups.status === 'failed' ? (
                <p className="account-dialog__note" data-testid="vk-target-groups-missing">
                  ⚠ Нет разрешения на просмотр сообществ
                </p>
              ) : discovery.groups.count > 0 ? (
                <p className="account-dialog__note">✓ Управляемые сообщества: {discovery.groups.count}</p>
              ) : null}
            </div>
          ) : null}

          {appGroupsBlocked ? (
            <p className="account-dialog__error" data-testid="vk-target-app-permission">
              Для приложения Reizoko ещё не включён доступ «Сообщества». Откройте кабинет VK ID → Доступы и
              включите «Сообщества», «Стена» и «Фотографии».
            </p>
          ) : null}

          {groupsPermissionMissing && !appGroupsBlocked ? (
            <div className="vk-target-scope-upgrade" data-testid="vk-target-scope-upgrade">
              <p className="account-dialog__note">
                ВКонтакте подключён, но Reizoko пока не имеет доступа к вашим сообществам. Чтобы выбирать группы
                для публикации, разрешите Reizoko доступ к сообществам.
              </p>
              {onUpgradePermissions ? (
                <Button variant="ghost" size="sm" onClick={() => void onUpgradePermissions()}>
                  Обновить разрешения
                </Button>
              ) : null}
            </div>
          ) : null}

          {discovery?.publishCapabilities.wallWarning ? (
            <p className="account-dialog__note" data-testid="vk-target-wall-warning">
              ⚠ {discovery.publishCapabilities.wallWarning}
            </p>
          ) : null}

          {discovery?.publishCapabilities.photosWarning ? (
            <p className="account-dialog__note" data-testid="vk-target-photos-warning">
              ⚠ {discovery.publishCapabilities.photosWarning}
            </p>
          ) : null}



          {discovery?.notices.map((notice) => (

            <p key={notice} className="account-dialog__note" data-testid="vk-target-discovery-notice">

              {notice}

            </p>

          ))}



          {availableTargets.length > 0 ? (

            <div className="vk-target-list" data-testid="vk-target-list">

              {selfTargets.length > 0 ? (

                <>

                  <p className="vk-target-list__section">Моя страница</p>

                  {selfTargets.map(renderTarget)}

                </>

              ) : null}

              {communityTargets.length > 0 ? (

                <>

                  <p className="vk-target-list__section">Управляемые сообщества</p>

                  {communityTargets.map(renderTarget)}

                </>

              ) : null}

              {otherTargets.length > 0 ? (

                <>

                  <p className="vk-target-list__section">Другие стены</p>

                  {otherTargets.map(renderTarget)}

                </>

              ) : null}

            </div>

          ) : phase !== 'loading' ? (

            <p className="account-dialog__note" data-testid="vk-target-empty">

              {emptyState.emptyMessage ?? 'Нет новых доступных мест публикации.'}

            </p>

          ) : null}



          {!showAddOptions && !showExternal ? (

            <Button

              variant="ghost"

              size="sm"

              data-testid="vk-add-publication-target"

              disabled={loading || externalLoading}

              onClick={() => setShowAddOptions(true)}

            >

              <Plus size={14} strokeWidth={2} aria-hidden />

              Добавить место публикации

            </Button>

          ) : null}

          {showAddOptions && !showExternal ? (

            <div className="vk-target-add-options" data-testid="vk-target-add-options">
              <p className="account-dialog__note vk-target-add-options__intro">
                Два способа добавить место публикации — выберите подходящий. API-ключ сообщества нужен
                только для второго варианта.
              </p>
              <button
                type="button"
                className="vk-target-add-option"
                data-testid="vk-add-external-wall"
                onClick={() => {
                  setShowAddOptions(false);
                  setShowExternal(true);
                }}
              >
                <span className="vk-target-add-option__title">Добавить стену по ссылке</span>
                <span className="vk-target-add-option__hint">
                  Через подключённый VK ID: личная страница или сообщество, где вы администратор. Ключ API
                  не нужен — достаточно разрешений «Стена»{groupsPermissionMissing ? ' (и «Сообщества» для автосписка)' : ''}.
                </span>
              </button>
              <button
                type="button"
                className="vk-target-add-option"
                data-testid="vk-open-community-token"
                onClick={() => onOpenCommunityToken?.()}
              >
                <span className="vk-target-add-option__title">Подключить сообщество по ключу API</span>
                <span className="vk-target-add-option__hint">
                  Отдельный ключ из «Работа с API» сообщества. Подходит, если не хотите давать Reizoko доступ
                  к списку ваших групп через VK ID.
                </span>
              </button>
            </div>

          ) : null}

          {showExternal ? (

            <div className="vk-external-wall" data-testid="vk-external-wall-form">
              <p className="account-dialog__note">
                Вставьте ссылку на стену — проверим через ваш VK ID, можно ли туда публиковать. Ключ API
                сообщества не требуется.
              </p>

              <label className="account-dialog__field">
                <span>Ссылка, короткое имя или ID</span>

                <input

                  value={externalInput}

                  placeholder="vk.com/durov, club123456 или durov"

                  disabled={externalLoading}

                  onChange={(event) => setExternalInput(event.target.value)}

                  onKeyDown={(event) => {

                    if (event.key === 'Enter') handleExternalCheck();

                  }}

                />

              </label>

              <Button
                variant="ghost"
                size="sm"
                disabled={externalLoading || !externalInput.trim()}
                onClick={handleExternalCheck}
              >
                {externalLoading ? 'Проверяем стену…' : 'Проверить'}
              </Button>

              {externalLoading ? (
                <p className="account-dialog__note" data-testid="vk-external-checking">
                  Проверяем стену…
                </p>
              ) : null}

              {externalError ? (
                <p className="account-dialog__error" data-testid="vk-external-error">
                  {externalError}
                </p>
              ) : null}

              {externalCandidate && externalCandidate.canPost ? (
                <div className="vk-external-success" data-testid="vk-external-success">
                  <p className="account-dialog__note">✓ {externalCandidate.displayName}</p>
                  <p className="account-dialog__note">
                    {externalCandidate.destinationKindLabel}
                    {formatScreenName(externalCandidate.screenName)
                      ? ` · ${formatScreenName(externalCandidate.screenName)}`
                      : ''}
                  </p>
                  <p className="account-dialog__note">Вы можете добавить это место публикации.</p>
                </div>
              ) : null}

            </div>

          ) : null}



          {submitError ? (

            <p className="account-dialog__error" data-testid="vk-target-submit-error">

              {submitError}

            </p>

          ) : null}

        </div>



        <footer className="account-dialog__footer">

          <Button variant="ghost" disabled={loading || externalLoading} onClick={onClose}>

            Отмена

          </Button>

          <Button

            variant="primary"

            data-testid="vk-target-submit"

            disabled={loading || (selectedIds.size === 0 && !externalCanSubmit)}

            onClick={handleSubmit}

          >

            {loading ? 'Подключение…' : 'Подключить выбранные'}

          </Button>

        </footer>

      </div>

    </AccountDialogOverlay>

  );

}


