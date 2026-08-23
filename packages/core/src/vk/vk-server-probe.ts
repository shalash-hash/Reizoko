import { REIZOKO_SERVER_ENDPOINTS, VK_DEFAULT_SERVER_BASE_URL } from '@reizoko/shared';
import { buildVkServerUrl } from './vk-config.js';

export type VkServerProbeChannel = 'webview' | 'native';

export type VkServerProbeStepStatus = 'ok' | 'fail' | 'warn' | 'skip';

export interface VkServerProbeStep {
  id: string;
  label: string;
  channel: VkServerProbeChannel;
  status: VkServerProbeStepStatus;
  url?: string;
  httpStatus?: number;
  durationMs?: number;
  detail?: string;
  meta?: Record<string, unknown>;
}

export interface VkServerProbeResult {
  ok: boolean;
  serverBaseUrl: string;
  steps: VkServerProbeStep[];
}

export type VkServerProbeLogger = (step: VkServerProbeStep) => void;

const defaultLogger: VkServerProbeLogger = (step) => {
  if (typeof console !== 'undefined' && typeof console.info === 'function') {
    console.info('[reizoko:vk-probe]', step);
  }
};

function normalizeServerBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function formatFetchError(error: unknown): string {
  if (error instanceof TypeError) {
    return error.message || 'TypeError (сеть или CORS)';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function probeHttpGet(input: {
  channel: VkServerProbeChannel;
  id: string;
  label: string;
  url: string;
  logger: VkServerProbeLogger;
  expectJson?: boolean;
}): Promise<VkServerProbeStep> {
  const started = Date.now();
  try {
    const response = await fetch(input.url, { cache: 'no-store', method: 'GET' });
    const durationMs = Date.now() - started;
    const contentType = response.headers.get('content-type') ?? '';
    let detail = `HTTP ${response.status}, ${durationMs} ms`;
    if (contentType) detail += `, Content-Type: ${contentType}`;

    if (!response.ok) {
      return logStep(input.logger, {
        id: input.id,
        label: input.label,
        channel: input.channel,
        status: 'fail',
        url: input.url,
        httpStatus: response.status,
        durationMs,
        detail,
      });
    }

    if (input.expectJson) {
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') {
        return logStep(input.logger, {
          id: input.id,
          label: input.label,
          channel: input.channel,
          status: 'fail',
          url: input.url,
          httpStatus: response.status,
          durationMs,
          detail: `${detail}; ответ не JSON`,
        });
      }
      detail += `; JSON ok`;
      if (input.id === 'diagnostics' && body.configured && typeof body.configured === 'object') {
        return logStep(input.logger, {
          id: input.id,
          label: input.label,
          channel: input.channel,
          status: response.ok ? 'ok' : 'fail',
          url: input.url,
          httpStatus: response.status,
          durationMs,
          detail,
          meta: { configured: body.configured, serverOk: body.ok === true },
        });
      }
    }

    return logStep(input.logger, {
      id: input.id,
      label: input.label,
      channel: input.channel,
      status: 'ok',
      url: input.url,
      httpStatus: response.status,
      durationMs,
      detail,
    });
  } catch (error) {
    return logStep(input.logger, {
      id: input.id,
      label: input.label,
      channel: input.channel,
      status: 'fail',
      url: input.url,
      durationMs: Date.now() - started,
      detail: formatFetchError(error),
    });
  }
}

function logStep(logger: VkServerProbeLogger, step: VkServerProbeStep): VkServerProbeStep {
  logger(step);
  return step;
}

export async function probeVkServerFromWebview(
  serverBaseUrl: string,
  logger: VkServerProbeLogger = defaultLogger,
): Promise<VkServerProbeResult> {
  const normalized = normalizeServerBaseUrl(serverBaseUrl);
  const steps: VkServerProbeStep[] = [];

  if (!normalized) {
    steps.push(
      logStep(logger, {
        id: 'url-empty',
        label: 'Адрес сервера',
        channel: 'webview',
        status: 'fail',
        detail: 'Пустой URL сервера Reizoko',
      }),
    );
    return { ok: false, serverBaseUrl: normalized, steps };
  }

  if (!/^https:\/\//i.test(normalized)) {
    steps.push(
      logStep(logger, {
        id: 'url-scheme',
        label: 'Протокол сервера',
        channel: 'webview',
        status: 'warn',
        detail: 'Рекомендуется HTTPS. Указан нестандартный протокол.',
      }),
    );
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.pathname && parsed.pathname !== '/') {
      steps.push(
        logStep(logger, {
          id: 'url-path',
          label: 'Путь сервера',
          channel: 'webview',
          status: 'warn',
          detail: `Ожидается корень домена без пути. Сейчас: ${parsed.pathname}`,
        }),
      );
    }
  } catch {
    steps.push(
      logStep(logger, {
        id: 'url-invalid',
        label: 'Адрес сервера',
        channel: 'webview',
        status: 'fail',
        detail: 'Некорректный URL сервера Reizoko',
      }),
    );
    return { ok: false, serverBaseUrl: normalized, steps };
  }

  if (normalized !== VK_DEFAULT_SERVER_BASE_URL.replace(/\/+$/, '')) {
    steps.push(
      logStep(logger, {
        id: 'url-host',
        label: 'Адрес сервера',
        channel: 'webview',
        status: 'warn',
        detail: `Канонический адрес: ${VK_DEFAULT_SERVER_BASE_URL}`,
      }),
    );
  }
  steps.push(
    await probeHttpGet({
      channel: 'webview',
      id: 'health',
      label: 'Health endpoint (WebView fetch)',
      url: buildVkServerUrl(normalized, REIZOKO_SERVER_ENDPOINTS.health),
      logger,
      expectJson: true,
    }),
  );

  steps.push(
    await probeHttpGet({
      channel: 'webview',
      id: 'diagnostics',
      label: 'Diagnostics endpoint (WebView fetch)',
      url: buildVkServerUrl(normalized, REIZOKO_SERVER_ENDPOINTS.vkDiagnostics),
      logger,
      expectJson: true,
    }),
  );

  steps.push(
    await probeHttpGet({
      channel: 'webview',
      id: 'callback',
      label: 'OAuth callback (WebView fetch)',
      url: buildVkServerUrl(normalized, REIZOKO_SERVER_ENDPOINTS.vkCallback),
      logger,
    }),
  );

  const ok = steps.every((step) => step.status !== 'fail');
  return { ok, serverBaseUrl: normalized, steps };
}

export function mergeVkServerProbeResults(
  results: VkServerProbeResult[],
): VkServerProbeStep[] {
  return results.flatMap((result) => result.steps);
}
