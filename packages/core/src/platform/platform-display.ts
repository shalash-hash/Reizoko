export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  telegram: 'Телеграм',
  vk: 'ВКонтакте',
  facebook: 'Facebook',
  threads: 'Threads',
  x: 'X',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  bluesky: 'Bluesky',
};

export function getPlatformDisplayName(platformId: string, fallback?: string): string {
  return PLATFORM_DISPLAY_NAMES[platformId] ?? fallback ?? platformId;
}
