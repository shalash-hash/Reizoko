import type { ContentBlock, HeadingBlockData } from '@reizoko/shared';
import type { PlatformAdapter, TransformedContent, PlatformValidationIssue } from '@reizoko/platform-sdk';
import { blocksToPlainText, extractImages } from '@reizoko/platform-sdk';

export const telegramAdapter: PlatformAdapter = {
  id: 'telegram',
  name: 'Telegram',
  icon: '✈️',
  color: '#0088CC',
  available: true,
  capabilities: {
    maxTextLength: 4096,
    supportsHeadings: true,
    supportsMultipleImages: true,
    supportsVideo: false,
    supportsLinks: true,
  },
  transform(blocks: ContentBlock[]): TransformedContent {
    const text = blocks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((block) => {
        if (block.type === 'heading') {
          const data = block.data as HeadingBlockData;
          return `<b>${data.text}</b>`;
        }
        return blocksToPlainText([block]);
      })
      .filter(Boolean)
      .join('\n\n');

    const images = extractImages(blocks);
    const warnings: PlatformValidationIssue[] = [];

    if (text.replace(/<[^>]+>/g, '').length > 4096) {
      warnings.push({
        severity: 'error',
        message: 'Текст превышает лимит Telegram (4096 символов).',
      });
    }

    return { text, images, warnings };
  },
  validate(blocks: ContentBlock[]): PlatformValidationIssue[] {
    return telegramAdapter.transform(blocks).warnings;
  },
};

export { TelegramPreview } from './TelegramPreview.js';
