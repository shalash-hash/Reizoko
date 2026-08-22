import { describe, expect, it } from 'vitest';
import { createBlock } from '../content/block-factory.js';
import {
  buildPreparedPresentationSnapshot,
  computeCropRectForAspect,
  computeOutputDimensions,
  getMediaTransform,
  getViewportAspectRatio,
  hashMediaTransform,
  presentationTargetKey,
  resolveCarouselOrder,
  resolvePlatformText,
  upsertMediaTransform,
} from './media-transform.js';

describe('media-transform', () => {
  it('keeps instagram crop isolated from master and other targets', () => {
    const blocks = [createBlock('image', 0, { mediaId: 'img-1' })];
    const instagram = upsertMediaTransform(
      {
        id: '1',
        contentItemId: 'item-1',
        targetKey: 'instagram:',
        platformId: 'instagram',
        socialAccountId: null,
        media: [],
        createdAt: 'now',
        updatedAt: 'now',
      },
      {
        mediaId: 'img-1',
        aspectRatio: '1:1',
        crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        zoom: 1.2,
        position: { x: 0.4, y: 0.6 },
      },
    );
    const vk = getMediaTransform(null, 'img-1');
    expect(instagram.media[0]?.transform.zoom).toBe(1.2);
    expect(vk.zoom).toBe(1);
    expect(blocks[0]?.data).toMatchObject({ mediaId: 'img-1' });
  });

  it('serializes normalized crop values', () => {
    const transform = {
      mediaId: 'img-1',
      crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
      zoom: 1.1,
      position: { x: 0.5, y: 0.5 },
    };
    const hash = hashMediaTransform(transform);
    expect(hash).toContain('"x":0.1');
    expect(hash).not.toContain('token');
  });

  it('computes deterministic output dimensions for chosen ratio', () => {
    const dims = computeOutputDimensions(1200, 1500, {
      mediaId: 'img-1',
      aspectRatio: '1:1',
      crop: computeCropRectForAspect(1200, 1500, 1),
    });
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
    expect(Math.abs(dims.width / dims.height - 1)).toBeLessThan(0.02);
  });

  it('computes viewport aspect ratio for preview rendering', () => {
    expect(getViewportAspectRatio({ mediaId: 'img-1', aspectRatio: '1:1' }, 1200, 800)).toBe(1);
    expect(getViewportAspectRatio({ mediaId: 'img-1', aspectRatio: '4:5' }, 1200, 800)).toBeCloseTo(
      0.8,
      3,
    );
    expect(getViewportAspectRatio({ mediaId: 'img-1', aspectRatio: 'original' }, 1200, 800)).toBe(
      1.5,
    );
  });

  it('builds prepared presentation snapshot from current overrides', () => {
    const blocks = [createBlock('image', 0, { mediaId: 'img-1' })];
    const overrides = {
      id: '1',
      contentItemId: 'item-1',
      targetKey: presentationTargetKey('instagram', null),
      platformId: 'instagram',
      socialAccountId: null,
      media: [
        {
          mediaId: 'img-1',
          transform: {
            mediaId: 'img-1',
            aspectRatio: '4:5',
            zoom: 1.3,
          },
        },
      ],
      createdAt: 'now',
      updatedAt: 'now',
    };
    const snapshot = buildPreparedPresentationSnapshot(overrides, blocks);
    expect(snapshot?.media[0]?.transform?.aspectRatio).toBe('4:5');
    expect(snapshot?.media[0]?.transform?.zoom).toBe(1.3);
  });

  it('supports platform text override without mutating master text', () => {
    const blocks = [createBlock('text', 0, { text: 'Master text' })];
    const overrides = {
      id: '1',
      contentItemId: 'item-1',
      targetKey: 'instagram:',
      platformId: 'instagram',
      socialAccountId: null,
      text: { useMasterText: false, text: 'Instagram caption' },
      media: [],
      createdAt: 'now',
      updatedAt: 'now',
    };
    expect(resolvePlatformText(blocks, overrides)).toBe('Instagram caption');
    expect(resolvePlatformText(blocks, null)).toBe('Master text');
  });

  it('keeps carousel order per target overrides', () => {
    const blocks = [
      createBlock('image', 0, { mediaId: 'a' }),
      createBlock('image', 1, { mediaId: 'b' }),
    ];
    const overrides = {
      id: '1',
      contentItemId: 'item-1',
      targetKey: 'instagram:',
      platformId: 'instagram',
      socialAccountId: null,
      carouselOrder: ['b', 'a'],
      media: [],
      createdAt: 'now',
      updatedAt: 'now',
    };
    expect(resolveCarouselOrder(blocks, overrides)).toEqual(['b', 'a']);
    expect(resolveCarouselOrder(blocks, null)).toEqual(['a', 'b']);
  });
});
