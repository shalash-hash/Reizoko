import { getPlatformDisplayName } from './platform-display.js';

export type PlatformConnectionCapability = 'none' | 'telegram_bot' | 'future_oauth';

export interface PlatformProfileFormConfig {
  platformId: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  identifierHelp: string;
  localProfileStatusTitle: string;
  localProfileStatusBody: string;
  connectionCapability: PlatformConnectionCapability;
  realConnectionHint?: string;
  realConnectionActionLabel?: string;
}

export const PROFILE_DISPLAY_NAME_LABEL = 'Название профиля в Reizoko';

export const PROFILE_DISPLAY_NAME_PLACEHOLDER = 'Компания';

export const PROFILE_DISPLAY_NAME_HELP =
  'Только для вашего удобства. Например: «Личный», «Компания», «Рабочий проект».';

export const PROFILE_DIALOG_INTRO =
  'Профиль помогает различать ваши аккаунты и страницы внутри Reizoko. Это не вход в социальную сеть.';

const PLATFORM_PROFILE_FORM_CONFIGS: Record<string, PlatformProfileFormConfig> = {
  instagram: {
    platformId: 'instagram',
    identifierLabel: 'Имя пользователя Instagram',
    identifierPlaceholder: '@my_company',
    identifierHelp: 'Необязательно. Публичное имя аккаунта в Instagram.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация в Instagram. Подключение Instagram к Reizoko будет настроено отдельно. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'future_oauth',
  },
  telegram: {
    platformId: 'telegram',
    identifierLabel: 'Имя пользователя или ссылка',
    identifierPlaceholder: '@my_channel',
    identifierHelp:
      'Это только описание профиля. Для реальной публикации подключите Telegram-бота и добавьте канал.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody: 'Для реальной публикации используйте «Подключить Telegram-бота».',
    connectionCapability: 'telegram_bot',
    realConnectionHint: 'Telegram уже поддерживает настоящее подключение.',
    realConnectionActionLabel: 'Подключить Telegram-бота',
  },
  vk: {
    platformId: 'vk',
    identifierLabel: 'Ссылка или короткое имя ВКонтакте',
    identifierPlaceholder: 'vk.com/my_company',
    identifierHelp: 'Необязательно. Можно указать ссылку на страницу или сообщество ВКонтакте.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация во ВКонтакте. Подключение ВКонтакте к Reizoko будет настроено отдельно. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'future_oauth',
  },
  facebook: {
    platformId: 'facebook',
    identifierLabel: 'Ссылка на страницу Facebook',
    identifierPlaceholder: 'facebook.com/my_company',
    identifierHelp: 'Необязательно. Ссылка на страницу или профиль Facebook.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация в Facebook. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'none',
  },
  linkedin: {
    platformId: 'linkedin',
    identifierLabel: 'Ссылка на профиль или страницу LinkedIn',
    identifierPlaceholder: 'linkedin.com/company/my_company',
    identifierHelp: 'Необязательно. Ссылка на профиль или страницу компании.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация в LinkedIn. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'none',
  },
  threads: {
    platformId: 'threads',
    identifierLabel: 'Имя пользователя Threads',
    identifierPlaceholder: '@my_company',
    identifierHelp: 'Необязательно. Публичное имя аккаунта в Threads.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация в Threads. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'none',
  },
  tiktok: {
    platformId: 'tiktok',
    identifierLabel: 'Имя пользователя TikTok',
    identifierPlaceholder: '@my_company',
    identifierHelp: 'Необязательно. Публичное имя аккаунта в TikTok.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация в TikTok. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'none',
  },
  bluesky: {
    platformId: 'bluesky',
    identifierLabel: 'Имя пользователя Bluesky',
    identifierPlaceholder: '@my_company.bsky.social',
    identifierHelp: 'Необязательно. Публичное имя аккаунта в Bluesky.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация в Bluesky. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'none',
  },
  x: {
    platformId: 'x',
    identifierLabel: 'Имя пользователя X',
    identifierPlaceholder: '@my_company',
    identifierHelp: 'Необязательно. Публичное имя аккаунта в X.',
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody:
      'Это не авторизация в X. На этом шаге вы только создаёте профиль для подготовки публикаций.',
    connectionCapability: 'none',
  },
};

function buildDefaultConfig(platformId: string): PlatformProfileFormConfig {
  const platformName = getPlatformDisplayName(platformId);
  return {
    platformId,
    identifierLabel: 'Имя пользователя или ссылка',
    identifierPlaceholder: '@my_company',
    identifierHelp: `Необязательно. Публичное имя или ссылка на ${platformName}.`,
    localProfileStatusTitle: 'Локальный профиль',
    localProfileStatusBody: `Это не авторизация в ${platformName}. На этом шаге вы только создаёте профиль для подготовки публикаций.`,
    connectionCapability: 'none',
  };
}

export function getPlatformProfileFormConfig(platformId: string): PlatformProfileFormConfig {
  return PLATFORM_PROFILE_FORM_CONFIGS[platformId] ?? buildDefaultConfig(platformId);
}

export function normalizePlatformIdentifier(
  platformId: string,
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (platformId === 'vk') {
    let normalized = trimmed.replace(/^https?:\/\//i, '');
    normalized = normalized.replace(/^(www\.)?vk\.com\//i, '');
    normalized = normalized.replace(/^@/, '');
    return normalized || null;
  }

  return trimmed;
}
