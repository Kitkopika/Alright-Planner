/**
 * Simple recurrence engine (RRULE-like subset): daily / weekly / monthly /
 * yearly with an interval, optional weekday set (weekly), optional end date
 * and optional max count. Pure and unit-testable.
 */

import type { Recurrence } from './types';
import {
  addDays,
  addMonths,
  addYears,
  dateKey,
  dateFromISO,
  parseDateKey,
  startOfDay,
  tryParseISO,
} from './time';

/**
 * Returns the next occurrence strictly after `from`, or null when the series
 * has ended. The first occurrence is `start` (the entity's original date).
 */
export function nextOccurrence(
  rule: Recurrence,
  start: Date,
  from: Date
): Date | null {
  const interval = Math.max(1, Math.floor(rule.interval) || 1);
  const after = startOfDay(addDays(from, 1));
  let candidate: Date | null = null;

  if (rule.freq === 'daily') {
    const days = Math.max(1, Math.ceil((after.getTime() - startOfDay(start).getTime()) / 86400000 / interval));
    candidate = addDays(start, days * interval);
  } else if (rule.freq === 'weekly') {
    const weekdays = rule.byWeekdays && rule.byWeekdays.length
      ? [...rule.byWeekdays].sort((a, b) => a - b)
      : [start.getDay()];
    // Scan forward week by week, at most a bounded number of steps.
    for (let w = 0; w < 4000; w++) {
      const weekStart = addDays(startOfDay(start), w * 7 * interval);
      for (const wd of weekdays) {
        const day = addDays(weekStart, (wd - weekStart.getDay() + 7) % 7);
        if (day.getTime() >= after.getTime()) {
          candidate = day;
          break;
        }
      }
      if (candidate) break;
    }
  } else if (rule.freq === 'monthly') {
    // Only months that actually contain `start`'s day-of-month are
    // occurrences (RRULE-style): Jan 31 skips February.
    for (let m = 1; m <= 2400; m++) {
      const day = addMonths(start, m * interval);
      if (day.getDate() !== start.getDate()) continue; // e.g. Feb 28 for a 31st series
      if (day.getTime() >= after.getTime()) {
        candidate = day;
        break;
      }
    }
  } else if (rule.freq === 'yearly') {
    for (let y = 1; y <= 400; y++) {
      const day = addYears(start, y * interval);
      if (day.getMonth() !== start.getMonth() || day.getDate() !== start.getDate()) continue; // Feb 29 -> Mar 1 overflow
      if (day.getTime() >= after.getTime()) {
        candidate = day;
        break;
      }
    }
  }

  if (!candidate) return null;

  // Respect count (limit the number of occurrences, counting the first).
  if (rule.count != null && rule.count > 0) {
    const index = occurrenceIndex(rule, start, candidate);
    if (index >= rule.count) return null;
  }
  // Respect until (inclusive end date).
  if (rule.until) {
    const until = tryParseISO(rule.until);
    if (until && candidate.getTime() > startOfDay(until).getTime()) return null;
  }
  return candidate;
}

/** 0-based index of an occurrence within the series. */
function occurrenceIndex(rule: Recurrence, start: Date, occurrence: Date): number {
  const d = dayDiff(start, occurrence);
  switch (rule.freq) {
    case 'daily':
      return d / Math.max(1, rule.interval);
    case 'weekly':
      return Math.floor(d / 7 / Math.max(1, rule.interval));
    case 'monthly':
      return monthDiff(start, occurrence) / Math.max(1, rule.interval);
    case 'yearly':
      return (occurrence.getFullYear() - start.getFullYear()) / Math.max(1, rule.interval);
  }
}

function monthDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

/**
 * Enumerates occurrences between `from` and `to` (inclusive, by day), capped
 * at `max`. Includes `from` itself when it is an occurrence.
 */
