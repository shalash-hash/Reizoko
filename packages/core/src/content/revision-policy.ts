import type { ContentRevision } from '@reizoko/shared';

/** Minimum idle gap before autosave creates a new historical checkpoint. */
export const REVISION_CHECKPOINT_GAP_MS = 5 * 60 * 1000;

export type RevisionHistoryGroup = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

export interface GroupedRevisionHistory {
  group: RevisionHistoryGroup;
  label: string;
  revisions: ContentRevision[];
}

const GROUP_LABELS: Record<RevisionHistoryGroup, string> = {
  today: 'Сегодня',
  yesterday: 'Вчера',
  thisWeek: 'Эта неделя',
  earlier: 'Ранее',
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getRevisionHistoryGroup(isoDate: string, now = new Date()): RevisionHistoryGroup {
  const date = new Date(isoDate);
  const today = startOfLocalDay(now);
  const target = startOfLocalDay(date);
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'thisWeek';
  return 'earlier';
}

/**
 * Filters raw revisions for human-readable history.
 * Legacy autosave revisions (pre-v2 policy) are sampled by time gap.
 */
export function filterRevisionsForHistory(
  revisions: ContentRevision[],
  currentRevisionId: string,
): ContentRevision[] {
  const sorted = [...revisions].sort((a, b) => b.version - a.version);
  const result: ContentRevision[] = [];
  let lastLegacyKeptAt: number | null = null;

  for (const revision of sorted) {
    if (revision.id === currentRevisionId) {
      result.push(revision);
      continue;
    }

    if (revision.kind !== 'checkpoint') continue;

    if (revision.origin === 'manual' || revision.origin === 'restore' || revision.origin === 'auto' || revision.origin === 'publication') {
      result.push(revision);
      continue;
    }

    if (revision.origin === 'legacy') {
      const timestamp = new Date(revision.createdAt).getTime();
      if (lastLegacyKeptAt === null || lastLegacyKeptAt - timestamp >= REVISION_CHECKPOINT_GAP_MS) {
        result.push(revision);
        lastLegacyKeptAt = timestamp;
      }
    }
  }

  return result.sort((a, b) => b.version - a.version);
}

export function groupRevisionsForHistory(revisions: ContentRevision[]): GroupedRevisionHistory[] {
  const groups = new Map<RevisionHistoryGroup, ContentRevision[]>();
  const order: RevisionHistoryGroup[] = ['today', 'yesterday', 'thisWeek', 'earlier'];

  for (const revision of revisions) {
    const group = getRevisionHistoryGroup(revision.createdAt);
    const bucket = groups.get(group) ?? [];
    bucket.push(revision);
    groups.set(group, bucket);
  }

  return order
    .filter((group) => (groups.get(group)?.length ?? 0) > 0)
    .map((group) => ({
      group,
      label: GROUP_LABELS[group],
      revisions: groups.get(group) ?? [],
    }));
}

export function getRevisionOriginLabel(revision: ContentRevision): string {
  if (revision.origin === 'manual') return 'Вручную';
  if (revision.origin === 'publication') return 'Перед публикацией';
  if (revision.origin === 'restore') {
    return revision.restoreFromVersion
      ? `Восстановление версии ${revision.restoreFromVersion}`
      : 'Восстановление';
  }
  if (revision.origin === 'legacy') return 'Автосохранение';
  return 'Автоматически';
}
