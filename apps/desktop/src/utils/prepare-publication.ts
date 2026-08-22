import { isContentEmpty } from '@reizoko/core';
import type { ContentBlock, OpenPlatformTarget } from '@reizoko/shared';

export function getPreparePublicationState(
  blocks: ContentBlock[],
  openPlatformTargets: OpenPlatformTarget[],
): { canPrepare: boolean; disabledReason?: string } {
  if (openPlatformTargets.length === 0) {
    return {
      canPrepare: false,
      disabledReason: 'Откройте хотя бы одну площадку, чтобы подготовить публикацию.',
    };
  }
  if (isContentEmpty(blocks)) {
    return {
      canPrepare: false,
      disabledReason: 'Добавьте текст или изображение, чтобы подготовить публикацию.',
    };
  }
  return { canPrepare: true };
}
