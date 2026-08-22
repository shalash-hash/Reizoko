import type { ContentBlock } from '@reizoko/shared';
import type { PlatformAdapter, TransformedContent, PlatformValidationIssue } from '@reizoko/platform-sdk';
import { blocksToPlainText, extractImages, countBlockType } from '@reizoko/platform-sdk';

const MAX_CAPTION = 2200;

export const instagramAdapter: PlatformAdapter = {
  id: 'instagram',
  name: 'Instagram',
  icon: 'instagram',
  color: '#E1306C',
  available: true,
  composerCapabilities: {
    supportedAspectRatios: [
      { id: 'original', label: 'Оригинал', ratio: null },
      { id: '1:1', label: 'Квадрат 1:1', ratio: 1 },
      { id: '4:5', label: 'Вертикальный 4:5', ratio: 4 / 5 },
      { id: '1.91:1', label: 'Горизонтальный 1.91:1', ratio: 1.91 },
    ],
    allowCrop: true,
    allowZoom: true,
    allowPan: true,
    allowRotation: true,
    allowAdjustments: true,
    allowFilters: true,
    allowCarouselReorder: true,
    allowTextOverride: true,
    allowAltText: false,
  },
  publisherCapabilities: {
    supportsDerivedMedia: true,
    supportsCarousel: true,
    supportsHtmlCaption: false,
    supportsNativeFilters: false,
  },
  capabilities: {
    maxTextLength: MAX_CAPTION,
    maxImages: 10,
    supportsHeadings: false,
    supportsMultipleImages: true,
    supportsVideo: false,
    supportsLinks: false,
  },
  transform(blocks: ContentBlock[]): TransformedContent {
    const text = blocksToPlainText(blocks);
    const images = extractImages(blocks);
    const warnings: PlatformValidationIssue[] = [];

    if (countBlockType(blocks, 'heading') > 0) {
      warnings.push({
        severity: 'warning',
        message: 'Instagram не поддерживает заголовки — они будут преобразованы в текст.',
      });
    }

    if (images.length > 1) {
      warnings.push({
        severity: 'info',
        message: 'Instagram объединит изображения в карусель, а текст будет помещён в caption.',
      });
    }

    if (text.length > MAX_CAPTION) {
      warnings.push({
        severity: 'error',
        message: `Подпись превышает лимит ${MAX_CAPTION} символов (${text.length}).`,
      });
    }

    return { text, images, warnings };
  },
  validate(blocks: ContentBlock[]): PlatformValidationIssue[] {
    return instagramAdapter.transform(blocks).warnings;
  },
};

export { InstagramPreview } from './InstagramPreview.js';
