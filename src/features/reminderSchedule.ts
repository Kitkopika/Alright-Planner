/**
 * Pure helpers for turning stored Reminder entities into system-notification
 * schedule entries. Kept free of expo-notifications imports so it is unit-
 * testable in isolation.
 */

import { Reminder } from '../core/types';
import { tryParseISO } from '../core/time';

/** A reminder is worth scheduling while pending, not deleted, and in the future. */
export function reminderIsSchedulable(r: Reminder, nowMs: number = Date.now()): boolean {
  if (r.status !== 'pending' || r.deletedAt) return false;
  const at = tryParseISO(r.remindAt);
  return at !== null && at.getTime() > nowMs;
}

/** Pending, future reminders, soonest first. */
export function schedulableReminders(reminders: Reminder[], nowMs: number = Date.now()): Reminder[] {
  return reminders
    .filter((r) => reminderIsSchedulable(r, nowMs))
    .sort((a, b) => (tryParseISO(a.remindAt)?.getTime() ?? 0) - (tryParseISO(b.remindAt)?.getTime() ?? 0));
}

/** Notification body: a short, locale-aware date+time line. */
export function reminderBody(r: Reminder, lang: 'en' | 'th'): string {
  const at = tryParseISO(r.remindAt);
  if (!at) return '';
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const date = at.toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' });
  const time = at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return lang === 'th' ? `${date} ${time}` : `${date}, ${time}`;
}
