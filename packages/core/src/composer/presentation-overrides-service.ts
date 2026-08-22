import type { PlatformPresentationOverrides } from '@reizoko/shared';
import { createEmptyPresentationOverrides } from './media-transform.js';

export interface PresentationOverridesRepository {
  getByTarget(contentItemId: string, targetKey: string): Promise<PlatformPresentationOverrides | null>;
  listByContentItem(contentItemId: string): Promise<PlatformPresentationOverrides[]>;
  upsert(
    input: Omit<PlatformPresentationOverrides, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
    },
  ): Promise<PlatformPresentationOverrides>;
  deleteByTarget(contentItemId: string, targetKey: string): Promise<void>;
}

export class PresentationOverridesService {
  constructor(private readonly repository: PresentationOverridesRepository) {}

  async loadForContentItem(contentItemId: string): Promise<PlatformPresentationOverrides[]> {
    return this.repository.listByContentItem(contentItemId);
  }

  async getForTarget(
    contentItemId: string,
    platformId: string,
    socialAccountId?: string | null,
  ): Promise<PlatformPresentationOverrides | null> {
    const targetKey = `${platformId}:${socialAccountId ?? ''}`;
    return this.repository.getByTarget(contentItemId, targetKey);
  }

  async save(overrides: PlatformPresentationOverrides): Promise<PlatformPresentationOverrides> {
    return this.repository.upsert(overrides);
  }

  async resetTarget(
    contentItemId: string,
    platformId: string,
    socialAccountId?: string | null,
  ): Promise<void> {
    const targetKey = `${platformId}:${socialAccountId ?? ''}`;
    await this.repository.deleteByTarget(contentItemId, targetKey);
  }

  ensureOverrides(input: {
    contentItemId: string;
    platformId: string;
    socialAccountId?: string | null;
    existing?: PlatformPresentationOverrides | null;
  }): PlatformPresentationOverrides {
    if (input.existing) {
      return input.existing;
    }
    const empty = createEmptyPresentationOverrides(input);
    return {
      id: '',
      createdAt: '',
      updatedAt: '',
      ...empty,
    };
  }
}
