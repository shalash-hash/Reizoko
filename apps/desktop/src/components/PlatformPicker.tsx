import { useEffect, useMemo } from 'react';

import type { PlatformAdapter } from '@reizoko/platform-sdk';

import type { OpenPlatformTarget, SocialAccount } from '@reizoko/shared';

import { isTargetOpen } from '@reizoko/core';

import { Button, IconButton } from '@reizoko/ui';

import { Check, X } from 'lucide-react';

import { groupPlatformsByAvailability } from '../platforms/planned-catalog';
import { PlatformIcon } from './PlatformIcon';

import './platform-picker.css';



interface PlatformPickerProps {

  platforms: PlatformAdapter[];

  openTargets: OpenPlatformTarget[];

  accounts: SocialAccount[];

  onSelect: (platformId: string, socialAccountId?: string | null) => void;

  onClose: () => void;

}



export function PlatformPicker({

  platforms,

  openTargets,

  accounts,

  onSelect,

  onClose,

}: PlatformPickerProps) {

  useEffect(() => {

    const onKeyDown = (event: KeyboardEvent) => {

      if (event.key === 'Escape') onClose();

    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);

  }, [onClose]);



  const selectableAccounts = accounts.filter((account) => account.isActive && !account.deletedAt);
  const { available, planned } = useMemo(() => groupPlatformsByAvailability(platforms), [platforms]);

  const renderPlatformGroup = (platform: PlatformAdapter) => {
    const platformAccounts = selectableAccounts.filter(
      (account) => account.platformId === platform.id,
    );
    const generalOpen = isTargetOpen(openTargets, platform.id, null);

    return (
      <section key={platform.id} className="platform-picker__group">
        <div
          className={`platform-picker__group-title ${!platform.available ? 'platform-picker__group-title--planned' : ''}`}
        >
          <PlatformIcon platformId={platform.id} size={20} muted={!platform.available} />
          <span className="platform-picker__group-name">{platform.name}</span>
          {!platform.available ? (
            <span className="platform-picker__group-status">Preview пока недоступен</span>
          ) : null}
        </div>

        <div className="platform-picker__options">
          <button
            type="button"
            className={`platform-picker__option ${generalOpen ? 'platform-picker__option--open' : ''}`}
            data-testid={`platform-picker-general-${platform.id}`}
            onClick={() => onSelect(platform.id, null)}
          >
            <span>Общий preview</span>
            {generalOpen ? (
              <span className="platform-picker__option-status">
                <Check size={12} strokeWidth={2.5} aria-hidden />
                Открыто
              </span>
            ) : null}
          </button>

          {platformAccounts.map((account) => {
            const open = isTargetOpen(openTargets, platform.id, account.id);
            return (
              <button
                key={account.id}
                type="button"
                className={`platform-picker__option ${open ? 'platform-picker__option--open' : ''}`}
                data-testid={`platform-picker-account-${account.id}`}
                onClick={() => onSelect(platform.id, account.id)}
              >
                <span>
                  {account.displayName}
                  {account.handle ? (
                    <small className="platform-picker__option-handle">{account.handle}</small>
                  ) : null}
                </span>
                {open ? (
                  <span className="platform-picker__option-status">
                    <Check size={12} strokeWidth={2.5} aria-hidden />
                    Открыто
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>
    );
  };



  return (

    <div className="platform-picker-overlay" onClick={onClose} role="presentation">

      <div

        className="platform-picker"

        data-testid="platform-picker"

        onClick={(e) => e.stopPropagation()}

        role="dialog"

        aria-modal="true"

        aria-label="Добавить площадку"

      >

        <header className="platform-picker__header">

          <div className="platform-picker__header-text">

            <h3>Добавить площадку</h3>

            <p>Выберите preview или конкретный локальный профиль</p>

          </div>

          <IconButton label="Закрыть" size="sm" data-testid="platform-picker-close" onClick={onClose}>

            <X size={18} strokeWidth={2} aria-hidden />

          </IconButton>

        </header>



        <div className="platform-picker__groups">
          {available.map((platform) => renderPlatformGroup(platform))}

          {planned.length > 0 ? (
            <div className="platform-picker__availability-section">
              <div className="platform-picker__availability-label">Скоро</div>
              {planned.map((platform) => renderPlatformGroup(platform))}
            </div>
          ) : null}
        </div>



        <footer className="platform-picker__footer">

          <Button variant="ghost" onClick={onClose}>

            Отмена

          </Button>

          <Button variant="primary" data-testid="platform-picker-done" onClick={onClose}>

            Готово

          </Button>

        </footer>

      </div>

    </div>

  );

}


