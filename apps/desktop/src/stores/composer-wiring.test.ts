import { describe, expect, it } from 'vitest';
import {
  applyAspectRatio,
  createDefaultOverridesIfMissing,
  getOverridesForTarget,
  mapPresentationOverrides,
  presentationStorageKey,
} from './presentation-overrides';
import {
  buildPreparedPresentationSnapshot,
  createBlock,
  defaultMediaTransform,
  getMediaTransform,
  getViewportAspectRatio,
  presentationTargetKey,
  upsertMediaTransform,
} from '@reizoko/core';
import type { PlatformPresentationOverrides } from '@reizoko/shared';

const CONTENT_ID = 'content-1';

function buildStoreMap(
  overrides: PlatformPresentationOverrides,
): Record<string, PlatformPresentationOverrides> {
  return mapPresentationOverrides(CONTENT_ID, [overrides]);
}

describe('composer wiring', () => {
  it('ratio click updates override state for the target', () => {
    const base = createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null);
    const next = applyAspectRatio(base, 'img-1', '1:1', 1200, 800);
    const map = buildStoreMap(next);

    const stored = getOverridesForTarget(map, CONTENT_ID, 'instagram', null);
    expect(stored?.media[0]?.transform.aspectRatio).toBe('1:1');
    expect(stored?.media[0]?.transform.crop).toBeTruthy();
  });

  it('ratio click updates preview viewport model', () => {
    const base = createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null);
    const portrait = applyAspectRatio(base, 'img-1', '4:5', 1200, 800);
    const transform = getMediaTransform(portrait, 'img-1');
    expect(getViewportAspectRatio(transform, 1200, 800)).toBeCloseTo(0.8, 3);
  });

  it('zoom updates transform for active media', () => {
    const base = createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null);
    const withRatio = applyAspectRatio(base, 'img-1', '1:1');
    const zoomed = upsertMediaTransform(withRatio, {
      ...getMediaTransform(withRatio, 'img-1'),
      zoom: 1.75,
    });
    expect(getMediaTransform(zoomed, 'img-1').zoom).toBe(1.75);
  });

  it('position updates transform for active media', () => {
    const base = createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null);
    const positioned = upsertMediaTransform(base, {
      ...defaultMediaTransform('img-1'),
      position: { x: 0.25, y: 0.8 },
    });
    const transform = getMediaTransform(positioned, 'img-1');
    expect(transform.position).toEqual({ x: 0.25, y: 0.8 });
  });

  it('reset clears overrides entry from the store map', () => {
    const base = createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null);
    const withRatio = applyAspectRatio(base, 'img-1', '1:1');
    const targetKey = presentationTargetKey('instagram', null);
    const storageKey = presentationStorageKey(CONTENT_ID, targetKey);
    const map = buildStoreMap(withRatio);
    expect(map[storageKey]).toBeTruthy();

    const nextMap = { ...map };
    delete nextMap[storageKey];
    expect(getOverridesForTarget(nextMap, CONTENT_ID, 'instagram', null)).toBeNull();
    expect(getMediaTransform(null, 'img-1').zoom).toBe(1);
  });

  it('keeps instagram transform isolated from vk', () => {
    const ig = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null),
      'img-1',
      '1:1',
    );
    const vk = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'vk', null),
      'img-1',
      '16:9',
      1920,
      1080,
    );
    const map = {
      ...buildStoreMap(ig),
      ...buildStoreMap(vk),
    };
    expect(
      getMediaTransform(getOverridesForTarget(map, CONTENT_ID, 'instagram', null), 'img-1')
        .aspectRatio,
    ).toBe('1:1');
    expect(
      getMediaTransform(getOverridesForTarget(map, CONTENT_ID, 'vk', null), 'img-1').aspectRatio,
    ).toBe('16:9');
  });

  it('supports vk ratio and zoom updates', () => {
    const vk = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'vk', null),
      'img-1',
      '4:5',
      1080,
      1350,
    );
    const zoomed = upsertMediaTransform(vk, {
      ...getMediaTransform(vk, 'img-1'),
      zoom: 1.45,
      position: { x: 0.2, y: 0.7 },
    });
    const transform = getMediaTransform(zoomed, 'img-1');
    expect(transform.aspectRatio).toBe('4:5');
    expect(transform.zoom).toBe(1.45);
    expect(getViewportAspectRatio(transform, 1080, 1350)).toBeCloseTo(0.8, 2);
  });

  it('freezes vk prepared snapshot independently from later edits', () => {
    const blocks = [createBlock('image', 0, { mediaId: 'img-1' })];
    const vk = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'vk', null),
      'img-1',
      '1:1',
    );
    const snapshot = buildPreparedPresentationSnapshot(vk, blocks);
    const edited = upsertMediaTransform(vk, {
      ...getMediaTransform(vk, 'img-1'),
      aspectRatio: '16:9',
      zoom: 2.2,
    });
    expect(snapshot?.media[0]?.transform?.aspectRatio).toBe('1:1');
    expect(getMediaTransform(edited, 'img-1').zoom).toBe(2.2);
  });

  it('keeps account A isolated from account B', () => {
    const accountA = 'acc-a';
    const accountB = 'acc-b';
    const igA = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', accountA),
      'img-1',
      '4:5',
    );
    const igB = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', accountB),
      'img-1',
      '1:1',
    );
    const map = {
      ...buildStoreMap(igA),
      ...buildStoreMap(igB),
    };
    expect(
      getMediaTransform(
        getOverridesForTarget(map, CONTENT_ID, 'instagram', accountA),
        'img-1',
      ).aspectRatio,
    ).toBe('4:5');
    expect(
      getMediaTransform(
        getOverridesForTarget(map, CONTENT_ID, 'instagram', accountB),
        'img-1',
      ).aspectRatio,
    ).toBe('1:1');
  });

  it('persists transform through reload map hydration', () => {
    const saved = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null),
      'img-1',
      '1.91:1',
      1920,
      1080,
    );
    const reloaded = mapPresentationOverrides(CONTENT_ID, [saved]);
    const restored = getOverridesForTarget(reloaded, CONTENT_ID, 'instagram', null);
    expect(getMediaTransform(restored, 'img-1').aspectRatio).toBe('1.91:1');
    expect(getMediaTransform(restored, 'img-1').crop).toBeTruthy();
  });

  it('freezes prepared snapshot and ignores later transform edits', () => {
    const blocks = [createBlock('image', 0, { mediaId: 'img-1' })];
    const overrides = applyAspectRatio(
      createDefaultOverridesIfMissing(CONTENT_ID, 'instagram', null),
      'img-1',
      '1:1',
    );
    const snapshot = buildPreparedPresentationSnapshot(overrides, blocks);
    const edited = upsertMediaTransform(overrides, {
      ...getMediaTransform(overrides, 'img-1'),
      zoom: 2.5,
      aspectRatio: '4:5',
    });
    expect(snapshot?.media[0]?.transform?.aspectRatio).toBe('1:1');
    expect(getMediaTransform(edited, 'img-1').zoom).toBe(2.5);
    expect(snapshot?.media[0]?.transform?.zoom).not.toBe(2.5);
  });
});
