import type { PlatformAdapter } from '@reizoko/platform-sdk';

export const PLANNED_PLATFORMS: PlatformAdapter[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: '👤',
    color: '#1877F2',
    available: false,
    plannedMessage: 'Запланировано — будет доступно позже',
    capabilities: {
      supportsHeadings: false,
      supportsMultipleImages: true,
      supportsVideo: true,
      supportsLinks: true,
    },
    transform: () => ({ text: '', images: [], warnings: [] }),
    validate: () => [],
  },
  {
    id: 'threads',
    name: 'Threads',
    icon: '@',
    color: '#000000',
    available: false,
    plannedMessage: 'Запланировано — будет доступно позже',
    capabilities: {
      supportsHeadings: false,
      supportsMultipleImages: true,
      supportsVideo: true,
      supportsLinks: true,
    },
    transform: () => ({ text: '', images: [], warnings: [] }),
    validate: () => [],
  },
  {
    id: 'x',
    name: 'X',
    icon: '𝕏',
    color: '#000000',
    available: false,
    plannedMessage: 'Запланировано — будет доступно позже',
    capabilities: {
      maxTextLength: 280,
      supportsHeadings: false,
      supportsMultipleImages: true,
      supportsVideo: true,
      supportsLinks: true,
    },
    transform: () => ({ text: '', images: [], warnings: [] }),
    validate: () => [],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '♪',
    color: '#010101',
    available: false,
    plannedMessage: 'Запланировано — будет доступно позже',
    capabilities: {
      supportsHeadings: false,
      supportsMultipleImages: false,
      supportsVideo: true,
      supportsLinks: false,
    },
    transform: () => ({ text: '', images: [], warnings: [] }),
    validate: () => [],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'in',
    color: '#0A66C2',
    available: false,
    plannedMessage: 'Запланировано — будет доступно позже',
    capabilities: {
      supportsHeadings: true,
      supportsMultipleImages: true,
      supportsVideo: true,
      supportsLinks: true,
    },
    transform: () => ({ text: '', images: [], warnings: [] }),
    validate: () => [],
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: '🦋',
    color: '#0085FF',
    available: false,
    plannedMessage: 'Запланировано — будет доступно позже',
    capabilities: {
      maxTextLength: 300,
      supportsHeadings: false,
      supportsMultipleImages: true,
      supportsVideo: false,
      supportsLinks: true,
    },
    transform: () => ({ text: '', images: [], warnings: [] }),
    validate: () => [],
  },
];

export function getAllPlatformCatalog(platformRegistry: {
  getCatalog: () => Array<{ adapter: PlatformAdapter }>;
}): PlatformAdapter[] {
  const registered = platformRegistry.getCatalog().map((p) => p.adapter);
  const registeredIds = new Set(registered.map((p) => p.id));
  const planned = PLANNED_PLATFORMS.filter((p) => !registeredIds.has(p.id));
  return [...registered, ...planned];
}
