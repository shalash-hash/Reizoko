import type {
  MediaTransform,
  NormalizedRect,
  PlatformMediaOverride,
  PlatformPresentationOverrides,
  PlatformTextOverrides,
  PreparedMediaPresentation,
  PreparedPresentationSnapshot,
} from '@reizoko/shared';
import type { ContentBlock } from '@reizoko/shared';
import { blocksToPlainText, extractImages } from '@reizoko/platform-sdk';

export interface AspectRatioPreset {
  id: string;
  label: string;
  ratio: number | null;
}

export const DEFAULT_ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { id: 'original', label: 'Оригинал', ratio: null },
  { id: '1:1', label: 'Квадрат', ratio: 1 },
  { id: '4:5', label: 'Вертикальный', ratio: 4 / 5 },
  { id: '1.91:1', label: 'Горизонтальный', ratio: 1.91 },
  { id: '16:9', label: 'Горизонтальный 16:9', ratio: 16 / 9 },
];

export function presentationTargetKey(platformId: string, socialAccountId?: string | null): string {
  return `${platformId}:${socialAccountId ?? ''}`;
}

export function createEmptyPresentationOverrides(input: {
  contentItemId: string;
  platformId: string;
  socialAccountId?: string | null;
}): Omit<PlatformPresentationOverrides, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    contentItemId: input.contentItemId,
    targetKey: presentationTargetKey(input.platformId, input.socialAccountId),
    platformId: input.platformId,
    socialAccountId: input.socialAccountId ?? null,
    media: [],
  };
}

export function defaultMediaTransform(mediaId: string): MediaTransform {
  return {
    mediaId,
    aspectRatio: 'original',
    zoom: 1,
    position: { x: 0.5, y: 0.5 },
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    adjustments: {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
    },
  };
}

export function getMediaTransform(
  overrides: PlatformPresentationOverrides | null | undefined,
  mediaId: string,
): MediaTransform {
  const existing = overrides?.media.find((item) => item.mediaId === mediaId);
  return existing?.transform ?? defaultMediaTransform(mediaId);
}

export function upsertMediaTransform(
  overrides: PlatformPresentationOverrides,
  transform: MediaTransform,
): PlatformPresentationOverrides {
  const media = [...overrides.media];
  const index = media.findIndex((item) => item.mediaId === transform.mediaId);
  const next: PlatformMediaOverride = { mediaId: transform.mediaId, transform };
  if (index >= 0) {
    media[index] = next;
  } else {
    media.push(next);
  }
  return { ...overrides, media };
}

export function resolveCarouselOrder(
  blocks: ContentBlock[],
  overrides?: PlatformPresentationOverrides | null,
): string[] {
  const masterOrder = extractImages(blocks).map((image) => image.mediaId);
  if (!overrides?.carouselOrder?.length) {
    return masterOrder;
  }
  const allowed = new Set(masterOrder);
  const ordered = overrides.carouselOrder.filter((mediaId) => allowed.has(mediaId));
  for (const mediaId of masterOrder) {
    if (!ordered.includes(mediaId)) {
      ordered.push(mediaId);
    }
  }
  return ordered;
}

export function resolvePlatformText(
  blocks: ContentBlock[],
  overrides?: PlatformPresentationOverrides | null,
): string {
  if (overrides?.text && !overrides.text.useMasterText && overrides.text.text !== undefined) {
    return overrides.text.text;
  }
  return blocksToPlainText(blocks);
}

export function defaultTextOverrides(): PlatformTextOverrides {
  return { useMasterText: true };
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function computeCropRectForAspect(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number | null,
): NormalizedRect {
  if (!aspectRatio || sourceWidth <= 0 || sourceHeight <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio > aspectRatio) {
    const width = aspectRatio / sourceRatio;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  const height = sourceRatio / aspectRatio;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

export function getAspectRatioValue(aspectRatioId?: string): number | null {
  const preset = DEFAULT_ASPECT_RATIO_PRESETS.find((item) => item.id === aspectRatioId);
  return preset?.ratio ?? null;
}

export function getViewportAspectRatio(
  transform: MediaTransform,
  imageWidth: number,
  imageHeight: number,
): number {
  const ratio = getAspectRatioValue(transform.aspectRatio);
  if (ratio) return ratio;
  if (imageWidth > 0 && imageHeight > 0) return imageWidth / imageHeight;
  return 1;
}

export function computeOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  transform: MediaTransform,
): { width: number; height: number } {
  const ratio = getAspectRatioValue(transform.aspectRatio);
  const crop = transform.crop ?? computeCropRectForAspect(sourceWidth, sourceHeight, ratio);
  const cropWidth = Math.max(1, Math.round(sourceWidth * crop.width));
  const cropHeight = Math.max(1, Math.round(sourceHeight * crop.height));
  if (!ratio) {
    return { width: cropWidth, height: cropHeight };
  }
  if (ratio >= 1) {
    return { width: cropWidth, height: Math.max(1, Math.round(cropWidth / ratio)) };
  }
  return { width: Math.max(1, Math.round(cropHeight * ratio)), height: cropHeight };
}

export function hashMediaTransform(transform: MediaTransform): string {
  return JSON.stringify({
    mediaId: transform.mediaId,
    aspectRatio: transform.aspectRatio,
    crop: transform.crop,
    zoom: transform.zoom,
    position: transform.position,
    rotation: transform.rotation,
    flipHorizontal: transform.flipHorizontal,
    flipVertical: transform.flipVertical,
    adjustments: transform.adjustments,
    filter: transform.filter,
  });
}

export function buildPreparedPresentationSnapshot(
  overrides: PlatformPresentationOverrides | null | undefined,
  blocks: ContentBlock[],
): PreparedPresentationSnapshot | undefined {
  const images = extractImages(blocks);
  if (!overrides && images.length === 0) {
    return undefined;
  }

  const order = resolveCarouselOrder(blocks, overrides);
  const media: PreparedMediaPresentation[] = order.map((mediaId) => {
    const image = images.find((item) => item.mediaId === mediaId);
    const transform = getMediaTransform(overrides ?? null, mediaId);
    const hasCustomTransform =
      overrides?.media.some((item) => item.mediaId === mediaId) ?? false;
    return {
      mediaId,
      transform: hasCustomTransform ? transform : undefined,
      alt: image?.alt,
      caption: image?.caption,
    };
  });

  return {
    targetKey: overrides?.targetKey ?? '',
    socialAccountId: overrides?.socialAccountId ?? null,
    textOverride: overrides?.text,
    media,
    carouselOrder: order,
  };
}

export function hasPresentationOverrides(overrides?: PlatformPresentationOverrides | null): boolean {
  if (!overrides) return false;
  if (overrides.text && !overrides.text.useMasterText) return true;
  if (overrides.media.length > 0) return true;
  if (overrides.carouselOrder?.length) return true;
  return false;
}
