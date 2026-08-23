import { useEffect, useMemo, useState } from 'react';
import { Bot, Link2, MoreHorizontal, Plus, User, Users } from 'lucide-react';
import { Badge, Button, EmptyState, IconButton } from '@reizoko/ui';
import {
  communityConnectionInputFromHandle,
  getAccountConnectionLabel,
  getVkAccountSubtitle,
  getVkAccountCredentialLabel,
  isCommunityCredentialConnection,
  type VkCommunityTokenVerification,
  type VkCommunityTokenVerifyState,
  isConnectionSecretMissingError,
  toUserFacingConnectionError,
  toUserFacingTelegramDestinationError,
  toUserFacingVkError,
  type VkTargetCandidate,
  type VkTargetDiscoveryResult,
} from '@reizoko/core';
import type { CreateSocialAccountInput, PlatformConnection, SocialAccount } from '@reizoko/shared';
import { parseVkPublicationTargetMetadata } from '@reizoko/shared';
import { platformRegistry } from '@reizoko/platform-sdk';
import { useAppStore } from '../stores/app-store';
import { getAllPlatformCatalog } from '../platforms/planned-catalog';
import { PlatformIcon } from './PlatformIcon';
import { AccountDialog } from './AccountDialog';
import { TelegramConnectDialog } from './TelegramConnectDialog';
import { TelegramDestinationDialog } from './TelegramDestinationDialog';
import { VkConnectDialog } from './VkConnectDialog';
import { VkCommunityTokenDialog } from './VkCommunityTokenDialog';
import { VkCommunityPermissionsRow } from './VkCommunityPermissionsRow';
import { VkTargetSelectionDialog } from './VkTargetSelectionDialog';
import {
  clearVkCommunityConnectDraft,
  loadVkCommunityConnectDraft,
  saveVkCommunityConnectDraft,
} from '../services/vk-community-connect-draft';
import './accounts-view.css';

function connectionPreferenceScore(connection: PlatformConnection): number {
  let score = 0;
  if (connection.state === 'connected') score += 4;
  if (connection.secretRef) score += 2;
  if (!connection.errorCode) score += 1;
  return score;
}

function dedupeConnectionsByIdentity(connections: PlatformConnection[]): PlatformConnection[] {
  const byIdentity = new Map<string, PlatformConnection>();
  for (const connection of connections) {
    const key = connection.externalIdentityId ?? connection.id;
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, connection);
      continue;
    }
    const existingScore = connectionPreferenceScore(existing);
    const candidateScore = connectionPreferenceScore(connection);
    if (
      candidateScore > existingScore ||
      (candidateScore === existingScore && (connection.updatedAt ?? '') > (existing.updatedAt ?? ''))
    ) {
      byIdentity.set(key, connection);
    }
  }
  return [...byIdentity.values()];
}

type StoreSlice = {
  connections?: PlatformConnection[];
  connectTelegramBot?: (token: string, existingConnectionId?: string | null) => Promise<void>;
  addTelegramDestination?: (connectionId: string, chatRef: string) => Promise<void>;
  connectVkOAuth?: (existingConnectionId?: string | null, options?: { upgradePermissions?: boolean }) => Promise<string | null>;
  loadVkTargetsForConnection?: (connectionId: string) => Promise<VkTargetDiscoveryResult>;
  addVkPublicationTargets?: (connectionId: string, targets: VkTargetCandidate[]) => Promise<void>;
  resolveVkExternalWall?: (connectionId: string, input: string) => Promise<VkTargetCandidate>;
  verifyVkCommunityToken?: (input: {
    communityInput: string;
    accessToken: string;
  }) => Promise<VkCommunityTokenVerification>;
  connectVkCommunityToken?: (input: {
    verification: VkCommunityTokenVerification;
    accessToken: string;
  }) => Promise<void>;
  replaceVkCommunityToken?: (connectionId: string, accessToken: string) => Promise<void>;
  refreshVkCommunityTokenStatus?: (connectionId: string) => Promise<VkCommunityTokenVerification>;
  disconnectConnection?: (connectionId: string) => Promise<void>;
  linkAccountToConnection?: (accountId: string, connectionId: string) => Promise<void>;
  loadConnections?: () => Promise<void>;
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
  return connection.displayName ?? connection.handle ?? 'Телеграм-бот';
}

