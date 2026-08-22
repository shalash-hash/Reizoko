import { describe, expect, it } from 'vitest';
import type { PlatformAdapter } from '@reizoko/platform-sdk';
import {
  getAllPlatformCatalog,
  getGroupedPlatformCatalog,
  groupPlatformsByAvailability,
  sortPlatformsByAvailability,
} from './planned-catalog';

function createPlatform(id: string, name: string, available: boolean): PlatformAdapter {
  return {
    id,
    name,
    icon: id,
    color: '#000000',
    available,
    capabilities: {
      supportsHeadings: false,
      supportsMultipleImages: false,
      supportsVideo: false,
      supportsLinks: false,
    },
    transform: () => ({ text: '', images: [], warnings: [] }),
    validate: () => [],
  };
}

describe('groupPlatformsByAvailability', () => {
  it('places available platforms before planned platforms', () => {
    const grouped = groupPlatformsByAvailability([
      createPlatform('bluesky', 'Bluesky', false),
      createPlatform('telegram', 'Telegram', true),
      createPlatform('facebook', 'Facebook', false),
      createPlatform('instagram', 'Instagram', true),
    ]);

    expect(grouped.available.map((platform) => platform.id)).toEqual(['instagram', 'telegram']);
    expect(grouped.planned.map((platform) => platform.id)).toEqual(['bluesky', 'facebook']);
  });

  it('sorts each group alphabetically by platform name', () => {
    const grouped = groupPlatformsByAvailability([
      createPlatform('vk', 'VK', true),
      createPlatform('instagram', 'Instagram', true),
      createPlatform('x', 'X', false),
      createPlatform('bluesky', 'Bluesky', false),
    ]);

    expect(grouped.available.map((platform) => platform.name)).toEqual(['Instagram', 'VK']);
    expect(grouped.planned.map((platform) => platform.name)).toEqual(['Bluesky', 'X']);
  });

  it('uses registry availability for registered platforms', () => {
    const grouped = getGroupedPlatformCatalog({
      getCatalog: () => [
        { adapter: createPlatform('instagram', 'Instagram', true) },
        { adapter: createPlatform('telegram', 'Telegram', true) },
        { adapter: createPlatform('vk', 'VK', true) },
      ],
    });
    const availableIds = grouped.available.map((platform) => platform.id);
    const plannedIds = grouped.planned.map((platform) => platform.id);

    expect(availableIds).toEqual(['instagram', 'telegram', 'vk']);
    expect(plannedIds).toEqual(
      expect.arrayContaining(['bluesky', 'facebook', 'linkedin', 'threads', 'tiktok', 'x']),
    );
    expect(plannedIds).not.toEqual(expect.arrayContaining(['telegram']));
  });

  it('merges planned catalog entries that are not registered yet', () => {
    const catalog = getAllPlatformCatalog({
      getCatalog: () => [{ adapter: createPlatform('telegram', 'Telegram', true) }],
    });

    expect(catalog[0]?.id).toBe('telegram');
    expect(catalog.some((platform) => platform.id === 'bluesky' && !platform.available)).toBe(true);
  });

  it('moves a newly available platform to the available group automatically', () => {
    const catalog = sortPlatformsByAvailability([
      createPlatform('bluesky', 'Bluesky', false),
      createPlatform('new-platform', 'New Platform', true),
      createPlatform('telegram', 'Telegram', true),
    ]);

    expect(catalog.map((platform) => platform.id)).toEqual([
      'new-platform',
      'telegram',
      'bluesky',
    ]);
  });

  it('does not depend on hardcoded platform names in ordering logic', () => {
    const catalog = getAllPlatformCatalog({
      getCatalog: () => [
        { adapter: createPlatform('vk', 'VK', true) },
        { adapter: createPlatform('instagram', 'Instagram', true) },
      ],
    });
    const regrouped = sortPlatformsByAvailability([...catalog].reverse());
    const availableCount = catalog.filter((platform) => platform.available).length;

    expect(regrouped.slice(0, availableCount).every((platform) => platform.available)).toBe(true);
    expect(regrouped.slice(availableCount).every((platform) => !platform.available)).toBe(true);
  });
});
