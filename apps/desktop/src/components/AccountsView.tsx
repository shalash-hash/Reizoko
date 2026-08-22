import { useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Users } from 'lucide-react';
import { Badge, Button, EmptyState, IconButton } from '@reizoko/ui';
import { getAccountConnectionLabel } from '@reizoko/core';
import type { CreateSocialAccountInput, SocialAccount } from '@reizoko/shared';
import { platformRegistry } from '@reizoko/platform-sdk';
import { useAppStore } from '../stores/app-store';
import { getAllPlatformCatalog } from '../platforms/planned-catalog';
import { PlatformIcon } from './PlatformIcon';
import { AccountDialog } from './AccountDialog';
import './accounts-view.css';

export function AccountsView() {
  const accounts = useAppStore((s) => s.accounts);
  const createAccount = useAppStore((s) => s.createAccount);
  const updateAccount = useAppStore((s) => s.updateAccount);
  const removeAccount = useAppStore((s) => s.removeAccount);
  const setAccountActive = useAppStore((s) => s.setAccountActive);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [dialogPlatformId, setDialogPlatformId] = useState<string | undefined>();
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);

  const platforms = useMemo(
    () => getAllPlatformCatalog(platformRegistry).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SocialAccount[]>();
    for (const platform of platforms) {
      map.set(
        platform.id,
        accounts.filter((account) => account.platformId === platform.id && !account.deletedAt),
      );
    }
    return map;
  }, [accounts, platforms]);

  const openCreate = (platformId?: string) => {
    setEditingAccount(null);
    setDialogPlatformId(platformId);
    setDialogOpen(true);
  };

  const openEdit = (account: SocialAccount) => {
    setEditingAccount(account);
    setDialogOpen(true);
    setMenuAccountId(null);
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

  return (
    <div className="accounts-view" data-testid="accounts-view">
      <header className="accounts-view__header">
        <div>
          <div className="accounts-view__title-row">
            <h1>Аккаунты</h1>
            {accounts.filter((account) => !account.deletedAt).length > 0 && (
              <Badge variant="default">{accounts.filter((account) => !account.deletedAt).length}</Badge>
            )}
          </div>
          <p className="accounts-view__subtitle">Локальные профили площадок</p>
          <p className="accounts-view__hint">
            Здесь задаются аккаунты и каналы, для которых вы готовите публикации. Реальное подключение к
            соцсетям появится позже.
          </p>
        </div>
        <Button variant="primary" data-testid="accounts-add" onClick={() => openCreate()}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          Добавить аккаунт
        </Button>
      </header>

      <p className="accounts-view__stage-note">Подключение через API — Stage 3</p>

      {accounts.filter((account) => !account.deletedAt).length === 0 ? (
        <EmptyState
          icon={<Users strokeWidth={1.5} />}
          title="Профили ещё не созданы"
          description="Добавьте локальные профили Instagram, Telegram, VK или других площадок."
          action={
            <Button variant="primary" onClick={() => openCreate()}>
              Добавить аккаунт
            </Button>
          }
        />
      ) : (
        <div className="accounts-view__groups">
          {platforms.map((platform) => {
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
                  {platformAccounts.map((account) => (
                    <article
                      key={account.id}
                      className={`accounts-view__card ${account.isActive ? '' : 'accounts-view__card--inactive'}`}
                      data-testid={`account-card-${account.id}`}
                    >
                      <div className="accounts-view__card-main">
                        <div className="accounts-view__avatar">
                          <PlatformIcon platformId={account.platformId} size={18} />
                        </div>
                        <div>
                          <div className="accounts-view__name">{account.displayName}</div>
                          {account.handle ? (
                            <div className="accounts-view__handle">{account.handle}</div>
                          ) : null}
                          <div className="accounts-view__status">
                            {getAccountConnectionLabel(account.connectionState)}
                            {!account.isActive ? ' · Неактивен' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="accounts-view__menu-wrap">
                        <IconButton
                          label="Действия"
                          size="sm"
                          data-testid={`account-menu-${account.id}`}
                          onClick={() =>
                            setMenuAccountId((current) => (current === account.id ? null : account.id))
                          }
                        >
                          <MoreHorizontal size={16} strokeWidth={2} />
                        </IconButton>
                        {menuAccountId === account.id ? (
                          <div className="accounts-view__menu" role="menu">
                            <button type="button" onClick={() => openEdit(account)}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              onClick={() => void setAccountActive(account.id, !account.isActive)}
                            >
                              {account.isActive ? 'Деактивировать' : 'Активировать'}
                            </button>
                            <button type="button" onClick={() => void removeAccount(account.id)}>
                              Удалить
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
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
    </div>
  );
}
