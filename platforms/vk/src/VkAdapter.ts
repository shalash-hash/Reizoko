import type { ContentBlock } from '@reizoko/shared';
import type { PlatformAdapter, TransformedContent, PlatformValidationIssue } from '@reizoko/platform-sdk';
import { blocksToPlainText, extractImages, countBlockType } from '@reizoko/platform-sdk';

export const vkAdapter: PlatformAdapter = {
  id: 'vk',
  name: 'VK',
  icon: '💬',
  color: '#0077FF',
  available: true,
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
