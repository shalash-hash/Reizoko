import {
  buildPreparedPresentationSnapshot,
  computeCropRectForAspect,
  createEmptyPresentationOverrides,
  getAspectRatioValue,
  getMediaTransform,
  getViewportAspectRatio,
  hashMediaTransform,
  presentationTargetKey,
  upsertMediaTransform,
  createBlock,
} from '../../packages/core/dist/index.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`composer smoke: FAIL — ${message}`);
    process.exit(1);
  }
}

function applyAspectRatio(overrides, mediaId, aspectRatioId, sourceWidth = 1200, sourceHeight = 800) {
  const ratio = getAspectRatioValue(aspectRatioId);
  const crop = computeCropRectForAspect(sourceWidth, sourceHeight, ratio);
  return upsertMediaTransform(overrides, {
    mediaId,
    aspectRatio: aspectRatioId,
    crop,
    zoom: 1,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
  });
}

function presentationStorageKey(contentItemId, targetKey) {
  return `${contentItemId}:${targetKey}`;
}

function mapPresentationOverrides(contentItemId, rows) {
  return Object.fromEntries(rows.map((row) => [presentationStorageKey(contentItemId, row.targetKey), row]));
}

function getOverridesForTarget(map, contentItemId, platformId, socialAccountId) {
  const targetKey = presentationTargetKey(platformId, socialAccountId);
  return map[presentationStorageKey(contentItemId, targetKey)] ?? null;
}

const CONTENT_ID = 'item-smoke';
const blocks = [
  createBlock('text', 0, { text: 'Composer smoke post' }),
  createBlock('image', 1, { mediaId: 'img-smoke' }),
];

