import {
  VK_CANONICAL_REDIRECT_URI,
  VK_DEFAULT_SERVER_BASE_URL,
  type VkOAuthConfig,
} from '@reizoko/shared';

import type { VkSecretStore, VkSettingsReader } from './vk-config.js';
import {
  VK_APP_ID_SETTING_KEY,
  VK_CLIENT_SECRET_SECRET_KEY,
  VK_SERVER_BASE_URL_SETTING_KEY,
  VK_SERVICE_TOKEN_SECRET_KEY,
} from './vk-config.js';

/** Fields that can block VK OAuth until configured. */
export type VkIntegrationMissingField = 'appId' | 'clientSecret' | 'serviceToken';

/**
 * UX principle: if an action is blocked by missing setup that can be fixed inline,
 * the user should be able to complete it in the current flow — not be redirected elsewhere.
 */
export interface VkIntegrationFormState {
  appId: string;
  serverBaseUrl: string;
  redirectUri: string;
  hasClientSecret: boolean;
  hasServiceToken: boolean;
}

export interface VkIntegrationDraft {
  appId: string;
  serverBaseUrl: string;
  clientSecret?: string;
  serviceToken?: string;
}

export function getVkIntegrationMissingFields(
  state: VkIntegrationFormState,
): VkIntegrationMissingField[] {
  const missing: VkIntegrationMissingField[] = [];
  if (!state.appId.trim()) missing.push('appId');
  if (!state.hasClientSecret) missing.push('clientSecret');
  if (!state.hasServiceToken) missing.push('serviceToken');
  return missing;
}

export function isVkIntegrationComplete(state: VkIntegrationFormState): boolean {
  return getVkIntegrationMissingFields(state).length === 0;
}

/** True when the user has never configured VK (show full first-time setup). */
export function isVkIntegrationInitialSetup(state: VkIntegrationFormState): boolean {
  return (
    !state.appId.trim() &&
    !state.hasClientSecret &&
    !state.hasServiceToken
  );
}

export async function loadVkIntegrationFormState(
  reader: VkSettingsReader,
  secrets: VkSecretStore,
): Promise<VkIntegrationFormState> {
  const appId = (await reader.get(VK_APP_ID_SETTING_KEY))?.trim() ?? '';
  const serverBaseUrl =
    (await reader.get(VK_SERVER_BASE_URL_SETTING_KEY))?.trim() || VK_DEFAULT_SERVER_BASE_URL;
  const clientSecret = await secrets.getSecret(VK_CLIENT_SECRET_SECRET_KEY);
  const serviceToken = await secrets.getSecret(VK_SERVICE_TOKEN_SECRET_KEY);

  return {
    appId,
    serverBaseUrl: serverBaseUrl.replace(/\/+$/, ''),
    redirectUri: VK_CANONICAL_REDIRECT_URI,
    hasClientSecret: Boolean(clientSecret?.trim()),
    hasServiceToken: Boolean(serviceToken?.trim()),
  };
}

export async function buildVkOAuthConfigFromDraft(
  reader: VkSettingsReader,
  secrets: VkSecretStore,
  draft: VkIntegrationDraft,
  current?: VkIntegrationFormState,
): Promise<VkOAuthConfig> {
  const stored = await loadVkOAuthConfigForVerify(reader, secrets);
  return {
    appId: draft.appId.trim() || current?.appId || stored.appId,
    serverBaseUrl: (draft.serverBaseUrl || current?.serverBaseUrl || stored.serverBaseUrl || VK_DEFAULT_SERVER_BASE_URL).replace(
      /\/+$/,
      '',
    ),
    clientSecret: draft.clientSecret?.trim() || stored.clientSecret,
    serviceToken: draft.serviceToken?.trim() || stored.serviceToken,
    redirectUri: VK_CANONICAL_REDIRECT_URI,
  };
}

async function loadVkOAuthConfigForVerify(
  reader: VkSettingsReader,
  secrets: VkSecretStore,
): Promise<VkOAuthConfig> {
  const appId = (await reader.get(VK_APP_ID_SETTING_KEY))?.trim() ?? '';
  const serverBaseUrl =
    (await reader.get(VK_SERVER_BASE_URL_SETTING_KEY))?.trim() || VK_DEFAULT_SERVER_BASE_URL;
  const clientSecret = (await secrets.getSecret(VK_CLIENT_SECRET_SECRET_KEY))?.trim() || null;
  const serviceToken = (await secrets.getSecret(VK_SERVICE_TOKEN_SECRET_KEY))?.trim() || null;

  return {
    appId,
    clientSecret,
    serviceToken,
    serverBaseUrl: serverBaseUrl.replace(/\/+$/, ''),
    redirectUri: VK_CANONICAL_REDIRECT_URI,
  };
}
