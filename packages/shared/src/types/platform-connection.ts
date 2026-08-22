export type ConnectionMethod =
  | 'oauth_system_browser'
  | 'oauth_embedded'
  | 'bot_token'
  | 'native_authorization'
  | 'manual_secret';

export type PlatformConnectionState =
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'needs_reconnect'
  | 'error';

export type MediaDeliveryMode =
  | 'direct_binary'
  | 'multipart'
  | 'platform_upload_session'
  | 'public_url';

export type DesktopFeasibility =
  | 'fully_desktop'
  | 'desktop_with_limitations'
  | 'requires_external_media_delivery'
  | 'not_supported';

export interface ConnectionCapabilities {
  platformId: string;
  methods: ConnectionMethod[];
  desktopFeasibility: DesktopFeasibility;
  mediaDeliveryModes: MediaDeliveryMode[];
  /** When true, publisher must supply a publicly reachable media URL. */
  requiresPublicMediaUrl: boolean;
  supportsOAuthSystemBrowser: boolean;
  supportsRefresh: boolean;
  supportsRevoke: boolean;
  supportedContentTypes: Array<'text' | 'image' | 'carousel' | 'video' | 'reels' | 'stories' | 'link'>;
}

/** Credential / authenticated identity — not a publication destination. */
export interface PlatformConnection {
  id: string;
  platformId: string;
  method: ConnectionMethod;
  state: PlatformConnectionState;
  externalIdentityId?: string | null;
  displayName?: string | null;
  handle?: string | null;
  connectedAt?: string | null;
  lastValidatedAt?: string | null;
  /** Opaque key for SecretStore — never the secret value itself. */
  secretRef?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionRequest {
  platformId: string;
  method: ConnectionMethod;
}

export interface ConnectionResult {
  connection: PlatformConnection;
}

export interface ConnectionValidation {
  valid: boolean;
  state: PlatformConnectionState;
  errorMessage?: string;
}

export type SecretPurpose =
  | 'access_token'
  | 'refresh_token'
  | 'bot_token'
  | 'api_hash'
  | 'session'
  | 'service_token';

export function buildSecretRef(connectionId: string, purpose: SecretPurpose): string {
  return `connection/${connectionId}/${purpose}`;
}

export function parseSecretRef(secretRef: string): { connectionId: string; purpose: SecretPurpose } | null {
  const match = /^connection\/([^/]+)\/([a-z_]+)$/.exec(secretRef);
  if (!match) return null;
  return { connectionId: match[1], purpose: match[2] as SecretPurpose };
}
