import { describe, expect, it } from 'vitest';

import {
  getVkIntegrationMissingFields,
  isVkIntegrationComplete,
  isVkIntegrationInitialSetup,
  type VkIntegrationFormState,
} from './vk-integration-state.js';

const baseState: VkIntegrationFormState = {
  appId: '',
  serverBaseUrl: 'https://zasian.ru',
  redirectUri: 'https://zasian.ru/vk-callback.php',
  hasClientSecret: false,
  hasServiceToken: false,
};

describe('vk integration state', () => {
  it('detects fully missing configuration', () => {
    expect(isVkIntegrationInitialSetup(baseState)).toBe(true);
    expect(getVkIntegrationMissingFields(baseState)).toEqual([
      'appId',
      'clientSecret',
      'serviceToken',
    ]);
    expect(isVkIntegrationComplete(baseState)).toBe(false);
  });

  it('detects partial missing service token only', () => {
    const state: VkIntegrationFormState = {
      ...baseState,
      appId: '123',
      hasClientSecret: true,
    };
    expect(isVkIntegrationInitialSetup(state)).toBe(false);
    expect(getVkIntegrationMissingFields(state)).toEqual(['serviceToken']);
  });

  it('detects complete configuration', () => {
    const state: VkIntegrationFormState = {
      ...baseState,
      appId: '123',
      hasClientSecret: true,
      hasServiceToken: true,
    };
    expect(isVkIntegrationComplete(state)).toBe(true);
    expect(getVkIntegrationMissingFields(state)).toEqual([]);
  });
});
