import { invoke } from '@tauri-apps/api/core';
import type { VkRemoteOAuthPollResult, VkServerProbeStep } from '@reizoko/core';

interface RustVkServerProbeStep {
  id: string;
  label: string;
  channel: string;
  status: string;
  url?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  detail?: string | null;
  meta?: Record<string, unknown> | null;
}

function mapRustProbeStep(step: RustVkServerProbeStep): VkServerProbeStep {
  return {
    id: step.id,
    label: step.label,
    channel: step.channel === 'native' ? 'native' : 'webview',
    status:
      step.status === 'ok' || step.status === 'fail' || step.status === 'warn' || step.status === 'skip'
        ? step.status
        : 'fail',
    url: step.url ?? undefined,
    httpStatus: step.httpStatus ?? undefined,
    durationMs: step.durationMs ?? undefined,
    detail: step.detail ?? undefined,
    meta: step.meta ?? undefined,
  };
}

export async function probeVkServerFromNative(serverBaseUrl: string): Promise<VkServerProbeStep[]> {
  const steps = await invoke<RustVkServerProbeStep[]>('vk_probe_reizoko_server', {
    serverBaseUrl,
  });
  return steps.map(mapRustProbeStep);
}

interface RustVkOAuthPollResult {
  status: string;
  accessToken?: string | null;
  userId?: number | null;
  expiresIn?: number | null;
  scope?: string | null;
  error?: string | null;
}

export async function pollVkOAuthStatusFromNative(input: {
  serverBaseUrl: string;
  sessionId: string;
}): Promise<VkRemoteOAuthPollResult> {
  try {
    const result = await invoke<RustVkOAuthPollResult>('vk_poll_oauth_status', {
      serverBaseUrl: input.serverBaseUrl,
      sessionId: input.sessionId,
    });

    if (result.status === 'pending') {
      return { status: 'pending' };
    }
    if (result.status === 'expired') {
      return { status: 'expired', error: result.error ?? 'Сессия авторизации истекла.' };
    }
    if (result.status === 'success') {
      return {
        status: 'success',
        accessToken: result.accessToken ?? '',
        userId: Number(result.userId ?? 0),
        expiresIn: result.expiresIn ?? null,
        scope: result.scope ?? null,
      };
    }
    return {
      status: 'error',
      error: result.error ?? 'Авторизация ВКонтакте не удалась.',
    };
  } catch {
    return { status: 'pending' };
  }
}
