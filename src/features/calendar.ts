/**
 * Calendar aggregation: per-day items (events + tasks) and month grids.
 * Pure functions — no React.
 */

import { AppData, Event, Task } from '../core/types';
import { dateKey, dayDiff, isoCompare, parseDateKey, startOfDay, startOfMonth, tryParseISO } from '../core/time';
import { happensOn } from '../core/recurrence';

export interface CalendarItem {
  id: string;
  title: string;
  timeLabel: string;
  allDay: boolean;
  color?: string;
  kind: 'event' | 'task';
  /** Source entity id (for editing). */
  entityId: string;
  done?: boolean;
  overdue?: boolean;
  /** True for events that span more than one day (long/multi-day). */
  spanning?: boolean;
}

export interface DayItems {
  date: Date;
  items: CalendarItem[];
}

/** Month grid: 42 cells (6 weeks) starting on Monday. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = startOfMonth(first);
  const offset = (start.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(year, month, 1 - offset);
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    out.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return out;
}

function hasTime(iso: string | null | undefined): boolean {
  return !!iso && /T\d{2}:\d{2}/.test(iso);
}

/** True when the event's end date is later than its start date (multi-day). */
function eventSpanning(ev: Event, start: Date): boolean {
  if (!ev.endAt) return false;
  const end = tryParseISO(ev.endAt);
  if (!end) return false;
  return dayDiff(startOfDay(start), startOfDay(end)) > 0;
}

function eventOnDay(ev: Event, day: Date): CalendarItem | null {
  if (ev.deletedAt) return null; // tombstoned events must not ghost in the calendar
  const start = tryParseISO(ev.startAt);
  if (!start) return null;
  if (ev.recurrence) {
    if (!happensOn(ev.recurrence, start, day)) return null;
    const rebased = new Date(day.getFullYear(), day.getMonth(), day.getDate(), start.getHours(), start.getMinutes());
    return {
      id: `${ev.id}:${dateKey(day)}`,
      title: ev.title,
      timeLabel: ev.allDay ? 'All day' : `${String(rebased.getHours()).padStart(2, '0')}:${String(rebased.getMinutes()).padStart(2, '0')}`,
      allDay: !!ev.allDay,
      color: ev.color,
      kind: 'event',
      entityId: ev.id,
      spanning: eventSpanning(ev, start),
    };
  }
  // Non-recurring: include the event on every day of [start, end] so
  // multi-day events span their full range (shown with a line indicator).
  const startDay = startOfDay(start);
  const dayStart = startOfDay(day);
  if (dayStart.getTime() < startDay.getTime()) return null;
  const end = ev.endAt ? tryParseISO(ev.endAt) : null;
  const endDay = end ? startOfDay(end) : startDay;
  if (dayStart.getTime() > endDay.getTime()) return null;
  const spanning = endDay.getTime() > startDay.getTime();
  return {
    id: ev.id,
    title: ev.title,
    timeLabel: ev.allDay ? 'All day' : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    allDay: !!ev.allDay,
    color: ev.color,
    kind: 'event',
    entityId: ev.id,
    spanning,
  };
}

function taskOnDay(t: Task, day: Date): CalendarItem | null {
  if (t.deletedAt || t.status === 'cancelled') return null;
  const due = tryParseISO(t.dueAt);
  if (!due) return null;
  if (t.recurrence) {
    if (!happensOn(t.recurrence, due, day)) return null;
    const key = dateKey(day);
    const done = (t.completedDates || []).includes(key);
    return {
      id: `${t.id}:${key}`,
      title: t.title,
      timeLabel: hasTime(t.dueAt) ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : '',
      allDay: !hasTime(t.dueAt),
      kind: 'task',
      entityId: t.id,
      done,
      overdue: dayDiff(day, new Date()) > 0,
    };
  }
  if (dayDiff(startOfDay(due), day) !== 0) return null;
  return {
    id: t.id,
    title: t.title,
    timeLabel: hasTime(t.dueAt) ? `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}` : '',
    allDay: !hasTime(t.dueAt),
    kind: 'task',
    entityId: t.id,
    done: t.status === 'done',
    overdue: dayDiff(day, new Date()) > 0 && t.status !== 'done',
  };
}

/** All items (events + tasks) for one day, sorted by time. */
export function dayItems(data: AppData, day: Date): DayItems {
  const items: CalendarItem[] = [];
  for (const ev of data.collections.events) {
    const item = eventOnDay(ev, day);
    if (item) items.push(item);
  }
  for (const t of data.collections.tasks) {
    const item = taskOnDay(t, day);
    if (item) items.push(item);
  }
  items.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return isoCompare(a.timeLabel, b.timeLabel);
  });
  return { date: day, items };
}

/** Items for every day in [from, to] inclusive. */
export function dayItemsRange(data: AppData, from: Date, to: Date, maxDays = 92): DayItems[] {
  const out: DayItems[] = [];
  const days = Math.min(dayDiff(from, to), maxDays);
  for (let i = 0; i <= days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    out.push(dayItems(data, d));
  }
  return out;
}

/** Parses "YYYY-MM-DD" or returns today. */
export function dateFromKeyOrToday(key: string): Date {
  const d = parseDateKey(key);
  return d && !isNaN(d.getTime()) ? d : new Date();
}
