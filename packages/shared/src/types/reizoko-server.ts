/** Canonical production base URL (web-root of zasian.ru). */
export const REIZOKO_SERVER_URL = 'https://zasian.ru';

/** Public HTTP entry points — paths relative to REIZOKO_SERVER_URL. */
export const REIZOKO_SERVER_ENDPOINTS = {
  health: '/reizoko-health.php',
  vkCallback: '/vk-callback.php',
  vkStatus: '/vk-status.php',
  vkSession: '/vk-session.php',
  vkDiagnostics: '/vk-diagnostics.php',
} as const;

export const VK_CANONICAL_REDIRECT_URI = `${REIZOKO_SERVER_URL}${REIZOKO_SERVER_ENDPOINTS.vkCallback}`;

/** Alias kept for existing VK integration code. */
export const VK_DEFAULT_SERVER_BASE_URL = REIZOKO_SERVER_URL;

export function buildReizokoServerUrl(baseUrl: string, endpoint: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const path = endpoint.startsWith('/')
    ? endpoint
    : REIZOKO_SERVER_ENDPOINTS[endpoint as keyof typeof REIZOKO_SERVER_ENDPOINTS];
  return `${normalizedBase}${path}`;
}
