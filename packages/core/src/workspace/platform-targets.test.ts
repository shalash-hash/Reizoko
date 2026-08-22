import { describe, expect, it } from 'vitest';
import {
  addPlatformTarget,
  createPlatformTarget,
  getPlatformTargetLabel,
  isTargetOpen,
  normalizeWorkspaceState,
  toPreviewAccountContext,
  toPublicationTarget,
} from './platform-targets.js';

describe('platform targets', () => {
  it('migrates legacy openPlatformTabs to platform-only targets', () => {
    const normalized = normalizeWorkspaceState({
      activeTabId: 'platform-instagram',
      openPlatformTabs: ['instagram', 'telegram'],
      currentContentItemId: 'item-1',
      sidebarSection: 'editor',
    });

    expect(normalized.openPlatformTargets).toHaveLength(2);
    expect(normalized.openPlatformTargets[0]).toMatchObject({
      id: 'instagram',
      platformId: 'instagram',
      socialAccountId: null,
    });
  });

  it('does not duplicate the same exact account target', () => {
    const initial = [createPlatformTarget('instagram', 'acc-1')];
    const next = addPlatformTarget(initial, 'instagram', 'acc-1');
    expect(next).toHaveLength(1);
  });

  it('allows two instagram account targets', () => {
    let targets = addPlatformTarget([], 'instagram', 'acc-1');
    targets = addPlatformTarget(targets, 'instagram', 'acc-2');
    expect(targets).toHaveLength(2);
  });

  it('keeps platform-only target working', () => {
    const targets = addPlatformTarget([], 'telegram', null);
    expect(isTargetOpen(targets, 'telegram', null)).toBe(true);
    expect(toPublicationTarget(targets[0]!)).toEqual({
      platformId: 'telegram',
      socialAccountId: null,
    });
  });

  it('uses Russian platform display names in target labels', () => {
    expect(getPlatformTargetLabel('telegram')).toBe('Телеграм');
    expect(getPlatformTargetLabel('vk')).toBe('ВКонтакте');
    expect(getPlatformTargetLabel('instagram')).toBe('Instagram');
    expect(
      getPlatformTargetLabel('vk', { displayName: 'Компания' }),
    ).toBe('ВКонтакте · Компания');
  });

  it('maps preview account context from social account', () => {
    const context = toPreviewAccountContext({
      id: 'acc-1',
      platformId: 'instagram',
      displayName: 'Компания',
      handle: '@reizoko',
      isActive: true,
      connectionState: 'local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(context?.displayName).toBe('Компания');
    expect(context?.handle).toBe('@reizoko');
  });
});
