import { describe, expect, it } from 'vitest';
import { bootstrapDatabase } from '../../../database/src/bootstrap.js';
import { MemoryDatabaseClient } from '../../../database/src/test/memory-database-client.js';
import { PlatformRegistry } from '@reizoko/platform-sdk';
import type { PlatformAdapter } from '@reizoko/platform-sdk';
import { createBlock } from '../content/block-factory.js';
import { upsertMediaTransform, presentationTargetKey } from '../composer/media-transform.js';
import { PublicationService } from './publication-service.js';
import { FakeTelegramTransport } from '../telegram/fake-telegram-transport.js';
import { FakeVkTransport } from '../vk/fake-vk-transport.js';

const instagramTestAdapter: PlatformAdapter = {
  id: 'instagram',
  name: 'Instagram',
  icon: '📷',
  color: '#E1306C',
  available: true,
  composerCapabilities: {
    supportedAspectRatios: [{ id: '1:1', label: '1:1', ratio: 1 }],
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
    supportsHeadings: false,
    supportsMultipleImages: true,
    supportsVideo: false,
    supportsLinks: false,
  },
  transform: (blocks) => ({
    text: blocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.data.text ?? ''))
      .join('\n'),
    images: blocks
      .filter((block) => block.type === 'image')
      .map((block) => ({ mediaId: String(block.data.mediaId ?? '') })),
    warnings: [],
  }),
  validate: () => [],
};

const telegramTestAdapter: PlatformAdapter = {
  id: 'telegram',
  name: 'Telegram',
  icon: '✈',
  color: '#2AABEE',
  available: true,
  composerCapabilities: {
    supportedAspectRatios: [{ id: 'original', label: 'Оригинал', ratio: null }],
    allowCrop: false,
    allowZoom: false,
    allowPan: false,
    allowRotation: false,
    allowAdjustments: false,
    allowFilters: false,
    allowCarouselReorder: true,
    allowTextOverride: true,
    allowAltText: false,
  },
  publisherCapabilities: {
    supportsDerivedMedia: false,
    supportsCarousel: true,
    supportsHtmlCaption: true,
    supportsNativeFilters: false,
  },
  capabilities: {
    supportsHeadings: false,
    supportsMultipleImages: true,
    supportsVideo: false,
    supportsLinks: true,
  },
  transform: (blocks) => ({
    text: blocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.data.text ?? ''))
      .join('\n'),
    images: blocks
      .filter((block) => block.type === 'image')
      .map((block) => ({ mediaId: String(block.data.mediaId ?? '') })),
    warnings: [],
  }),
  validate: () => [],
};

describe('publication presentation snapshots', () => {
  it('freezes platform transform at prepare time', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);
    const registry = new PlatformRegistry();
    registry.register({ adapter: instagramTestAdapter, Preview: () => null });
    const publicationService = new PublicationService(
      db.content,
      db.publicationBatches,
      db.publications,
      registry,
      db.socialAccounts,
      db.platformConnections,
      new FakeTelegramTransport(),
      new FakeVkTransport(),
    );

    const item = await db.content.createItem({ title: 'Composer post' }, [
      createBlock('image', 0, { mediaId: 'img-1' }),
    ]);

    const targetKey = presentationTargetKey('instagram', null);
    let overrides = {
      id: 'ov-1',
      contentItemId: item.id,
      targetKey,
      platformId: 'instagram',
      socialAccountId: null,
      media: [],
      createdAt: 'now',
      updatedAt: 'now',
    };
    overrides = upsertMediaTransform(overrides, {
      mediaId: 'img-1',
      aspectRatio: '1:1',
      zoom: 1.25,
    });

    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [{ platformId: 'instagram', socialAccountId: null }],
      presentationByTargetKey: { [targetKey]: overrides },
    });

    const frozenZoom = prepared.publications[0]!.preparedSnapshot.presentation?.media[0]?.transform
      ?.zoom;
    expect(frozenZoom).toBe(1.25);
    expect(prepared.publications[0]!.preparedSnapshot.formatVersion).toBe(2);

    overrides = upsertMediaTransform(overrides, {
      ...overrides.media[0]!.transform,
      zoom: 2,
    });

    const stored = await db.publications.getById(prepared.publications[0]!.id);
    expect(stored?.preparedSnapshot.presentation?.media[0]?.transform?.zoom).toBe(1.25);
    expect(overrides.media[0]?.transform.zoom).toBe(2);
    client.close();
  });

  it('keeps account-specific overrides isolated', async () => {
    const client = new MemoryDatabaseClient();
    const db = await bootstrapDatabase(client);
    const registry = new PlatformRegistry();
    registry.register({ adapter: instagramTestAdapter, Preview: () => null });
    const publicationService = new PublicationService(
      db.content,
      db.publicationBatches,
      db.publications,
      registry,
      db.socialAccounts,
      db.platformConnections,
      new FakeTelegramTransport(),
      new FakeVkTransport(),
    );

    const item = await db.content.createItem({ title: 'Accounts' }, [
      createBlock('image', 0, { mediaId: 'img-1' }),
    ]);

    const accountA = await db.socialAccounts.create({
      platformId: 'instagram',
      displayName: 'Личный',
    });
    const accountB = await db.socialAccounts.create({
      platformId: 'instagram',
      displayName: 'Компания',
    });

    const keyA = presentationTargetKey('instagram', accountA.id);
    const keyB = presentationTargetKey('instagram', accountB.id);

    const overridesA = upsertMediaTransform(
      {
        id: 'ov-a',
        contentItemId: item.id,
        targetKey: keyA,
        platformId: 'instagram',
        socialAccountId: accountA.id,
        media: [],
        createdAt: 'now',
        updatedAt: 'now',
      },
      { mediaId: 'img-1', aspectRatio: '1:1', zoom: 1.1 },
    );
    const overridesB = upsertMediaTransform(
      {
        id: 'ov-b',
        contentItemId: item.id,
        targetKey: keyB,
        platformId: 'instagram',
        socialAccountId: accountB.id,
        media: [],
        createdAt: 'now',
        updatedAt: 'now',
      },
      { mediaId: 'img-1', aspectRatio: '4:5', zoom: 1.8 },
    );

    const prepared = await publicationService.prepareBatch({
      contentItemId: item.id,
      targets: [
        { platformId: 'instagram', socialAccountId: accountA.id },
        { platformId: 'instagram', socialAccountId: accountB.id },
      ],
      presentationByTargetKey: {
        [keyA]: overridesA,
        [keyB]: overridesB,
      },
    });

    const pubA = prepared.publications.find((p) => p.socialAccountId === accountA.id);
    const pubB = prepared.publications.find((p) => p.socialAccountId === accountB.id);
    expect(pubA?.preparedSnapshot.presentation?.media[0]?.transform?.aspectRatio).toBe('1:1');
    expect(pubB?.preparedSnapshot.presentation?.media[0]?.transform?.aspectRatio).toBe('4:5');
    client.close();
  });
});

describe('platform composer capabilities', () => {
  it('exposes instagram crop controls but not telegram crop', () => {
    expect(instagramTestAdapter.composerCapabilities?.allowCrop).toBe(true);
    expect(telegramTestAdapter.composerCapabilities?.allowCrop).toBe(false);
  });

  it('declares publisher capabilities separately from composer capabilities', () => {
    expect(instagramTestAdapter.publisherCapabilities?.supportsDerivedMedia).toBe(true);
    expect(telegramTestAdapter.publisherCapabilities?.supportsDerivedMedia).toBe(false);
  });
});
