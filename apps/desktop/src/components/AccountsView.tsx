import { useMemo, useState } from 'react';
import { Bot, Link2, MoreHorizontal, Plus, Users } from 'lucide-react';
import { Badge, Button, EmptyState, IconButton } from '@reizoko/ui';
import { getAccountConnectionLabel, isConnectionSecretMissingError, toUserFacingConnectionError, toUserFacingTelegramDestinationError } from '@reizoko/core';
import type { CreateSocialAccountInput, PlatformConnection, SocialAccount } from '@reizoko/shared';
import { platformRegistry } from '@reizoko/platform-sdk';
import { useAppStore } from '../stores/app-store';
import { getAllPlatformCatalog } from '../platforms/planned-catalog';
import { PlatformIcon } from './PlatformIcon';
import { AccountDialog } from './AccountDialog';
import { TelegramConnectDialog } from './TelegramConnectDialog';
import { TelegramDestinationDialog } from './TelegramDestinationDialog';
import './accounts-view.css';

type TelegramStoreSlice = {
  connections?: PlatformConnection[];
  connectTelegramBot?: (token: string, existingConnectionId?: string | null) => Promise<void>;
  addTelegramDestination?: (connectionId: string, chatRef: string) => Promise<void>;
  disconnectConnection?: (connectionId: string) => Promise<void>;
  linkAccountToConnection?: (accountId: string, connectionId: string) => Promise<void>;
};

type MenuTarget =
  | { kind: 'account'; account: SocialAccount }
  | { kind: 'connection'; connection: PlatformConnection };

function getConnectionStateLabel(state: PlatformConnection['state']): string {
  if (state === 'connected') return 'Подключён';
  if (state === 'connecting') return 'Подключение…';
  if (state === 'needs_reconnect') return 'Требуется повторное подключение';
  if (state === 'expired') return 'Срок действия истёк';
  if (state === 'error') return 'Ошибка подключения';
  return state;
}

function getConnectionBadgeVariant(
  state: PlatformConnection['state'],
): 'success' | 'warning' | 'danger' | 'default' {
  if (state === 'connected') return 'success';
  if (state === 'connecting') return 'warning';
  if (state === 'error' || state === 'expired') return 'danger';
  return 'default';
}

function getConnectionLabel(connection: PlatformConnection): string {
  return connection.displayName ?? connection.handle ?? 'Telegram-бот';
}

