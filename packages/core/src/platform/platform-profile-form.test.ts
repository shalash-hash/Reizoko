import { describe, expect, it } from 'vitest';
import {
  getPlatformProfileFormConfig,
  normalizePlatformIdentifier,
  PROFILE_DISPLAY_NAME_LABEL,
} from './platform-profile-form.js';

describe('platform profile form config', () => {
  it('uses Russian VK identifier label', () => {
    const config = getPlatformProfileFormConfig('vk');
    expect(config.identifierLabel).toBe('Ссылка или короткое имя ВКонтакте');
    expect(config.identifierLabel).not.toMatch(/handle/i);
    expect(config.identifierLabel).not.toMatch(/username/i);
  });

  it('uses Instagram username label', () => {
    const config = getPlatformProfileFormConfig('instagram');
    expect(config.identifierLabel).toBe('Имя пользователя Instagram');
    expect(config.identifierPlaceholder).toBe('@my_company');
  });

  it('explains Telegram real connection separately from local profile', () => {
    const config = getPlatformProfileFormConfig('telegram');
    expect(config.connectionCapability).toBe('telegram_bot');
    expect(config.realConnectionHint).toContain('настоящее подключение');
    expect(config.identifierHelp).toContain('Telegram-бота');
    expect(config.localProfileStatusBody).toContain('Подключить Telegram-бота');
  });

  it('keeps shared display name label human-readable', () => {
    expect(PROFILE_DISPLAY_NAME_LABEL).toBe('Название профиля в Reizoko');
    expect(PROFILE_DISPLAY_NAME_LABEL).not.toContain('компании');
  });

  it('normalizes VK links and short names', () => {
    expect(normalizePlatformIdentifier('vk', 'vk.com/reizoko')).toBe('reizoko');
    expect(normalizePlatformIdentifier('vk', 'https://vk.com/reizoko')).toBe('reizoko');
    expect(normalizePlatformIdentifier('vk', 'reizoko')).toBe('reizoko');
    expect(normalizePlatformIdentifier('vk', '   ')).toBeNull();
  });

  it('keeps optional identifier empty', () => {
    expect(normalizePlatformIdentifier('instagram', '')).toBeNull();
    expect(normalizePlatformIdentifier('instagram', '@brand')).toBe('@brand');
  });
});