export function AccountsView() {
  const accounts = useAppStore((s) => s.accounts);
  const createAccount = useAppStore((s) => s.createAccount);
  const updateAccount = useAppStore((s) => s.updateAccount);
  const removeAccount = useAppStore((s) => s.removeAccount);
  const setAccountActive = useAppStore((s) => s.setAccountActive);

  const connections = useAppStore((s) => (s as StoreSlice).connections ?? []);
  const connectTelegramBot = useAppStore((s) => (s as StoreSlice).connectTelegramBot);
  const addTelegramDestination = useAppStore((s) => (s as StoreSlice).addTelegramDestination);
  const loadVkTargetsForConnection = useAppStore((s) => (s as StoreSlice).loadVkTargetsForConnection);
  const connectVkOAuth = useAppStore((s) => (s as StoreSlice).connectVkOAuth);
  const addVkPublicationTargets = useAppStore((s) => (s as StoreSlice).addVkPublicationTargets);
  const resolveVkExternalWall = useAppStore((s) => (s as StoreSlice).resolveVkExternalWall);
  const verifyVkCommunityToken = useAppStore((s) => (s as StoreSlice).verifyVkCommunityToken);
  const connectVkCommunityToken = useAppStore((s) => (s as StoreSlice).connectVkCommunityToken);
  const replaceVkCommunityToken = useAppStore((s) => (s as StoreSlice).replaceVkCommunityToken);
  const refreshVkCommunityTokenStatus = useAppStore((s) => (s as StoreSlice).refreshVkCommunityTokenStatus);
  const disconnectConnection = useAppStore((s) => (s as StoreSlice).disconnectConnection);
  const linkAccountToConnection = useAppStore((s) => (s as StoreSlice).linkAccountToConnection);
  const loadConnections = useAppStore((s) => (s as StoreSlice).loadConnections);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [dialogPlatformId, setDialogPlatformId] = useState<string | undefined>();
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  useEffect(() => {
    if (!menuTarget) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.accounts-view__menu-wrap')) return;
      setMenuTarget(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuTarget]);

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

  const [vkConnectOpen, setVkConnectOpen] = useState(false);
  const [vkReconnectConnectionId, setVkReconnectConnectionId] = useState<string | null>(null);

  const [vkTargetOpen, setVkTargetOpen] = useState(false);
  const [vkTargetConnection, setVkTargetConnection] = useState<PlatformConnection | null>(null);
  const [vkTargets, setVkTargets] = useState<VkTargetCandidate[]>([]);
  const [vkTargetDiscovery, setVkTargetDiscovery] = useState<VkTargetDiscoveryResult | null>(null);
  const [vkTargetPhase, setVkTargetPhase] = useState<'loading' | 'select' | 'external' | 'checking'>('select');
  const [vkTargetLoading, setVkTargetLoading] = useState(false);
  const [vkTargetError, setVkTargetError] = useState<string | null>(null);
  const [vkExternalLoading, setVkExternalLoading] = useState(false);
  const [vkExternalError, setVkExternalError] = useState<string | null>(null);
  const [vkExternalCandidate, setVkExternalCandidate] = useState<VkTargetCandidate | null>(null);

  const initialVkCommunityDraft = loadVkCommunityConnectDraft();
  const [vkCommunityTokenOpen, setVkCommunityTokenOpen] = useState(false);
  const [vkCommunityVerifyState, setVkCommunityVerifyState] =
    useState<VkCommunityTokenVerifyState>('idle');
  const [vkCommunityVerification, setVkCommunityVerification] =
    useState<VkCommunityTokenVerification | null>(null);
  const [vkCommunityInputDraft, setVkCommunityInputDraft] = useState(
    initialVkCommunityDraft.communityInput,
  );
  const [vkCommunityTokenDraft, setVkCommunityTokenDraft] = useState(
    initialVkCommunityDraft.accessToken,
  );
  const [vkCommunityTokenError, setVkCommunityTokenError] = useState<string | null>(null);
  const [vkCommunityTokenLoading, setVkCommunityTokenLoading] = useState(false);
  const [vkCommunityReplaceConnectionId, setVkCommunityReplaceConnectionId] = useState<string | null>(
    null,
  );
  const [vkCommunityRefreshingId, setVkCommunityRefreshingId] = useState<string | null>(null);
  const [vkCommunityRefreshError, setVkCommunityRefreshError] = useState<{
    connectionId: string;
    message: string;
  } | null>(null);

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

  const vkConnections = useMemo(
    () => connections.filter((connection) => connection.platformId === 'vk'),
    [connections],
  );

  const vkOAuthConnections = useMemo(
    () =>
      dedupeConnectionsByIdentity(
        vkConnections.filter((connection) => connection.method === 'oauth_system_browser'),
      ),
    [vkConnections],
  );

  const vkCommunityConnections = useMemo(
    () =>
      dedupeConnectionsByIdentity(
        vkConnections.filter((connection) => isCommunityCredentialConnection(connection)),
      ),
    [vkConnections],
  );

  const telegramAccounts = grouped.get('telegram') ?? [];
  const vkAccounts = grouped.get('vk') ?? [];
  const telegramLocalAccounts = telegramAccounts.filter((account) => !account.connectionId);
  const vkLocalAccounts = vkAccounts.filter((account) => !account.connectionId);
  const hasAnyContent = activeAccounts.length > 0 || telegramConnections.length > 0 || vkConnections.length > 0;

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

  const handleDisconnectConnection = async (connectionId: string, platformId: string) => {
    if (!disconnectConnection) return;
    const message =
      platformId === 'vk'
        ? 'Отключить ВКонтакте? Сохранённый токен будет удалён из защищённого хранилища Windows.'
        : 'Отключить Telegram-бота? Сохранённый ключ будет удалён из защищённого хранилища Windows.';
    const confirmed = window.confirm(message);
    if (!confirmed) return;
    setMenuTarget(null);
    await disconnectConnection(connectionId);
  };

  const openVkConnect = (connectionId?: string | null) => {
    setVkReconnectConnectionId(connectionId ?? null);
    setVkConnectOpen(true);
    setMenuTarget(null);
  };

  const handleVkOAuthSuccess = async (connectionId: string) => {
    setVkConnectOpen(false);
    setVkReconnectConnectionId(null);
    await loadConnections?.();
    const connection = useAppStore.getState().connections.find((item) => item.id === connectionId);
    if (connection) await openVkTargetSelection(connection);
  };

  const openVkTargetSelection = async (connection: PlatformConnection) => {
    if (!loadVkTargetsForConnection) return;
    setVkTargetConnection(connection);
    setVkTargetOpen(true);
    setVkTargetError(null);
    setVkExternalError(null);
    setVkExternalCandidate(null);
    setVkTargetDiscovery(null);
    setVkTargetPhase('loading');
    try {
      const discovery = await loadVkTargetsForConnection(connection.id);
      setVkTargets(discovery.targets);
      setVkTargetDiscovery(discovery);
      if (discovery.fatalError && discovery.emptyReason === 'TOKEN_INVALID') {
        setVkTargetError(discovery.fatalError);
      }
      setVkTargetPhase('select');
    } catch (error) {
      setVkTargetError(toUserFacingVkError(error, { stage: 'publication_target_discovery' }));
      setVkTargetPhase('select');
    }
  };

  const handleVkTargetSubmit = async (selected: VkTargetCandidate[]) => {
    if (!vkTargetConnection || !addVkPublicationTargets) return;
    setVkTargetLoading(true);
    setVkTargetError(null);
    try {
      const allSelected = selected;
      await addVkPublicationTargets(vkTargetConnection.id, allSelected);
      setVkTargetOpen(false);
      setVkTargetConnection(null);
      setVkExternalCandidate(null);
    } catch (error) {
      setVkTargetError(toUserFacingVkError(error));
    } finally {
      setVkTargetLoading(false);
    }
  };

  const persistVkCommunityDraft = (patch: {
    communityInput?: string;
    accessToken?: string;
  }) => {
    const communityInput = patch.communityInput ?? vkCommunityInputDraft;
    const accessToken = patch.accessToken ?? vkCommunityTokenDraft;
    saveVkCommunityConnectDraft({ communityInput, accessToken });
  };

  const openVkCommunityTokenDialog = (replaceConnectionId?: string | null) => {
    setVkCommunityTokenOpen(true);
    setVkCommunityReplaceConnectionId(replaceConnectionId ?? null);
    setVkCommunityVerifyState('idle');
    setVkCommunityVerification(null);
    setVkCommunityTokenError(null);
    setVkTargetOpen(false);
    if (replaceConnectionId) {
      const connection = connections.find((item) => item.id === replaceConnectionId);
      const communityInput = communityConnectionInputFromHandle(
        connection?.handle,
        connection?.externalIdentityId,
      );
      if (communityInput) {
        setVkCommunityInputDraft(communityInput);
      }
    }
  };

  const handleRefreshVkCommunityStatus = async (connectionId: string) => {
    if (!refreshVkCommunityTokenStatus) return;
    setVkCommunityRefreshingId(connectionId);
    setVkCommunityRefreshError(null);
    try {
      await refreshVkCommunityTokenStatus(connectionId);
    } catch (error) {
      setVkCommunityRefreshError({
        connectionId,
        message: toUserFacingVkError(error, { credentialKind: 'community_token' }),
      });
    } finally {
      setVkCommunityRefreshingId(null);
    }
  };

  const handleVkCommunityVerify = async (input: { communityInput: string; accessToken: string }) => {
    if (!verifyVkCommunityToken) return;
    setVkCommunityInputDraft(input.communityInput);
    setVkCommunityTokenDraft(input.accessToken);
    persistVkCommunityDraft(input);
    setVkCommunityTokenLoading(true);
    setVkCommunityVerifyState('checking');
    setVkCommunityTokenError(null);
    setVkCommunityVerification(null);
    try {
      const verification = await verifyVkCommunityToken(input);
      setVkCommunityVerification(verification);
      setVkCommunityVerifyState('valid');
    } catch (error) {
      setVkCommunityVerifyState('invalid');
      setVkCommunityTokenError(
        toUserFacingVkError(error, { stage: 'external_wall', credentialKind: 'community_token' }),
      );
    } finally {
      setVkCommunityTokenLoading(false);
    }
  };

  const handleVkCommunityConnect = async () => {
    if (!connectVkCommunityToken || !vkCommunityVerification || !vkCommunityTokenDraft) return;
    setVkCommunityTokenLoading(true);
    setVkCommunityTokenError(null);
    try {
      if (vkCommunityReplaceConnectionId && replaceVkCommunityToken) {
        await replaceVkCommunityToken(vkCommunityReplaceConnectionId, vkCommunityTokenDraft);
      } else if (connectVkCommunityToken) {
        await connectVkCommunityToken({
          verification: vkCommunityVerification,
          accessToken: vkCommunityTokenDraft,
        });
      }
      setVkCommunityTokenOpen(false);
      setVkCommunityReplaceConnectionId(null);
      setVkCommunityVerification(null);
      setVkCommunityVerifyState('idle');
      setVkCommunityInputDraft('');
      setVkCommunityTokenDraft('');
      clearVkCommunityConnectDraft();
    } catch (error) {
      setVkCommunityTokenError(toUserFacingVkError(error, { credentialKind: 'community_token' }));
    } finally {
      setVkCommunityTokenLoading(false);
    }
  };

  const handleVkUpgradePermissions = async (connection: PlatformConnection) => {
    if (!connectVkOAuth) return;
    try {
      const connectionId = await connectVkOAuth(connection.id, { upgradePermissions: true });
      if (!connectionId) return;
      await loadConnections?.();
      const updated = useAppStore.getState().connections.find((item) => item.id === connectionId);
      if (updated) await openVkTargetSelection(updated);
    } catch (error) {
      setVkTargetError(toUserFacingVkError(error, { stage: 'oauth' }));
    }
  };

  const vkTargetExistingOwnerIds = useMemo(
    () =>
      vkTargetConnection
        ? vkAccounts
            .filter((account) => account.connectionId === vkTargetConnection.id)
            .map((account) => account.externalAccountId ?? '')
        : [],
    [vkAccounts, vkTargetConnection],
  );

  const handleVkExternalResolve = async (input: string) => {
    if (!vkTargetConnection || !resolveVkExternalWall) return;
    setVkExternalLoading(true);
    setVkExternalError(null);
    setVkExternalCandidate(null);
    setVkTargetPhase('checking');
    try {
      const candidate = await resolveVkExternalWall(vkTargetConnection.id, input);
      setVkExternalCandidate(candidate);
    } catch (error) {
      setVkExternalCandidate(null);
      setVkExternalError(toUserFacingVkError(error, { stage: 'external_wall' }));
    } finally {
      setVkExternalLoading(false);
      setVkTargetPhase('select');
    }
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
          {account.platformId === 'vk' ? (
            <div className="accounts-view__handle">{getVkAccountSubtitle(account)}</div>
          ) : account.handle ? (
            <div className="accounts-view__handle">{account.handle}</div>
          ) : null}
          {account.platformId === 'vk' &&
          getVkAccountCredentialLabel(
            account,
            connections.find((item) => item.id === account.connectionId) ?? null,
          ) ? (
            <div className="accounts-view__via-bot">
              {getVkAccountCredentialLabel(
                account,
                connections.find((item) => item.id === account.connectionId) ?? null,
              )}
            </div>
          ) : null}
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
            Привязать к боту
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
                  <button type="button" onClick={() => void handleDisconnectConnection(connection.id, 'telegram')}>
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

  const renderVkCommunityConnectionCard = (connection: PlatformConnection) => {
    const account = vkAccounts.find((item) => item.connectionId === connection.id);
    const label = connection.displayName ?? 'Сообщество ВКонтакте';
    const metadata = account ? parseVkPublicationTargetMetadata(account.platformMetadataJson) : null;
    const isRefreshing = vkCommunityRefreshingId === connection.id;

    return (
      <div
        key={connection.id}
        className="accounts-view__connection-group"
        data-testid={`vk-community-connection-${connection.id}`}
      >
        <article className="accounts-view__card accounts-view__card--connection">
          <div className="accounts-view__card-main">
            <div className="accounts-view__avatar accounts-view__avatar--bot">
              <Users size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="accounts-view__name-row">
                <span className="accounts-view__name">{label}</span>
                <Badge variant={getConnectionBadgeVariant(connection.state)}>Ключ сообщества</Badge>
              </div>
              {connection.handle ? <div className="accounts-view__handle">{connection.handle}</div> : null}
              <div className="accounts-view__status">Подключено по ключу сообщества</div>
              {metadata?.capabilities?.permissions ? (
                <VkCommunityPermissionsRow
                  permissions={metadata.capabilities.permissions}
                  compact
                />
              ) : (
                <p className="accounts-view__status">
                  Нажмите «Проверить ключ», чтобы увидеть права доступа.
                </p>
              )}
            </div>
          </div>
          <div className="accounts-view__card-actions">
            <Button
              variant="ghost"
              size="sm"
              data-testid={`vk-community-refresh-${connection.id}`}
              disabled={isRefreshing}
              onClick={() => void handleRefreshVkCommunityStatus(connection.id)}
            >
              {isRefreshing ? 'Проверяем…' : 'Проверить ключ'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openVkCommunityTokenDialog(connection.id)}
            >
              Заменить ключ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleDisconnectConnection(connection.id, 'vk')}
            >
              Отключить сообщество
            </Button>
          </div>
        </article>
        {vkCommunityRefreshError?.connectionId === connection.id ? (
          <p className="accounts-view__community-refresh-error">{vkCommunityRefreshError.message}</p>
        ) : null}
        {account ? (
          <div className="accounts-view__destinations">{renderAccountCard(account, { nested: true })}</div>
        ) : null}
      </div>
    );
  };

  const renderVkConnectionCard = (connection: PlatformConnection) => {
    const destinations = vkAccounts.filter((account) => account.connectionId === connection.id);
    const label = connection.displayName ?? 'ВКонтакте';

    return (
      <div
        key={connection.id}
        className="accounts-view__connection-group"
        data-testid={`vk-connection-group-${connection.id}`}
      >
        <article className="accounts-view__card accounts-view__card--connection" data-testid={`connection-card-${connection.id}`}>
          <div className="accounts-view__card-main">
            <div className="accounts-view__avatar accounts-view__avatar--bot">
              <User size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="accounts-view__name-row">
                <span className="accounts-view__name">{label}</span>
                <Badge variant={getConnectionBadgeVariant(connection.state)}>
                  {getConnectionStateLabel(connection.state)}
                </Badge>
              </div>
              {connection.handle ? <div className="accounts-view__handle">{connection.handle}</div> : null}
              <div className="accounts-view__status">Подключён как {label}</div>
              {connection.errorCode === 'missing_scopes' ? (
                <div className="accounts-view__status" data-testid={`vk-missing-scopes-${connection.id}`}>
                  Требуется обновить разрешения ВКонтакте
                </div>
              ) : null}
            </div>
          </div>

          <div className="accounts-view__card-actions">
            <Button
              variant="ghost"
              size="sm"
              data-testid={`vk-add-target-${connection.id}`}
              onClick={() => void openVkTargetSelection(connection)}
            >
              + Место публикации
            </Button>
            {connection.errorCode === 'missing_scopes' ? (
              <Button
                variant="ghost"
                size="sm"
                data-testid={`vk-upgrade-permissions-${connection.id}`}
                onClick={() => void handleVkUpgradePermissions(connection)}
              >
                Обновить разрешения
              </Button>
            ) : null}
            <div className="accounts-view__menu-wrap">
              <IconButton
                label="Действия подключения"
                size="sm"
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
                  <button type="button" onClick={() => void openVkTargetSelection(connection)}>
                    Добавить место публикации
                  </button>
                  <button type="button" onClick={() => void openVkConnect(connection.id)}>
                    Переподключить
                  </button>
                  <button type="button" onClick={() => void handleDisconnectConnection(connection.id, 'vk')}>
                    Отключить ВКонтакте
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </article>

        {destinations.length > 0 ? (
          <div className="accounts-view__destinations">
            {destinations.map((account) =>
              renderAccountCard(account, {
                viaBot: `как ${connection.displayName ?? 'ВКонтакте'}`,
                nested: true,
              }),
            )}
          </div>
        ) : (
          <p className="accounts-view__destinations-empty">Места публикации ещё не выбраны</p>
        )}
      </div>
    );
  };

  const renderPlatformSection = (platformId: string) => {
    const platform = platforms.find((item) => item.id === platformId);
    if (!platform) return null;

    if (platformId === 'vk') {
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
                data-testid="vk-connect"
                onClick={() => void openVkConnect()}
              >
                Подключить ВКонтакте
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-testid="vk-connect-community-token"
                onClick={() => openVkCommunityTokenDialog()}
              >
                + Подключить сообщество по ключу
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openCreate(platform.id)}>
                + Профиль
              </Button>
            </div>
          </div>

          {vkOAuthConnections.length > 0 ? (
            <div className="accounts-view__connection-groups">
              {vkOAuthConnections.map((connection) => renderVkConnectionCard(connection))}
            </div>
          ) : null}

          {vkCommunityConnections.length > 0 ? (
            <div className="accounts-view__connection-groups">
              {vkCommunityConnections.map((connection) => renderVkCommunityConnectionCard(connection))}
            </div>
          ) : null}

          {vkLocalAccounts.length > 0 ? (
            <div className="accounts-view__local-section">
              {vkConnections.length > 0 ? (
                <h4 className="accounts-view__local-title">Локальные профили</h4>
              ) : null}
              <div className="accounts-view__cards">
                {vkLocalAccounts.map((account) => renderAccountCard(account))}
              </div>
            </div>
          ) : null}

          {vkConnections.length === 0 && vkLocalAccounts.length === 0 ? (
            <p className="accounts-view__group-empty">
              Подключите ВКонтакте или добавьте локальный профиль для подготовки публикаций.
            </p>
          ) : null}
        </section>
      );
    }

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
            + Профиль
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
          Добавить профиль
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
          {renderPlatformSection('vk')}
          {platforms
            .filter((platform) => platform.id !== 'telegram' && platform.id !== 'vk')
            .map((platform) => renderPlatformSection(platform.id))}
        </div>
      )}

      {dialogOpen ? (
        <AccountDialog
          platforms={platforms}
          initialPlatformId={dialogPlatformId ?? editingAccount?.platformId}
          account={editingAccount?.id ? editingAccount : null}
          onConnectTelegram={() => openTelegramConnect()}
          onConnectVk={() => void openVkConnect()}
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

      <VkConnectDialog
        open={vkConnectOpen}
        reconnectConnectionId={vkReconnectConnectionId}
        onClose={() => {
          setVkConnectOpen(false);
          setVkReconnectConnectionId(null);
        }}
        onOAuthSuccess={handleVkOAuthSuccess}
      />

      <VkTargetSelectionDialog
        open={vkTargetOpen}
        connectionLabel={vkTargetConnection?.displayName ?? 'ВКонтакте'}
        loading={vkTargetLoading}
        phase={vkTargetPhase}
        targets={vkTargets}
        discovery={vkTargetDiscovery}
        existingOwnerIds={vkTargetExistingOwnerIds}
        externalLoading={vkExternalLoading}
        externalError={vkExternalError}
        submitError={vkTargetError}
        externalCandidate={vkExternalCandidate}
        onUpgradePermissions={
          vkTargetConnection ? () => handleVkUpgradePermissions(vkTargetConnection) : undefined
        }
        onClose={() => {
          if (vkTargetLoading || vkExternalLoading) return;
          setVkTargetOpen(false);
          setVkTargetConnection(null);
          setVkTargetError(null);
          setVkExternalError(null);
          setVkExternalCandidate(null);
          setVkTargetDiscovery(null);
        }}
        onSubmit={handleVkTargetSubmit}
        onResolveExternalWall={handleVkExternalResolve}
        onOpenCommunityToken={openVkCommunityTokenDialog}
      />

      <VkCommunityTokenDialog
        open={vkCommunityTokenOpen}
        loading={vkCommunityTokenLoading}
        verifyState={vkCommunityVerifyState}
        verification={vkCommunityVerification}
        error={vkCommunityTokenError}
        communityInput={vkCommunityInputDraft}
        accessToken={vkCommunityTokenDraft}
        onCommunityInputChange={(value) => {
          setVkCommunityInputDraft(value);
          persistVkCommunityDraft({ communityInput: value });
        }}
        onAccessTokenChange={(value) => {
          setVkCommunityTokenDraft(value);
          persistVkCommunityDraft({ accessToken: value });
        }}
        onClose={() => {
          if (vkCommunityTokenLoading) return;
          setVkCommunityTokenOpen(false);
          setVkCommunityReplaceConnectionId(null);
          setVkCommunityVerifyState('idle');
          setVkCommunityVerification(null);
          setVkCommunityTokenError(null);
        }}
        onVerify={handleVkCommunityVerify}
        onConnect={handleVkCommunityConnect}
      />
    </div>
  );
}