export function AccountsView() {
  const accounts = useAppStore((s) => s.accounts);
  const createAccount = useAppStore((s) => s.createAccount);
  const updateAccount = useAppStore((s) => s.updateAccount);
  const removeAccount = useAppStore((s) => s.removeAccount);
  const setAccountActive = useAppStore((s) => s.setAccountActive);

  const connections = useAppStore((s) => (s as TelegramStoreSlice).connections ?? []);
  const connectTelegramBot = useAppStore((s) => (s as TelegramStoreSlice).connectTelegramBot);
  const addTelegramDestination = useAppStore((s) => (s as TelegramStoreSlice).addTelegramDestination);
  const disconnectConnection = useAppStore((s) => (s as TelegramStoreSlice).disconnectConnection);
  const linkAccountToConnection = useAppStore((s) => (s as TelegramStoreSlice).linkAccountToConnection);
  const loadConnections = useAppStore((s) => (s as TelegramStoreSlice & { loadConnections?: () => Promise<void> }).loadConnections);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [dialogPlatformId, setDialogPlatformId] = useState<string | undefined>();
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  const [telegramConnectOpen, setTelegramConnectOpen] = useState(false);
  const [reconnectConnectionId, setReconnectConnectionId] = useState<string | null>(null);
  const [telegramConnectLoading, setTelegramConnectLoading] = useState(false);
  const [telegramConnectError, setTelegramConnectError] = useState<string | null>(null);

  const [destinationOpen, setDestinationOpen] = useState(false);
  const [destinationConnection, setDestinationConnection] = useState<PlatformConnection | null>(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [destinationPermissionError, setDestinationPermissionError] = useState<string | null>(null);
  const [destinationMissingSecret, setDestinationMissingSecret] = useState(false);

  const [linkingAccountId, setLinkingAccountId] = useState<string | null>(null);

  const platforms = useMemo(() => getAllPlatformCatalog(platformRegistry), []);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.deletedAt),
    [accounts],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SocialAccount[]>();
    for (const platform of platforms) {
      map.set(
        platform.id,
        activeAccounts.filter((account) => account.platformId === platform.id),
      );
    }
    return map;
  }, [activeAccounts, platforms]);

  const telegramConnections = useMemo(
    () => connections.filter((connection) => connection.platformId === 'telegram'),
    [connections],
  );

  const telegramAccounts = grouped.get('telegram') ?? [];
  const telegramLocalAccounts = telegramAccounts.filter((account) => !account.connectionId);
  const hasAnyContent = activeAccounts.length > 0 || telegramConnections.length > 0;

  const openCreate = (platformId?: string) => {
    setEditingAccount(null);
    setDialogPlatformId(platformId);
    setDialogOpen(true);
  };

  const openEdit = (account: SocialAccount) => {
    setEditingAccount(account);
    setDialogOpen(true);
    setMenuTarget(null);
  };

  const handleSubmit = async (input: CreateSocialAccountInput) => {
    if (editingAccount?.id) {
      await updateAccount(editingAccount.id, input);
    } else {
      await createAccount(input);
    }
    setDialogOpen(false);
    setEditingAccount(null);
  };

  const openTelegramConnect = (connectionId?: string | null) => {
    setReconnectConnectionId(connectionId ?? null);
    setTelegramConnectError(null);
    setTelegramConnectOpen(true);
    setMenuTarget(null);
  };

  const handleTelegramConnect = async (token: string) => {
    if (!connectTelegramBot) {
      setTelegramConnectError('Подключение Telegram пока недоступно');
      return;
    }
    setTelegramConnectLoading(true);
    setTelegramConnectError(null);
    try {
      await connectTelegramBot(token, reconnectConnectionId);
      setTelegramConnectOpen(false);
      setReconnectConnectionId(null);
    } catch (submitError) {
      setTelegramConnectError(toUserFacingConnectionError(submitError));
    } finally {
      setTelegramConnectLoading(false);
    }
  };

  const openAddDestination = (connection: PlatformConnection) => {
    setDestinationConnection(connection);
    setDestinationError(null);
    setDestinationPermissionError(null);
    setDestinationMissingSecret(false);
    setDestinationOpen(true);
    setMenuTarget(null);
  };

  const handleAddDestination = async (chatRef: string) => {
    if (!destinationConnection || !addTelegramDestination) {
      setDestinationError('Добавление канала пока недоступно');
      return;
    }
    setDestinationLoading(true);
    setDestinationError(null);
    setDestinationPermissionError(null);
    setDestinationMissingSecret(false);
    try {
      await addTelegramDestination(destinationConnection.id, chatRef);
      setDestinationOpen(false);
      setDestinationConnection(null);
    } catch (submitError) {
      if (isConnectionSecretMissingError(submitError)) {
        setDestinationMissingSecret(true);
        setDestinationError(null);
        await loadConnections?.();
      } else {
        const botHandle =
          destinationConnection.handle ??
          destinationConnection.displayName ??
          '@reizoko_publisher_bot';
        const message = toUserFacingTelegramDestinationError(submitError, botHandle);
        if (/администратор|публикац/i.test(message)) {
          setDestinationPermissionError(message);
          setDestinationError(null);
        } else {
          setDestinationPermissionError(null);
          setDestinationError(message);
        }
      }
    } finally {
      setDestinationLoading(false);
    }
  };

  const handleDestinationReconnect = () => {
    if (!destinationConnection) return;
    const connectionId = destinationConnection.id;
    setDestinationOpen(false);
    setDestinationMissingSecret(false);
    setDestinationError(null);
    openTelegramConnect(connectionId);
  };

  const handleDisconnectConnection = async (connectionId: string) => {
    if (!disconnectConnection) return;
    const confirmed = window.confirm(
      'Отключить Telegram-бота? Сохранённый ключ будет удалён из защищённого хранилища Windows.',
    );
    if (!confirmed) return;
    setMenuTarget(null);
    await disconnectConnection(connectionId);
  };

  const handleLinkAccount = async (accountId: string, connectionId: string) => {
    if (!linkAccountToConnection) return;
    setLinkingAccountId(accountId);
    setMenuTarget(null);
    try {
      await linkAccountToConnection(accountId, connectionId);
    } finally {
      setLinkingAccountId(null);
    }
  };

  const renderAccountCard = (
    account: SocialAccount,
    options?: { viaBot?: string | null; nested?: boolean },
  ) => (
    <article
      key={account.id}
      className={`accounts-view__card ${account.isActive ? '' : 'accounts-view__card--inactive'} ${
        options?.nested ? 'accounts-view__card--destination' : ''
      }`}
      data-testid={`account-card-${account.id}`}
    >
      <div className="accounts-view__card-main">
        <div className="accounts-view__avatar">
          <PlatformIcon platformId={account.platformId} size={18} />
        </div>
        <div>
          <div className="accounts-view__name">{account.displayName}</div>
          {account.handle ? <div className="accounts-view__handle">{account.handle}</div> : null}
          {options?.viaBot ? (
            <div className="accounts-view__via-bot" data-testid={`account-via-bot-${account.id}`}>
              через {options.viaBot}
            </div>
          ) : null}
          <div className="accounts-view__status">
            {getAccountConnectionLabel(account.connectionState)}
            {!account.isActive ? ' · Неактивен' : ''}
          </div>
        </div>
      </div>

      <div className="accounts-view__card-actions">
        {!account.connectionId && account.platformId === 'telegram' && telegramConnections.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            data-testid={`account-link-${account.id}`}
            disabled={linkingAccountId === account.id}
            onClick={() => {
              const connection = telegramConnections.find((item) => item.state === 'connected');
              if (connection) void handleLinkAccount(account.id, connection.id);
            }}
          >
            <Link2 size={14} strokeWidth={2} aria-hidden />
            Привязать подключение
          </Button>
        ) : null}

        <div className="accounts-view__menu-wrap">
          <IconButton
            label="Действия"
            size="sm"
            data-testid={`account-menu-${account.id}`}
            onClick={() =>
              setMenuTarget((current) =>
                current?.kind === 'account' && current.account.id === account.id
                  ? null
                  : { kind: 'account', account },
              )
            }
          >
            <MoreHorizontal size={16} strokeWidth={2} />
          </IconButton>
          {menuTarget?.kind === 'account' && menuTarget.account.id === account.id ? (
            <div className="accounts-view__menu" role="menu">
              <button type="button" onClick={() => openEdit(account)}>
                Изменить
              </button>
              <button type="button" onClick={() => void setAccountActive(account.id, !account.isActive)}>
                {account.isActive ? 'Деактивировать' : 'Активировать'}
              </button>
              <button type="button" onClick={() => void removeAccount(account.id)}>
                Удалить
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );

  const renderConnectionCard = (connection: PlatformConnection) => {
    const destinations = telegramAccounts.filter((account) => account.connectionId === connection.id);
    const label = getConnectionLabel(connection);

    return (
      <div
        key={connection.id}
        className="accounts-view__connection-group"
        data-testid={`connection-group-${connection.id}`}
      >
        <article className="accounts-view__card accounts-view__card--connection" data-testid={`connection-card-${connection.id}`}>
          <div className="accounts-view__card-main">
            <div className="accounts-view__avatar accounts-view__avatar--bot">
              <Bot size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="accounts-view__name-row">
                <span className="accounts-view__name">{label}</span>
                <Badge variant={getConnectionBadgeVariant(connection.state)}>
                  {getConnectionStateLabel(connection.state)}
                </Badge>
              </div>
              {connection.handle ? <div className="accounts-view__handle">{connection.handle}</div> : null}
              <div className="accounts-view__status">Telegram-бот</div>
            </div>
          </div>

          <div className="accounts-view__card-actions">
            <Button
              variant="ghost"
              size="sm"
              data-testid={`connection-add-destination-${connection.id}`}
              onClick={() => openAddDestination(connection)}
            >
              + Канал
            </Button>
            <div className="accounts-view__menu-wrap">
              <IconButton
                label="Действия подключения"
                size="sm"
                data-testid={`connection-menu-${connection.id}`}
                onClick={() =>
                  setMenuTarget((current) =>
                    current?.kind === 'connection' && current.connection.id === connection.id
                      ? null
                      : { kind: 'connection', connection },
                  )
                }
              >
                <MoreHorizontal size={16} strokeWidth={2} />
              </IconButton>
              {menuTarget?.kind === 'connection' && menuTarget.connection.id === connection.id ? (
                <div className="accounts-view__menu" role="menu">
                  <button type="button" onClick={() => openAddDestination(connection)}>
                    Добавить канал
                  </button>
                  <button type="button" onClick={() => openTelegramConnect(connection.id)}>
                    Переподключить
                  </button>
                  <button type="button" onClick={() => void handleDisconnectConnection(connection.id)}>
                    Отключить бота
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </article>

        {destinations.length > 0 ? (
          <div className="accounts-view__destinations">
            {destinations.map((account) =>
              renderAccountCard(account, { viaBot: connection.handle, nested: true }),
            )}
          </div>
        ) : (
          <p className="accounts-view__destinations-empty">Каналы и чаты ещё не добавлены</p>
        )}
      </div>
    );
  };

  const renderPlatformSection = (platformId: string) => {
    const platform = platforms.find((item) => item.id === platformId);
    if (!platform) return null;

    if (platformId === 'telegram') {
      return (
        <section key={platform.id} className="accounts-view__group" data-testid={`accounts-group-${platform.id}`}>
          <div className="accounts-view__group-header">
            <div className="accounts-view__group-title">
              <PlatformIcon platformId={platform.id} size={20} />
              <span>{platform.name}</span>
            </div>
            <div className="accounts-view__group-actions">
              <Button
                variant="ghost"
                size="sm"
                data-testid="telegram-connect-bot"
                onClick={() => openTelegramConnect()}
              >
                Подключить Telegram-бота
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openCreate(platform.id)}>
                + Профиль
              </Button>
            </div>
          </div>

          {telegramConnections.length > 0 ? (
            <div className="accounts-view__connection-groups">
              {telegramConnections.map((connection) => renderConnectionCard(connection))}
            </div>
          ) : null}

          {telegramLocalAccounts.length > 0 ? (
            <div className="accounts-view__local-section">
              {telegramConnections.length > 0 ? (
                <h4 className="accounts-view__local-title">Локальные профили</h4>
              ) : null}
              <div className="accounts-view__cards">
                {telegramLocalAccounts.map((account) => renderAccountCard(account))}
              </div>
            </div>
          ) : null}

          {telegramConnections.length === 0 && telegramLocalAccounts.length === 0 ? (
            <p className="accounts-view__group-empty">
              Подключите Telegram-бота или добавьте локальный профиль для подготовки публикаций.
            </p>
          ) : null}
        </section>
      );
    }

    const platformAccounts = grouped.get(platform.id) ?? [];
    if (platformAccounts.length === 0) return null;

    return (
      <section key={platform.id} className="accounts-view__group" data-testid={`accounts-group-${platform.id}`}>
        <div className="accounts-view__group-header">
          <div className="accounts-view__group-title">
            <PlatformIcon platformId={platform.id} size={20} />
            <span>{platform.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => openCreate(platform.id)}>
            + Добавить
          </Button>
        </div>

        <div className="accounts-view__cards">
          {platformAccounts.map((account) => renderAccountCard(account))}
        </div>
      </section>
    );
  };

  return (
    <div className="accounts-view" data-testid="accounts-view">
      <header className="accounts-view__header">
        <div>
          <div className="accounts-view__title-row">
            <h1>Аккаунты</h1>
            {activeAccounts.length > 0 && <Badge variant="default">{activeAccounts.length}</Badge>}
          </div>
          <p className="accounts-view__subtitle">Локальные профили и подключения к площадкам</p>
          <p className="accounts-view__hint">
            Создавайте профили для подготовки публикаций и подключайте Telegram-ботов для реальной отправки в
            каналы и чаты. Токен бота выдаётся через @BotFather.
          </p>
        </div>
        <Button variant="primary" data-testid="accounts-add" onClick={() => openCreate()}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          Добавить аккаунт
        </Button>
      </header>

      {!hasAnyContent ? (
        <EmptyState
          icon={<Users strokeWidth={1.5} />}
          title="Профили ещё не созданы"
          description="Добавьте локальные профили или подключите Telegram-бота для публикаций."
          action={
            <div className="accounts-view__empty-actions">
              <Button variant="primary" data-testid="telegram-connect-bot-empty" onClick={() => openTelegramConnect()}>
                Подключить Telegram-бота
              </Button>
              <Button variant="ghost" onClick={() => openCreate()}>
                Добавить профиль
              </Button>
            </div>
          }
        />
      ) : (
        <div className="accounts-view__groups">
          {renderPlatformSection('telegram')}
          {platforms
            .filter((platform) => platform.id !== 'telegram')
            .map((platform) => renderPlatformSection(platform.id))}
        </div>
      )}

      {dialogOpen ? (
        <AccountDialog
          platforms={platforms}
          initialPlatformId={dialogPlatformId ?? editingAccount?.platformId}
          account={editingAccount?.id ? editingAccount : null}
          onClose={() => {
            setDialogOpen(false);
            setEditingAccount(null);
            setDialogPlatformId(undefined);
          }}
          onSubmit={handleSubmit}
        />
      ) : null}

      <TelegramConnectDialog
        open={telegramConnectOpen}
        loading={telegramConnectLoading}
        error={telegramConnectError}
        onClose={() => {
          if (telegramConnectLoading) return;
          setTelegramConnectOpen(false);
          setReconnectConnectionId(null);
          setTelegramConnectError(null);
        }}
        onSubmit={handleTelegramConnect}
      />

      <TelegramDestinationDialog
        open={destinationOpen}
        connectionLabel={destinationConnection ? getConnectionLabel(destinationConnection) : 'бот'}
        loading={destinationLoading}
        error={destinationError}
        permissionError={destinationPermissionError}
        missingSecret={destinationMissingSecret}
        onReconnect={handleDestinationReconnect}
        onClose={() => {
          if (destinationLoading) return;
          setDestinationOpen(false);
          setDestinationConnection(null);
          setDestinationError(null);
          setDestinationPermissionError(null);
          setDestinationMissingSecret(false);
        }}
        onSubmit={handleAddDestination}
      />
    </div>
  );
}
