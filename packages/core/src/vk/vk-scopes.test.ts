import { describe, expect, it } from 'vitest';

import {
  VK_OAUTH_REQUIRED_SCOPES,
  analyzeVkScopeCoverage,
  buildVkOAuthConnectionMeta,
  parseVkGrantedScopes,
} from './vk-scopes.js';

describe('vk-scopes', () => {
  it('parses granted scopes from VK ID token response', () => {
    expect(parseVkGrantedScopes('vkid.personal_info groups wall')).toEqual([
      'vkid.personal_info',
      'groups',
      'wall',
    ]);
    expect(parseVkGrantedScopes(null)).toEqual(['vkid.personal_info']);
  });

  it('detects missing API scopes', () => {
    const analysis = analyzeVkScopeCoverage(['vkid.personal_info'], VK_OAUTH_REQUIRED_SCOPES);
    expect(analysis.hasIdentity).toBe(true);
    expect(analysis.hasGroups).toBe(false);
    expect(analysis.hasWall).toBe(false);
    expect(analysis.hasPhotos).toBe(false);
    expect(analysis.needsScopeUpgrade).toBe(true);
    expect(analysis.missing).toContain('groups');
    expect(analysis.missing).toContain('wall');
    expect(analysis.missing).toContain('photos');
  });

  it('builds oauth connection meta with missing scopes', () => {
    const meta = buildVkOAuthConnectionMeta({
      requestedScopes: VK_OAUTH_REQUIRED_SCOPES,
      grantedScopeString: 'vkid.personal_info groups',
      expiresIn: 3600,
    });
    expect(meta.grantedScopes).toEqual(['vkid.personal_info', 'groups']);
    expect(meta.missingScopes).toEqual(expect.arrayContaining(['wall', 'photos', 'offline']));
    expect(meta.expiresAt).toBeTruthy();
  });
});
