import {
  ContentBlock,
  ContentBlockType,
  ContentItem,
  ContentItemMetadata,
  ContentItemSummary,
  ContentItemWithRevision,
  ContentRevision,
  HeadingBlockData,
  ImageBlockData,
  TextBlockData,
  generateId,
  nowIso,
} from '@reizoko/shared';

export interface ContentRepository {
  createItem(metadata: ContentItemMetadata, blocks: ContentBlock[]): Promise<ContentItemWithRevision>;
  getItem(id: string): Promise<ContentItemWithRevision | null>;
  updateItem(
    id: string,
    metadata: ContentItemMetadata,
    blocks: ContentBlock[],
  ): Promise<ContentItemWithRevision>;
  listItems(search?: string): Promise<ContentItemSummary[]>;
  duplicateItem(id: string): Promise<ContentItemWithRevision>;
  deleteItem(id: string): Promise<void>;
  getRevisions(contentItemId: string): Promise<ContentRevision[]>;
}

export class ContentService {
  constructor(private readonly repository: ContentRepository) {}

  async createDraft(title = 'Без названия'): Promise<ContentItemWithRevision> {
    const textBlock = createBlock('text', 0, { text: '' });
    return this.repository.createItem({ title }, [textBlock]);
  }

  async load(id: string): Promise<ContentItemWithRevision | null> {
    return this.repository.getItem(id);
  }

  async save(
    item: ContentItem,
    blocks: ContentBlock[],
  ): Promise<ContentItemWithRevision> {
    return this.repository.updateItem(item.id, item.metadata, blocks);
  }

  async searchLibrary(query?: string): Promise<ContentItemSummary[]> {
    return this.repository.listItems(query);
  }

  async duplicate(id: string): Promise<ContentItemWithRevision> {
    return this.repository.duplicateItem(id);
  }

  async remove(id: string): Promise<void> {
    return this.repository.deleteItem(id);
  }
}

export function createBlock(
  type: ContentBlockType,
  order: number,
  data?: Partial<TextBlockData | HeadingBlockData | ImageBlockData>,
): ContentBlock {
  switch (type) {
    case 'text':
      return {
        id: generateId(),
        type: 'text',
        order,
        data: { text: (data as TextBlockData)?.text ?? '' },
      };
    case 'heading':
      return {
        id: generateId(),
        type: 'heading',
        order,
        data: {
          text: (data as HeadingBlockData)?.text ?? '',
          level: (data as HeadingBlockData)?.level ?? 1,
        },
      };
    case 'image':
      return {
        id: generateId(),
        type: 'image',
        order,
        data: {
          mediaId: (data as ImageBlockData)?.mediaId ?? '',
          alt: (data as ImageBlockData)?.alt,
          caption: (data as ImageBlockData)?.caption,
        },
      };
    default:
      throw new Error(`Block type "${type}" is not implemented yet`);
  }
}

export function reorderBlocks(blocks: ContentBlock[], fromIndex: number, toIndex: number): ContentBlock[] {
  const result = [...blocks];
  const [removed] = result.splice(fromIndex, 1);
  if (!removed) return blocks;
  result.splice(toIndex, 0, removed);
  return result.map((block, index) => ({ ...block, order: index }));
}

export function extractPreviewText(blocks: ContentBlock[], maxLength = 120): string {
  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'heading') {
      const text = (block.data as TextBlockData | HeadingBlockData).text.trim();
      if (text) {
        return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
      }
    }
  }
  return '';
}

export { generateId, nowIso };