export function occurrencesBetween(
  rule: Recurrence,
  start: Date,
  from: Date,
  to: Date,
  max = 500
): Date[] {
  const out: Date[] = [];
  let cursor = startOfDay(from);
  const end = startOfDay(to);
  // If the series starts after `from`, begin at the series start.
  if (startOfDay(start).getTime() > cursor.getTime()) cursor = startOfDay(start);
  const limit = end.getTime() + 86400000;
  // Walk occurrence by occurrence.
  let current: Date | null = null;
  // Check whether cursor itself is an occurrence.
  const first = startOfDay(start);
  if (happensOn(rule, start, cursor)) {
    current = cursor;
  } else {
    current = nextOccurrence(rule, start, addDays(cursor, -1));
  }
  let guard = 0;
  while (current && current.getTime() < limit && out.length < max && guard < max * 2 + 100) {
    out.push(current);
    const nxt = nextOccurrence(rule, start, current);
    if (!nxt || nxt.getTime() <= current.getTime()) break;
    current = nxt;
    guard++;
  }
  void first;
  return out;
}

/** True when `date` is an occurrence of the series (used by Today views). */
export function happensOn(rule: Recurrence, start: Date, date: Date): boolean {
  const d = startOfDay(date);
  const s = startOfDay(start);
  if (d.getTime() < s.getTime()) return false;

  if (rule.freq === 'daily') {
    if (dayDiff(s, d) % Math.max(1, rule.interval) !== 0) return false;
  } else if (rule.freq === 'weekly') {
    const weekdays = rule.byWeekdays && rule.byWeekdays.length ? rule.byWeekdays : [s.getDay()];
    const weekIndex = Math.floor(dayDiff(s, d) / 7);
    if (weekIndex % Math.max(1, rule.interval) !== 0) return false;
    if (!weekdays.includes(d.getDay())) return false;
  } else if (rule.freq === 'monthly') {
    if (monthDiff(s, d) % Math.max(1, rule.interval) !== 0) return false;
    if (d.getDate() !== s.getDate()) return false;
  } else if (rule.freq === 'yearly') {
    if ((d.getFullYear() - s.getFullYear()) % Math.max(1, rule.interval) !== 0) return false;
    if (d.getMonth() !== s.getMonth() || d.getDate() !== s.getDate()) return false;
  }

  // Count limit.
  if (rule.count != null && rule.count > 0 && occurrenceIndex(rule, start, d) >= rule.count) {
    return false;
  }
  if (rule.until) {
    const until = tryParseISO(rule.until);
    if (until && d.getTime() > startOfDay(until).getTime()) return false;
  }
  return true;
}

/**
 * Returns the series start as a Date (the entity's own date). For events and
 * reminders the series starts at the entity's startAt/remindAt.
 */
export function seriesStart(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = tryParseISO(iso);
  return d ? startOfDay(d) : null;
}

/**
 * Convenience: does a recurring entity (with `startAt`-style ISO field)
 * occur on the given date key?
 */
export function occursOnDateKey(
  rule: Recurrence,
  startISO: string | null | undefined,
  dateKey: string
): boolean {
  if (!rule || !startISO) return false;
  const start = seriesStart(startISO);
  if (!start) return false;
  return happensOn(rule, start, parseDateKey(dateKey));
}

/** Human-readable summary of a rule, e.g. "every week on Mon, Fri". */
export function describeRecurrence(rule: Recurrence | null | undefined, startISO?: string | null): string {
  if (!rule) return '';
  const every = rule.interval > 1 ? `every ${rule.interval} ` : '';
  switch (rule.freq) {
    case 'daily':
      return `${every}day`;
    case 'weekly': {
      if (rule.byWeekdays && rule.byWeekdays.length) {
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${every}week on ${rule.byWeekdays.map((w) => names[w]).join(', ')}`;
      }
      return `${every}week`;
    }
    case 'monthly':
      return `${every}month${startISO ? ` on day ${dateFromISO(startISO).getDate()}` : ''}`;
    case 'yearly':
      return `${every}year`;
  }
}
