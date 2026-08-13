import {
  addDays,
  dateKey,
  dayDiff,
  isSameWeek,
  parseDateKey,
  startOfWeek,
  todayKey,
  tryParseISO,
} from '../src/core/time';

describe('time helpers', () => {
  it('produces stable local date keys', () => {
    const d = new Date(2026, 7, 14, 18, 30);
    expect(dateKey(d)).toBe('2026-08-14');
  });

  it('parses date keys back to local midnight', () => {
    const d = parseDateKey('2026-08-14');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
  });

  it('computes day differences across month boundaries', () => {
    const a = new Date(2026, 6, 31);
    const b = new Date(2026, 7, 2);
    expect(dayDiff(a, b)).toBe(2);
    expect(dayDiff(b, a)).toBe(-2);
  });

  it('adds days and weeks start on Monday', () => {
    const friday = new Date(2026, 7, 14); // a Friday
    expect(startOfWeek(friday).getDay()).toBe(1); // Monday
    expect(dateKey(addDays(friday, 3))).toBe('2026-08-17');
  });

  it('isSameWeek works across a weekend boundary', () => {
    const monday = new Date(2026, 7, 10);
    const sunday = new Date(2026, 7, 16);
    const nextMonday = new Date(2026, 7, 17);
    expect(isSameWeek(monday, sunday)).toBe(true);
    expect(isSameWeek(monday, nextMonday)).toBe(false);
  });

  it('accepts and rejects ISO strings', () => {
    expect(tryParseISO('2026-08-14')).not.toBeNull();
    expect(tryParseISO('2026-08-14T18:30')).not.toBeNull();
    expect(tryParseISO('2026-02-30')).toBeNull();
    expect(tryParseISO('2026-13-01')).toBeNull();
    expect(tryParseISO('not a date')).toBeNull();
    expect(tryParseISO('')).toBeNull();
  });

  it('todayKey matches the current local date', () => {
    expect(todayKey()).toBe(dateKey(new Date()));
  });
});
