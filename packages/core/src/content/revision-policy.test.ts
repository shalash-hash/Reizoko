import { describe, expect, it } from 'vitest';
import type { ContentRevision } from '@reizoko/shared';
import { filterRevisionsForHistory } from './revision-policy.js';

function revision(partial: Partial<ContentRevision> & Pick<ContentRevision, 'id' | 'version'>): ContentRevision {
  return {
    contentItemId: 'item-1',
    createdAt: '2026-08-22T10:00:00.000Z',
    updatedAt: '2026-08-22T10:00:00.000Z',
    blocks: [],
    metadata: { title: `Title ${partial.version}` },
    origin: 'legacy',
    kind: 'checkpoint',
    ...partial,
  };
}

describe('filterRevisionsForHistory', () => {
  it('always includes the current revision', () => {
    const current = revision({ id: 'current', version: 5, kind: 'working', origin: 'auto' });
    const result = filterRevisionsForHistory([current], 'current');
    expect(result.some((item) => item.id === 'current')).toBe(true);
  });

  it('samples legacy autosave revisions by time gap', () => {
    const current = revision({ id: 'current', version: 10, kind: 'working', origin: 'auto' });
    const legacy = [
      revision({
        id: 'l1',
        version: 9,
        createdAt: '2026-08-22T12:00:00.000Z',
        updatedAt: '2026-08-22T12:00:00.000Z',
      }),
      revision({
        id: 'l2',
        version: 8,
        createdAt: '2026-08-22T11:59:30.000Z',
        updatedAt: '2026-08-22T11:59:30.000Z',
      }),
      revision({
        id: 'l3',
        version: 7,
        createdAt: '2026-08-22T11:50:00.000Z',
        updatedAt: '2026-08-22T11:50:00.000Z',
      }),
    ];

    const result = filterRevisionsForHistory([current, ...legacy], 'current');
    expect(result.filter((item) => item.origin === 'legacy')).toHaveLength(2);
  });
});
