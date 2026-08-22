export const PLATFORM_BRAND_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  telegram: '#0088CC',
  vk: '#0077FF',
  facebook: '#1877F2',
  threads: '#000000',
  x: '#000000',
  tiktok: '#010101',
  linkedin: '#0A66C2',
  bluesky: '#0085FF',
};

export function getPlatformBrandColor(platformId: string): string | undefined {
  return PLATFORM_BRAND_COLORS[platformId];
}
