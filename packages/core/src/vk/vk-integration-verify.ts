import { VK_CANONICAL_REDIRECT_URI, type VkOAuthConfig } from '@reizoko/shared';

import { probeVkServerFromWebview, type VkServerProbeStep } from './vk-server-probe.js';

export interface VkIntegrationVerificationResult {
  ok: boolean;
  message: string;
  details?: string[];
  trace?: VkServerProbeStep[];
}
export async function verifyVkIntegrationSettings(
  config: VkOAuthConfig,
  options?: { nativeProbeSteps?: VkServerProbeStep[] },
): Promise<VkIntegrationVerificationResult> {
  const issues: string[] = [];
  const notes: string[] = [];
  const trace: VkServerProbeStep[] = [];

  if (!config.appId?.trim()) {
    issues.push('Не указан ID приложения.');
  }

  if (!config.clientSecret?.trim()) {
    issues.push('Не указан защищённый ключ VK.');
  }

  if (!config.serviceToken?.trim()) {
    issues.push('Не указан сервисный ключ доступа VK.');
  }

  const serverBaseUrl = (config.serverBaseUrl ?? '').replace(/\/+$/, '');
  if (!serverBaseUrl) {
    issues.push('Не указан адрес сервера Reizoko.');
  } else {
    const webProbe = await probeVkServerFromWebview(serverBaseUrl);
    trace.push(...webProbe.steps);
    if (options?.nativeProbeSteps?.length) {
      trace.push(...options.nativeProbeSteps);
    }

    const webHealth = webProbe.steps.find((step) => step.id === 'health' && step.channel === 'webview');
    const nativeHealth = options?.nativeProbeSteps?.find(
      (step) => step.id === 'health' && step.channel === 'native',
    );

    const serverReachable = webHealth?.status === 'ok' || nativeHealth?.status === 'ok';

    if (!serverReachable) {
      const failed = webHealth?.detail || nativeHealth?.detail;
      issues.push(
        failed
          ? `Не удалось связаться с сервером Reizoko: ${failed}`
          : 'Не удалось связаться с сервером Reizoko.',
      );
    } else if (webHealth?.status === 'fail' && nativeHealth?.status === 'ok') {
      notes.push(
        'WebView fetch не прошёл (часто CORS), но нативная проверка успешна. Для OAuth убедитесь, что на сервере включены CORS-заголовки.',
      );
    }

    const webDiagnostics = webProbe.steps.find(
      (step) => step.id === 'diagnostics' && step.channel === 'webview',
    );
    const nativeDiagnostics = options?.nativeProbeSteps?.find(
      (step) => step.id === 'diagnostics' && step.channel === 'native',
    );
    const diagnosticsStep = webDiagnostics?.status === 'ok' ? webDiagnostics : nativeDiagnostics;

    if (diagnosticsStep?.status === 'fail') {
      issues.push(diagnosticsStep.detail ?? 'Диагностика сервера недоступна.');
    } else if (diagnosticsStep?.status === 'ok') {
      const configured = diagnosticsStep.meta?.configured as
        | {
            appIdConfigured?: boolean;
            clientSecretConfigured?: boolean;
            serviceTokenConfigured?: boolean;
            redirectUri?: string;
            storageWritable?: boolean;
            oauthAppKind?: string;
            appId?: string | null;
          }
        | undefined;
      if (configured) {
        if (!configured.appIdConfigured) {
          issues.push('На сервере не настроен VK_APP_ID (файл .env).');
        }
        if (!configured.serviceTokenConfigured && configured.oauthAppKind === 'confidential') {
          issues.push(
            'На сервере не настроен VK_SERVICE_TOKEN (файл .env). Он обязателен для confidential-приложения VK ID.',
          );
        }
        const serverAppId =
          typeof configured.appId === 'string' ? configured.appId.trim() : '';
        if (serverAppId && config.appId.trim() && serverAppId !== config.appId.trim()) {
          issues.push(
            `VK_APP_ID на сервере (${serverAppId}) не совпадает с ID приложения в Reizoko (${config.appId.trim()}).`,
          );
        }
        if (configured.storageWritable === false) {
          issues.push('PHP не может записывать OAuth-сессии в server/storage/oauth на хостинге.');
        }
        if (configured.redirectUri && configured.redirectUri !== VK_CANONICAL_REDIRECT_URI) {
          issues.push('Redirect URI на сервере не совпадает с каноническим значением Reizoko.');
        }
      }
    } else if (!nativeDiagnostics && webDiagnostics?.status === 'fail') {
      issues.push('Диагностика сервера недоступна из приложения.');
    }

    const webCallback = webProbe.steps.find((step) => step.id === 'callback' && step.channel === 'webview');
    const nativeCallback = options?.nativeProbeSteps?.find(
      (step) => step.id === 'callback' && step.channel === 'native',
    );
    const callbackFailed =
      webCallback?.status === 'fail' && (!nativeCallback || nativeCallback.status === 'fail');
    if (callbackFailed) {
      issues.push('Callback Reizoko недоступен. Убедитесь, что на хостинге загружен vk-callback.php.');
    }
  }

  const redirectUri = config.redirectUri ?? VK_CANONICAL_REDIRECT_URI;
  if (redirectUri !== VK_CANONICAL_REDIRECT_URI) {
    issues.push('Redirect URI в настройках Reizoko отличается от канонического.');
  }

  if (issues.length === 0) {
    return {
      ok: true,
      message: 'Настройки готовы',
      details: notes.length ? notes : undefined,
      trace,
    };
  }

  return {
    ok: false,
    message: issues[0]!,
    details: [...notes, ...(issues.length > 1 ? issues.slice(1) : [])],
    trace,
  };
}
