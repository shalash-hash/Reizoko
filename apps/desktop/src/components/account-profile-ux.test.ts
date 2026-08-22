import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProfileFormConfig } from '@reizoko/core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platformSelectSource = readFileSync(path.join(root, 'components/PlatformSelect.tsx'), 'utf8');
const platformSelectCss = readFileSync(path.join(root, 'components/platform-select.css'), 'utf8');
const accountDialogSource = readFileSync(path.join(root, 'components/AccountDialog.tsx'), 'utf8');
const accountsViewSource = readFileSync(path.join(root, 'components/AccountsView.tsx'), 'utf8');

describe('platform select UX', () => {
  it('styles full-row hover for available platforms with platform tint', () => {
    expect(platformSelectCss).toContain('.platform-select__option:not(.platform-select__option--planned):hover');
    expect(platformSelectCss).toContain('--platform-option-tint');
    expect(platformSelectSource).toContain('data-platform={platform.id}');
    expect(platformSelectSource).toContain('getPlatformBrandColor');
  });

  it('uses muted neutral hover for planned platforms', () => {
    expect(platformSelectCss).toContain('.platform-select__option--planned:hover');
    expect(platformSelectCss).toContain('.platform-select__option--planned.platform-select__option--keyboard-active');
  });

  it('keeps keyboard focus distinct from mouse hover', () => {
    expect(platformSelectSource).toContain('platform-select__option--keyboard-active');
    expect(platformSelectSource).toContain('keyboardIndex');
    expect(platformSelectCss).toContain(':focus-visible');
    expect(platformSelectCss).toContain('--keyboard-active:not(:hover)');
  });
});

describe('account profile dialog UX', () => {
  it('does not expose Handle term in user-facing labels', () => {
    expect(accountDialogSource).not.toContain('Handle / username');
    expect(accountDialogSource).not.toMatch(/<span>[^<{]*Handle/i);
    expect(accountDialogSource).not.toContain('username');
    expect(accountDialogSource).toContain('PROFILE_DISPLAY_NAME_LABEL');
    expect(accountDialogSource).toContain('formConfig.identifierLabel');
  });

  it('uses platform-specific config for VK and Instagram', () => {
    expect(getPlatformProfileFormConfig('vk').identifierLabel).toBe('Ссылка или короткое имя ВКонтакте');
    expect(getPlatformProfileFormConfig('instagram').identifierLabel).toBe('Имя пользователя Instagram');
  });

  it('explains local profile and keeps telegram real connect separate', () => {
    expect(accountDialogSource).toContain('account-telegram-connect-card');
    expect(accountDialogSource).toContain('account-local-profile-status');
    expect(accountsViewSource).toContain('telegram-connect-bot');
    expect(accountsViewSource).toContain('onConnectTelegram');
    expect(getPlatformProfileFormConfig('telegram').realConnectionActionLabel).toBe('Подключить Telegram-бота');
  });

  it('allows optional identifier and normalizes on save', () => {
    expect(accountDialogSource).toContain('normalizePlatformIdentifier');
    expect(accountDialogSource).toContain('handle: normalizePlatformIdentifier');
    expect(accountDialogSource).not.toContain('required');
  });

  it('creates local profile without connection flow in dialog', () => {
    expect(accountDialogSource).not.toMatch(/парол/i);
    expect(accountDialogSource).not.toMatch(/токен/i);
    expect(accountDialogSource).not.toMatch(/Войти|Авториз/i);
    expect(accountDialogSource).toContain('Добавить профиль');
    expect(accountsViewSource).not.toContain('Добавить аккаунт');
    expect(accountsViewSource).toContain('Добавить профиль');
  });
});
