/**
 * Date/time helpers. All operations are LOCAL time (no timezone math) so the
 * JSON stays human-readable and portable. Date keys are "YYYY-MM-DD".
 */

export type DateKey = string;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Local date key for a Date, e.g. "2026-08-14". */
export function dateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "YYYY-MM-DD" -> Date at local midnight. */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** ISO datetime with local time, no milliseconds: "YYYY-MM-DDTHH:mm". */
export function isoDateTime(d: Date): string {
  return `${dateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "HH:mm" from a Date. */
export function timeHM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function nowIso(): string {
  return isoDateTime(new Date());
}

/** "YYYY-MM-DD" -> Date at local time (without time part). */
export function dateFromISO(iso: string): Date {
  // Date-only "YYYY-MM-DD" parses as UTC in JS; rebuild as local.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return parseDateKey(iso);
  const [date, time = '00:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10) || 0);
  return new Date(y, m - 1, d, hh, mm);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

export function addYears(d: Date, years: number): Date {
  return new Date(d.getFullYear() + years, d.getMonth(), d.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameWeek(a: Date, b: Date, weekStartsOn = 1): boolean {
  const dow = (a.getDay() - weekStartsOn + 7) % 7;
  const start = addDays(startOfDay(a), -dow);
  const end = addDays(start, 6);
  return b.getTime() >= start.getTime() && b.getTime() <= end.getTime();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Monday-based week start. */
export function startOfWeek(d: Date, weekStartsOn = 1): Date {
  const dow = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(startOfDay(d), -dow);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function daysInMonth(d: Date): number {
  return endOfMonth(d).getDate();
}

/** Whole days between two dates (b - a), truncated. */
export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function todayKey(): DateKey {
  return dateKey(new Date());
}

export function weekdayNames(short = true): string[] {
  return short ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
}

/** True when `date` is within [from, to] inclusive (both dates). */
export function inRange(date: Date, from: Date, to: Date): boolean {
  return date.getTime() >= startOfDay(from).getTime() && date.getTime() <= startOfDay(to).getTime();
}

/** Parses "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"; returns null when invalid. */
export function tryParseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const hh = m[4] ? parseInt(m[4], 10) : 0;
  const mm = m[5] ? parseInt(m[5], 10) : 0;
  if (hh > 23 || mm > 59) return null;
  const out = new Date(y, mo - 1, d, hh, mm);
  // Reject nonsense dates like Feb 30.
  if (out.getFullYear() !== y || out.getMonth() !== mo - 1 || out.getDate() !== d) return null;
  return out;
}

/** Formats an ISO string as a friendly short label, e.g. "Today 18:30", "Fri 14 Aug". */
export function friendlyDateTime(iso: string | null | undefined, now = new Date()): string {
  const d = tryParseISO(iso);
  if (!d) return '';
  const hasTime = /T\d{2}:\d{2}/.test(iso || '');
  const day =
    isSameDay(d, now) ? 'Today'
    : dayDiff(d, now) === 1 ? 'Tomorrow'
    : dayDiff(d, now) === -1 ? 'Yesterday'
    : `${weekdayNames(true)[d.getDay()]} ${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`;
  return hasTime ? `${day} ${timeHM(d)}` : day;
}

/** Compares two ISO strings by value (safe because format is fixed-width). */
export function isoCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
