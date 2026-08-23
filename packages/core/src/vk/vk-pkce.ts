const PKCE_VERIFIER_LENGTH = 64;
const PKCE_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export interface VkPkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

function randomVerifier(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += PKCE_CHARSET[bytes[index] % PKCE_CHARSET.length];
  }
  return result;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function generateVkPkcePair(): Promise<VkPkcePair> {
  const codeVerifier = randomVerifier(PKCE_VERIFIER_LENGTH);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return {
    codeVerifier,
    codeChallenge: base64UrlEncode(digest),
  };
}

export function buildVkIdAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  prompt?: 'consent' | 'login' | 'none';
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
    scope: input.scope,
  });
  if (input.prompt) {
    params.set('prompt', input.prompt);
  }
  return `https://id.vk.ru/authorize?${params.toString()}`;
}
