import type { ContentBlock } from '@reizoko/shared';
import type { PlatformAdapter, TransformedContent, PlatformValidationIssue } from '@reizoko/platform-sdk';
import { blocksToPlainText, extractImages, countBlockType } from '@reizoko/platform-sdk';

export const vkAdapter: PlatformAdapter = {
  id: 'vk',
  name: 'ВКонтакте',
  icon: 'vk',
  color: '#0077FF',
  available: true,
  composerCapabilities: {
    supportedAspectRatios: [
      { id: 'original', label: 'Оригинал', ratio: null },
      { id: '1:1', label: 'Квадрат 1:1', ratio: 1 },
      { id: '4:5', label: 'Вертикальный 4:5', ratio: 4 / 5 },
      { id: '16:9', label: 'Горизонтальный 16:9', ratio: 16 / 9 },
    ],
    allowCrop: true,
    allowZoom: true,
    allowPan: true,
    allowRotation: true,
    allowAdjustments: true,
    allowFilters: false,
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
    maxTextLength: 16384,
    supportsHeadings: false,
    supportsMultipleImages: true,
    supportsVideo: false,
    supportsLinks: true,
  },
  transform(blocks: ContentBlock[]): TransformedContent {
    const text = blocksToPlainText(blocks);
    const images = extractImages(blocks);
    const warnings: PlatformValidationIssue[] = [];

    if (countBlockType(blocks, 'heading') > 0) {
      warnings.push({
        severity: 'info',
        message: 'VK не имеет отдельного формата заголовков — они будут частью текста.',
      });
    }

    return { text, images, warnings };
  },
  validate(blocks: ContentBlock[]): PlatformValidationIssue[] {
    return vkAdapter.transform(blocks).warnings;
  },
};

export { VkPreview } from './VkPreview.js';
