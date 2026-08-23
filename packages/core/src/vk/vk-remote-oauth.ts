import { REIZOKO_SERVER_ENDPOINTS } from '@reizoko/shared';

import { buildVkServerUrl } from './vk-config.js';
import { buildVkIdAuthorizeUrl } from './vk-pkce.js';

export interface VkRemoteOAuthSession {
  sessionId: string;
  state: string;
  codeVerifier: string;
  authorizeUrl: string;
}

export interface VkRemoteOAuthPollResult {
  status: 'pending' | 'success' | 'error' | 'expired';
  accessToken?: string;
  userId?: number;
  expiresIn?: number | null;
  scope?: string | null;
  error?: string;
}

export interface VkRemoteDiagnostics {
  ok: boolean;
  configured?: {
    appIdConfigured?: boolean;
    clientSecretConfigured?: boolean;
    serviceTokenConfigured?: boolean;
    redirectUri?: string;
    publicUrl?: string;
    serverUrl?: string;
  };
  error?: string;
}

export async function registerVkRemoteOAuthSession(input: {
  serverBaseUrl: string;
  sessionId: string;
  state: string;
  codeVerifier: string;
  appId: string;
  redirectUri: string;
}): Promise<void> {
  const response = await fetch(buildVkServerUrl(input.serverBaseUrl, REIZOKO_SERVER_ENDPOINTS.vkSession), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: input.sessionId,
      state: input.state,
      codeVerifier: input.codeVerifier,
      appId: input.appId,
      redirectUri: input.redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      typeof body.error === 'string' ? body.error : `Сервер Reizoko ответил с ошибкой (${response.status})`;
    throw new Error(message);
  }
}

export type VkRemoteOAuthStatusPoller = (input: {
  serverBaseUrl: string;
  sessionId: string;
}) => Promise<VkRemoteOAuthPollResult>;

export async function pollVkRemoteOAuthStatus(input: {
  serverBaseUrl: string;
  sessionId: string;
}): Promise<VkRemoteOAuthPollResult> {
  const url = `${buildVkServerUrl(input.serverBaseUrl, REIZOKO_SERVER_ENDPOINTS.vkStatus)}?session=${encodeURIComponent(input.sessionId)}`;
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });
    const body = await response.json().catch(() => ({}));

    if (response.status === 404) {
      return { status: 'expired', error: 'Сессия авторизации истекла.' };
    }

    if (!response.ok) {
      return {
        status: 'error',
        error: typeof body.error === 'string' ? body.error : 'Не удалось получить статус авторизации.',
      };
    }

    if (body.status === 'pending') {
      return { status: 'pending' };
    }

    if (body.status === 'success') {
      return {
        status: 'success',
        accessToken: String(body.accessToken ?? ''),
        userId: Number(body.userId ?? 0),
        expiresIn: body.expiresIn ?? null,
        scope: typeof body.scope === 'string' ? body.scope : null,
      };
    }

    return {
      status: 'error',
      error: typeof body.error === 'string' ? body.error : 'Авторизация ВКонтакте не удалась.',
    };
  } catch {
    return { status: 'pending' };
  }
}

export async function fetchVkRemoteHealth(
  serverBaseUrl: string,
): Promise<{ ok: boolean; version?: string; networkError?: boolean }> {
  try {
    const response = await fetch(buildVkServerUrl(serverBaseUrl, REIZOKO_SERVER_ENDPOINTS.health), { cache: 'no-store' });
    if (!response.ok) return { ok: false };
    const body = await response.json().catch(() => ({}));
    return { ok: Boolean(body.ok), version: typeof body.version === 'string' ? body.version : undefined };
  } catch {
    return { ok: false, networkError: true };
  }
}

export async function fetchVkRemoteDiagnostics(serverBaseUrl: string): Promise<VkRemoteDiagnostics> {
  let response: Response;
  try {
    response = await fetch(buildVkServerUrl(serverBaseUrl, REIZOKO_SERVER_ENDPOINTS.vkDiagnostics), {
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      error: 'Не удалось связаться с сервером Reizoko.',
    };
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: typeof body.error === 'string' ? body.error : `Диагностика недоступна (${response.status})`,
    };
  }
  return {
    ok: Boolean(body.ok),
    configured: body.configured,
  };
}

export function createVkRemoteOAuthSession(input: {
  sessionId: string;
  codeVerifier: string;
  codeChallenge: string;
  appId: string;
  redirectUri: string;
  scope: string;
  prompt?: 'consent' | 'login' | 'none';
}): VkRemoteOAuthSession {
  return {
    sessionId: input.sessionId,
    state: input.sessionId,
    codeVerifier: input.codeVerifier,
    authorizeUrl: buildVkIdAuthorizeUrl({
      appId: input.appId,
      redirectUri: input.redirectUri,
      state: input.sessionId,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      prompt: input.prompt,
    }),
  };
}

export async function waitForVkRemoteOAuthResult(input: {
  serverBaseUrl: string;
  sessionId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  pollStatus?: VkRemoteOAuthStatusPoller;
}): Promise<VkRemoteOAuthPollResult> {
  const timeoutMs = input.timeoutMs ?? 10 * 60 * 1000;
  const pollIntervalMs = input.pollIntervalMs ?? 2000;
  const pollStatus = input.pollStatus ?? pollVkRemoteOAuthStatus;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const result = await pollStatus({
      serverBaseUrl: input.serverBaseUrl,
      sessionId: input.sessionId,
    });
    if (result.status !== 'pending') {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return { status: 'expired', error: 'Истекло время ожидания авторизации ВКонтакте.' };
}
