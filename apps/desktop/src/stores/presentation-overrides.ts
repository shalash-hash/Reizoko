import type { MediaTransform, PlatformPresentationOverrides } from '@reizoko/shared';
import {
  computeCropRectForAspect,
  createEmptyPresentationOverrides,
  defaultTextOverrides,
  getAspectRatioValue,
  presentationTargetKey,
  upsertMediaTransform,
} from '@reizoko/core';
import type { DatabaseContext } from '@reizoko/database';

export function presentationStorageKey(contentItemId: string, targetKey: string): string {
  return `${contentItemId}:${targetKey}`;
}

export function mapPresentationOverrides(
  contentItemId: string,
  rows: PlatformPresentationOverrides[],
): Record<string, PlatformPresentationOverrides> {
  return Object.fromEntries(
    rows.map((row) => [presentationStorageKey(contentItemId, row.targetKey), row]),
  );
}

export async function loadPresentationOverridesForItem(
  db: DatabaseContext,
  contentItemId: string,
): Promise<Record<string, PlatformPresentationOverrides>> {
  const rows = await db.presentationOverrides.listByContentItem(contentItemId);
  return mapPresentationOverrides(contentItemId, rows);
}

export function getOverridesForTarget(
  map: Record<string, PlatformPresentationOverrides>,
  contentItemId: string | null | undefined,
  platformId: string,
  socialAccountId?: string | null,
): PlatformPresentationOverrides | null {
  if (!contentItemId) return null;
  const targetKey = presentationTargetKey(platformId, socialAccountId);
  return map[presentationStorageKey(contentItemId, targetKey)] ?? null;
}

export function buildPresentationPatch(input: {
  contentItemId: string;
  platformId: string;
  socialAccountId?: string | null;
  existing: PlatformPresentationOverrides | null;
  patch: Partial<PlatformPresentationOverrides>;
}): PlatformPresentationOverrides {
  const targetKey = presentationTargetKey(input.platformId, input.socialAccountId);
  const base =
    input.existing ??
    ({
      id: '',
      createdAt: '',
      updatedAt: '',
      ...createEmptyPresentationOverrides({
        contentItemId: input.contentItemId,
        platformId: input.platformId,
        socialAccountId: input.socialAccountId,
      }),
    } satisfies PlatformPresentationOverrides);

  return {
    ...base,
    ...input.patch,
    contentItemId: input.contentItemId,
    targetKey,
    platformId: input.platformId,
    socialAccountId: input.socialAccountId ?? null,
  };
}

export function applyAspectRatio(
  overrides: PlatformPresentationOverrides,
  mediaId: string,
  aspectRatioId: string,
  sourceWidth = 1,
  sourceHeight = 1,
): PlatformPresentationOverrides {
  const ratio = getAspectRatioValue(aspectRatioId);
  const crop = computeCropRectForAspect(sourceWidth, sourceHeight, ratio);
  const transform: MediaTransform = {
    mediaId,
    aspectRatio: aspectRatioId,
    crop,
    zoom: 1,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
  };
  return upsertMediaTransform(overrides, transform);
}

export function applyTextOverrideMode(
  overrides: PlatformPresentationOverrides,
  useMasterText: boolean,
): PlatformPresentationOverrides {
  return {
    ...overrides,
    text: {
      useMasterText,
      text: overrides.text?.text,
    },
  };
}

export function applyPlatformText(
  overrides: PlatformPresentationOverrides,
  text: string,
): PlatformPresentationOverrides {
  return {
    ...overrides,
    text: {
      useMasterText: false,
      text,
    },
  };
}

export function createDefaultOverridesIfMissing(
  contentItemId: string,
  platformId: string,
  socialAccountId?: string | null,
): PlatformPresentationOverrides {
  return {
    id: '',
    createdAt: '',
    updatedAt: '',
    ...createEmptyPresentationOverrides({ contentItemId, platformId, socialAccountId }),
    text: defaultTextOverrides(),
  };
}

export async function persistPresentationOverrides(
  db: DatabaseContext,
  overrides: PlatformPresentationOverrides,
): Promise<PlatformPresentationOverrides> {
  return db.presentationOverrides.upsert(overrides);
}

export function buildPresentationByTargetKey(
  map: Record<string, PlatformPresentationOverrides>,
): Record<string, PlatformPresentationOverrides> {
  const result: Record<string, PlatformPresentationOverrides> = {};
  for (const overrides of Object.values(map)) {
    result[overrides.targetKey] = overrides;
  }
  return result;
}
