import type { MediaTransform } from '@reizoko/shared';

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getAspectRatioValue(aspectRatioId?: string): number | null {
  if (!aspectRatioId || aspectRatioId === 'original') return null;
  if (aspectRatioId === '1:1') return 1;
  if (aspectRatioId === '4:5') return 4 / 5;
  if (aspectRatioId === '1.91:1') return 1.91;
  if (aspectRatioId === '16:9') return 16 / 9;
  const parts = aspectRatioId.split(':').map(Number);
  if (parts.length === 2 && parts[0]! > 0 && parts[1]! > 0) {
    return parts[0]! / parts[1]!;
  }
  return null;
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
