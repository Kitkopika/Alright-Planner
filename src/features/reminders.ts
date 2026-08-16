/**
 * Materializes "remind me before" offsets into concrete Reminder entities.
 * An event/task with `reminders: [{ offsetMin, id }]` gets one Reminder per
 * offset, scheduled at start/due time minus the offset.
 */

import { Reminder, ReminderOffset, Recurrence } from '../core/types';
import { newId } from '../core/id';
import { tryParseISO, isoDateTime } from '../core/time';

export type EntityLike = {
  id: string;
  title: string;
  startAt?: string | null;
  dueAt?: string | null;
  recurrence?: Recurrence | null;
  reminders?: ReminderOffset[] | null;
};

/** The Reminder entities that SHOULD exist for an event/task (no orphans kept). */
export function remindersForEntity(kind: 'event' | 'task', entity: EntityLike): Reminder[] {
  // Events anchor to startAt; tasks to dueAt (falling back to startAt).
  const baseIso = kind === 'event' ? entity.startAt : entity.dueAt || entity.startAt;
  if (!baseIso) return [];
  const base = tryParseISO(baseIso);
  if (!base) return [];
  const offsets: ReminderOffset[] = entity.reminders || [];
  const now = new Date();
  return offsets.map((off) => {
    const at = new Date(base.getTime() - off.offsetMin * 60000);
    return {
      id: newId(),
      kind: 'reminder' as const,
      title: entity.title,
      remindAt: isoDateTime(at),
      recurrence: entity.recurrence || null,
      eventId: kind === 'event' ? entity.id : null,
      taskId: kind === 'task' ? entity.id : null,
      status: 'pending' as const,
      snoozedUntil: null,
      triggeredDates: [],
      createdAt: isoDateTime(now),
      updatedAt: isoDateTime(now),
      deletedAt: null,
      rev: 1,
    };
  });
}
