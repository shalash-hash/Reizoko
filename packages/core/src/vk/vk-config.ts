import {
  VK_CANONICAL_REDIRECT_URI,
  VK_DEFAULT_SERVER_BASE_URL,
  buildReizokoServerUrl,
  type VkOAuthConfig,
} from '@reizoko/shared';
export const VK_APP_ID_SETTING_KEY = 'vk.oauth.app_id';
export const VK_SERVER_BASE_URL_SETTING_KEY = 'vk.server.base_url';
export const VK_CLIENT_SECRET_SECRET_KEY = 'settings/vk/client_secret';
export const VK_SERVICE_TOKEN_SECRET_KEY = 'settings/vk/service_token';

export const DEFAULT_VK_OAUTH_CONFIG: VkOAuthConfig = {
  appId: '',
  clientSecret: null,
  serviceToken: null,
  serverBaseUrl: VK_DEFAULT_SERVER_BASE_URL,
  redirectUri: VK_CANONICAL_REDIRECT_URI,
};

export interface VkSettingsReader {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface VkSecretStore {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}

export async function loadVkOAuthConfig(
  reader: VkSettingsReader,
  secrets?: VkSecretStore,
): Promise<VkOAuthConfig> {
  const appId = (await reader.get(VK_APP_ID_SETTING_KEY))?.trim() ?? '';
  const serverBaseUrl =
    (await reader.get(VK_SERVER_BASE_URL_SETTING_KEY))?.trim() || VK_DEFAULT_SERVER_BASE_URL;
  const clientSecret = secrets
    ? (await secrets.getSecret(VK_CLIENT_SECRET_SECRET_KEY))?.trim() || null
    : null;
  const serviceToken = secrets
    ? (await secrets.getSecret(VK_SERVICE_TOKEN_SECRET_KEY))?.trim() || null
    : null;

  return {
    appId,
    clientSecret,
    serviceToken,
    serverBaseUrl: serverBaseUrl.replace(/\/+$/, ''),
    redirectUri: VK_CANONICAL_REDIRECT_URI,
  };
}

export async function saveVkOAuthConfig(
  reader: VkSettingsReader,
  secrets: VkSecretStore,
  config: VkOAuthConfig,
): Promise<void> {
  await reader.set(VK_APP_ID_SETTING_KEY, config.appId.trim());
  await reader.set(VK_SERVER_BASE_URL_SETTING_KEY, (config.serverBaseUrl ?? VK_DEFAULT_SERVER_BASE_URL).replace(/\/+$/, ''));
  if (config.clientSecret?.trim()) {
    await secrets.setSecret(VK_CLIENT_SECRET_SECRET_KEY, config.clientSecret.trim());
  }
  if (config.serviceToken?.trim()) {
    await secrets.setSecret(VK_SERVICE_TOKEN_SECRET_KEY, config.serviceToken.trim());
  }
}

export function validateVkOAuthConfig(config: VkOAuthConfig): string | null {
  if (!config.appId.trim()) {
    return 'Укажите ID приложения VK в настройках Reizoko.';
  }
  if (!config.serverBaseUrl?.trim()) {
    return 'Укажите адрес сервера Reizoko в настройках.';
  }
  return null;
}

export function buildVkServerUrl(baseUrl: string, path: string): string {
  return buildReizokoServerUrl(baseUrl, path.startsWith('/') ? path : `/${path}`);
}