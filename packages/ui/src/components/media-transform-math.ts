export interface MediaTransformViewTransform {
  mediaId: string;
  aspectRatio?: string;
  crop?: { x: number; y: number; width: number; height: number };
  zoom?: number;
  position?: { x: number; y: number };
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  adjustments?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    temperature?: number;
  };
  filter?: string;
}

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
];

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getAspectRatioValue(aspectRatioId?: string): number | null {
  const preset = DEFAULT_ASPECT_RATIO_PRESETS.find((item) => item.id === aspectRatioId);
  return preset?.ratio ?? null;
}

export function computeCropRectForAspect(
  sourceWidth: number,
  sourceHeight: number,
  aspectRatio: number | null,
): { x: number; y: number; width: number; height: number } {
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

export function resolveCrop(
  transform: MediaTransformViewTransform,
  imageWidth: number,
  imageHeight: number,
) {
  const aspectRatio = getAspectRatioValue(transform.aspectRatio);
  return transform.crop ?? computeCropRectForAspect(imageWidth, imageHeight, aspectRatio);
}
