/** Normalized rectangle in 0..1 coordinate space relative to source image. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MediaTransformPosition {
  x: number;
  y: number;
}

export interface MediaTransformAdjustments {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
}

export interface MediaTransform {
  mediaId: string;
  aspectRatio?: string;
  crop?: NormalizedRect;
  zoom?: number;
  position?: MediaTransformPosition;
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  adjustments?: MediaTransformAdjustments;
  filter?: string;
}

export interface PlatformTextOverrides {
  useMasterText: boolean;
  text?: string;
}

export interface PlatformMediaOverride {
  mediaId: string;
  transform: MediaTransform;
  order?: number;
}

export interface PlatformPresentationOverrides {
  id: string;
  contentItemId: string;
  targetKey: string;
  platformId: string;
  socialAccountId?: string | null;
  text?: PlatformTextOverrides;
  media: PlatformMediaOverride[];
  carouselOrder?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DerivedMediaVariant {
  id: string;
  sourceMediaId: string;
  transformHash: string;
  localPath: string;
  mimeType: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface PreparedMediaPresentation {
  mediaId: string;
  derivedMediaId?: string | null;
  transform?: MediaTransform;
  alt?: string;
  caption?: string;
}

export interface PreparedPresentationSnapshot {
  targetKey: string;
  socialAccountId?: string | null;
  textOverride?: PlatformTextOverrides;
  media: PreparedMediaPresentation[];
  carouselOrder?: string[];
}
