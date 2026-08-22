const SENSITIVE_KEY_PATTERN =
  /(access[_-]?token|refresh[_-]?token|bot[_-]?token|api[_-]?hash|session|secret|password|authorization)/i;

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const TOKEN_VALUE_PATTERN =
  /((?:access|refresh|bot)[_-]?token|api[_-]?hash|session|secret)\s*[:=]\s*["']?([^\s"',}]+)/gi;

export function redactSecrets(input: string): string {
  let result = input.replace(BEARER_PATTERN, 'Bearer ***REDACTED***');
  result = result.replace(TOKEN_VALUE_PATTERN, '$1=***REDACTED***');
  return result;
}

export function containsSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function assertNoPlaintextSecrets(record: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(record)) {
    if (containsSensitiveKey(key) && typeof value === 'string' && value.length > 0) {
      throw new Error(`Sensitive value must not be stored in domain record: ${key}`);
    }
  }
}
