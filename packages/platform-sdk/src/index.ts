import type { ContentBlock } from '@reizoko/shared';
import type { ComponentType } from 'react';

export type PlatformValidationSeverity = 'info' | 'warning' | 'error';

export interface PlatformValidationIssue {
  severity: PlatformValidationSeverity;
  message: string;
  blockId?: string;
}

export interface PlatformCapabilities {
  maxTextLength?: number;
  maxImages?: number;
  supportsHeadings: boolean;
  supportsMultipleImages: boolean;
  supportsVideo: boolean;
  supportsLinks: boolean;
}

export interface TransformedContent {
  text: string;
  images: Array<{ mediaId: string; alt?: string; caption?: string }>;
  warnings: PlatformValidationIssue[];
}

export interface PlatformAdapter {
  id: string;
  name: string;
  icon: string;
  color: string;
  available: boolean;
  plannedMessage?: string;
  capabilities: PlatformCapabilities;
  transform(blocks: ContentBlock[]): TransformedContent;
  validate(blocks: ContentBlock[]): PlatformValidationIssue[];
}

export interface PlatformPreviewAccountContext {
  displayName: string;
  handle?: string | null;
  avatarMediaId?: string | null;
}

export interface PlatformPreviewProps {
  blocks: ContentBlock[];
  transformed: TransformedContent;
  issues: PlatformValidationIssue[];
  socialAccount?: PlatformPreviewAccountContext | null;
  getMediaUrl: (mediaId: string) => string | null;
}

export interface PlatformDefinition {
  adapter: PlatformAdapter;
  Preview: ComponentType<PlatformPreviewProps>;
}

export class PlatformRegistry {
  private platforms = new Map<string, PlatformDefinition>();

  register(definition: PlatformDefinition): void {
    this.platforms.set(definition.adapter.id, definition);
  }

  get(id: string): PlatformDefinition | undefined {
    return this.platforms.get(id);
  }

  getAll(): PlatformDefinition[] {
    return Array.from(this.platforms.values());
  }

  getAvailable(): PlatformDefinition[] {
    return this.getAll().filter((p) => p.adapter.available);
  }

  getCatalog(): PlatformDefinition[] {
    return this.getAll();
  }
}

export const platformRegistry = new PlatformRegistry();

export function registerPlatform(definition: PlatformDefinition): void {
  platformRegistry.register(definition);
}

export * from './utils/transform-helpers.js';