let instagramOverrides = {
  id: 'ov-1',
  contentItemId: CONTENT_ID,
  targetKey: presentationTargetKey('instagram', null),
  platformId: 'instagram',
  socialAccountId: null,
  media: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 1:1 ratio click → override + preview model
instagramOverrides = applyAspectRatio(instagramOverrides, 'img-smoke', '1:1', 1200, 800);
const ratioTransform = getMediaTransform(instagramOverrides, 'img-smoke');
assert(ratioTransform.aspectRatio === '1:1', 'ratio click should update override aspectRatio');
assert(
  Math.abs(getViewportAspectRatio(ratioTransform, 1200, 800) - 1) < 0.01,
  'preview viewport should become square for 1:1',
);

// zoom + position
instagramOverrides = upsertMediaTransform(instagramOverrides, {
  ...ratioTransform,
  zoom: 1.6,
  position: { x: 0.35, y: 0.65 },
});
const zoomed = getMediaTransform(instagramOverrides, 'img-smoke');
assert(zoomed.zoom === 1.6, 'zoom should update transform');
assert(zoomed.position?.x === 0.35, 'position X should persist in transform');

// VK isolation
const vkTransform = getMediaTransform(null, 'img-smoke');
assert(vkTransform.aspectRatio === 'original', 'VK should keep master defaults');
assert(vkTransform.zoom === 1, 'VK should keep default zoom');

// reload map hydration
const storeMap = mapPresentationOverrides(CONTENT_ID, [instagramOverrides]);
const restored = getOverridesForTarget(storeMap, CONTENT_ID, 'instagram', null);
const restoredTransform = getMediaTransform(restored, 'img-smoke');
assert(restoredTransform.zoom === 1.6, 'instagram transform should restore after reload map');

// portrait ratio (preserves zoom when using upsert instead of applyAspectRatio reset)
instagramOverrides = upsertMediaTransform(instagramOverrides, {
  ...getMediaTransform(instagramOverrides, 'img-smoke'),
  aspectRatio: '4:5',
  crop: computeCropRectForAspect(1080, 1350, 4 / 5),
});
const portraitTransform = getMediaTransform(instagramOverrides, 'img-smoke');
assert(
  Math.abs(getViewportAspectRatio(portraitTransform, 1080, 1350) - 0.8) < 0.02,
  'portrait ratio should change preview viewport',
);
assert(portraitTransform.zoom === 1.6, 'zoom should survive aspect ratio change when not reset');

// snapshot freeze
const snapshotA = buildPreparedPresentationSnapshot(instagramOverrides, blocks);
assert(snapshotA?.media[0]?.transform?.aspectRatio === '4:5', 'prepare snapshot should freeze transform');
assert(snapshotA?.media[0]?.transform?.zoom === 1.6, 'prepare snapshot should freeze zoom');

const firstTransform = instagramOverrides.media[0]?.transform;
assert(firstTransform, 'instagram override should contain transform');

instagramOverrides = upsertMediaTransform(instagramOverrides, {
  ...firstTransform,
  zoom: 2,
  crop: computeCropRectForAspect(1080, 1350, 1),
  aspectRatio: '1:1',
});

const snapshotB = buildPreparedPresentationSnapshot(instagramOverrides, blocks);
assert(snapshotA?.media[0]?.transform?.zoom === 1.6, 'old snapshot must not change after edit');
assert(snapshotB?.media[0]?.transform?.zoom === 2, 'new snapshot uses updated transform');
assert(snapshotB?.media[0]?.transform?.aspectRatio === '1:1', 'new snapshot uses updated aspect ratio');

// reset simulation
const targetKey = presentationTargetKey('instagram', null);
const resetMap = { ...storeMap };
delete resetMap[presentationStorageKey(CONTENT_ID, targetKey)];
assert(
  getOverridesForTarget(resetMap, CONTENT_ID, 'instagram', null) === null,
  'reset should clear overrides for target',
);
assert(
  getMediaTransform(null, 'img-smoke').aspectRatio === 'original',
  'reset should return master/default presentation',
);

// VK transform path
let vkOverrides = {
  id: 'ov-vk',
  contentItemId: CONTENT_ID,
  targetKey: presentationTargetKey('vk', null),
  platformId: 'vk',
  socialAccountId: null,
  media: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
vkOverrides = applyAspectRatio(vkOverrides, 'img-smoke', '4:5', 1080, 1350);
vkOverrides = upsertMediaTransform(vkOverrides, {
  ...getMediaTransform(vkOverrides, 'img-smoke'),
  zoom: 1.3,
  position: { x: 0.4, y: 0.55 },
});
const vkOnly = getMediaTransform(vkOverrides, 'img-smoke');
assert(vkOnly.aspectRatio === '4:5', 'vk ratio click should update override');
assert(vkOnly.zoom === 1.3, 'vk zoom should update transform');
assert(
  getMediaTransform(instagramOverrides, 'img-smoke').aspectRatio === '1:1',
  'instagram transform should remain isolated from vk',
);

// telegram has no overrides / fake crop
const telegramTransform = getMediaTransform(null, 'img-smoke');
assert(telegramTransform.aspectRatio === 'original', 'telegram should keep master defaults');

// combined store map + restore vk after instagram switch simulation
const combinedMap = mapPresentationOverrides(CONTENT_ID, [instagramOverrides, vkOverrides]);
const restoredVk = getOverridesForTarget(combinedMap, CONTENT_ID, 'vk', null);
assert(getMediaTransform(restoredVk, 'img-smoke').zoom === 1.3, 'vk transform should restore after reload map');

const vkSnapshot = buildPreparedPresentationSnapshot(vkOverrides, blocks);
const vkEdited = upsertMediaTransform(vkOverrides, {
  ...getMediaTransform(vkOverrides, 'img-smoke'),
  zoom: 2.5,
});
assert(vkSnapshot?.media[0]?.transform?.zoom === 1.3, 'vk prepare snapshot must freeze transform');
assert(getMediaTransform(vkEdited, 'img-smoke').zoom === 2.5, 'vk live transform can change after prepare');

const hash = hashMediaTransform(firstTransform);
assert(!hash.includes('token'), 'transform hash must not include secrets');

console.log('composer smoke: PASS');
