import { describe, expect, it } from 'vitest';
import { assertNoPlaintextSecrets, redactSecrets } from './redact-secrets.js';
import { InMemorySecretStore } from './secret-store.js';

describe('redact-secrets', () => {
  it('redacts bearer tokens', () => {
    expect(redactSecrets('Authorization: Bearer abc.def.ghi')).toContain('***REDACTED***');
    expect(redactSecrets('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def');
  });

  it('redacts token key assignments', () => {
    expect(redactSecrets('access_token=secret123')).toBe('access_token=***REDACTED***');
  });

  it('assertNoPlaintextSecrets rejects sensitive keys on domain records', () => {
    expect(() =>
      assertNoPlaintextSecrets({ accessToken: 'leaked' }),
    ).toThrow(/Sensitive value must not be stored/);
    expect(() => assertNoPlaintextSecrets({ displayName: 'Safe' })).not.toThrow();
  });
});

describe('InMemorySecretStore', () => {
  it('stores and deletes secrets', async () => {
    const store = new InMemorySecretStore();
    await store.setSecret('connection/test/bot_token', '123:ABC');
    expect(await store.getSecret('connection/test/bot_token')).toBe('123:ABC');
    expect(await store.hasSecret('connection/test/bot_token')).toBe(true);
    await store.deleteSecret('connection/test/bot_token');
    expect(await store.getSecret('connection/test/bot_token')).toBeNull();
    expect(await store.hasSecret('connection/test/bot_token')).toBe(false);
  });
});
