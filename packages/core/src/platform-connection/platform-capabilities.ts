import type {
  ConnectionCapabilities,
  DesktopFeasibility,
  MediaDeliveryMode,
} from '@reizoko/shared';

export const PLATFORM_CONNECTION_CAPABILITIES: Record<string, ConnectionCapabilities> = {
  telegram: {
    platformId: 'telegram',
    methods: ['bot_token', 'native_authorization'],
    desktopFeasibility: 'fully_desktop',
    mediaDeliveryModes: ['direct_binary', 'multipart', 'public_url'],
    requiresPublicMediaUrl: false,
    supportsOAuthSystemBrowser: false,
    supportsRefresh: false,
    supportsRevoke: true,
    supportedContentTypes: ['text', 'image', 'video', 'carousel'],
  },
  vk: {
    platformId: 'vk',
    methods: ['oauth_system_browser', 'manual_secret'],
    desktopFeasibility: 'desktop_with_limitations',
    mediaDeliveryModes: ['platform_upload_session', 'direct_binary', 'multipart'],
    requiresPublicMediaUrl: false,
    supportsOAuthSystemBrowser: true,
    supportsRefresh: true,
    supportsRevoke: true,
    supportedContentTypes: ['text', 'image', 'video', 'link'],
  },
  instagram: {
    platformId: 'instagram',
    methods: ['oauth_system_browser'],
    desktopFeasibility: 'requires_external_media_delivery',
    mediaDeliveryModes: ['public_url', 'platform_upload_session'],
    requiresPublicMediaUrl: true,
    supportsOAuthSystemBrowser: true,
    supportsRefresh: true,
    supportsRevoke: true,
    supportedContentTypes: ['image', 'carousel', 'video', 'reels', 'stories'],
  },
};

export function getConnectionCapabilities(platformId: string): ConnectionCapabilities | null {
  return PLATFORM_CONNECTION_CAPABILITIES[platformId] ?? null;
}

export function getDesktopFeasibilityLabel(feasibility: DesktopFeasibility): string {
  switch (feasibility) {
    case 'fully_desktop':
      return 'Fully desktop';
    case 'desktop_with_limitations':
      return 'Desktop with limitations';
    case 'requires_external_media_delivery':
      return 'Requires external media delivery';
    default:
      return 'Not supported';
  }
}

export function getSupportedMediaDeliveryModes(platformId: string): MediaDeliveryMode[] {
  return getConnectionCapabilities(platformId)?.mediaDeliveryModes ?? [];
}
