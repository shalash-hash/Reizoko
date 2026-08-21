import type { ContentBlock, HeadingBlockData, ImageBlockData, TextBlockData } from '@reizoko/shared';

export function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((block) => {
      switch (block.type) {
        case 'text':
          return (block.data as TextBlockData).text;
        case 'heading': {
          const heading = block.data as HeadingBlockData;
          return heading.text.toUpperCase();
        }
        case 'image': {
          const image = block.data as ImageBlockData;
          return image.caption ?? '';
        }
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

export function extractImages(blocks: ContentBlock[]): Array<{
  mediaId: string;
  alt?: string;
  caption?: string;
}> {
  return blocks
    .filter((b) => b.type === 'image')
    .map((b) => {
      const data = b.data as ImageBlockData;
      return { mediaId: data.mediaId, alt: data.alt, caption: data.caption };
    });
}

export function countBlockType(blocks: ContentBlock[], type: ContentBlock['type']): number {
  return blocks.filter((b) => b.type === type).length;
}
