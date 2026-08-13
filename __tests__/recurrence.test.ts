import { Recurrence } from '../src/core/types';
import { happensOn, nextOccurrence, occurrencesBetween, describeRecurrence } from '../src/core/recurrence';
import { parseDateKey } from '../src/core/time';

const d = (key: string) => parseDateKey(key);

describe('recurrence engine', () => {
  it('generates daily occurrences', () => {
    const rule: Recurrence = { freq: 'daily', interval: 1 };
    const start = d('2026-08-10');
    expect(happensOn(rule, start, d('2026-08-10'))).toBe(true);
    expect(happensOn(rule, start, d('2026-08-14'))).toBe(true);
    expect(nextOccurrence(rule, start, d('2026-08-10'))?.getDate()).toBe(11);
  });

  it('respects interval', () => {
    const rule: Recurrence = { freq: 'daily', interval: 3 };
    const start = d('2026-08-10');
    expect(happensOn(rule, start, d('2026-08-13'))).toBe(true);
    expect(happensOn(rule, start, d('2026-08-14'))).toBe(false);
    expect(nextOccurrence(rule, start, d('2026-08-13'))?.getDate()).toBe(16);
    expect(happensOn(rule, start, d('2026-08-16'))).toBe(true);
  });

  it('handles weekly on specific weekdays', () => {
    const rule: Recurrence = { freq: 'weekly', interval: 1, byWeekdays: [1, 3, 5] }; // Mon, Wed, Fri
    const start = d('2026-08-10'); // Monday
    expect(happensOn(rule, start, d('2026-08-10'))).toBe(true);
    expect(happensOn(rule, start, d('2026-08-12'))).toBe(true);
    expect(happensOn(rule, start, d('2026-08-11'))).toBe(false); // Tuesday
    expect(happensOn(rule, start, d('2026-08-17'))).toBe(true); // next Monday
    const next = nextOccurrence(rule, start, d('2026-08-12'));
    expect(next?.getDate()).toBe(14); // Friday
  });

  it('respects until and count', () => {
    const until: Recurrence = { freq: 'daily', interval: 1, until: '2026-08-12' };
    expect(happensOn(until, d('2026-08-10'), d('2026-08-12'))).toBe(true);
    expect(happensOn(until, d('2026-08-10'), d('2026-08-13'))).toBe(false);

    const count: Recurrence = { freq: 'daily', interval: 1, count: 3 };
    const start = d('2026-08-10');
    expect(happensOn(count, start, d('2026-08-10'))).toBe(true);
    expect(happensOn(count, start, d('2026-08-11'))).toBe(true);
    expect(happensOn(count, start, d('2026-08-12'))).toBe(true);
    expect(happensOn(count, start, d('2026-08-13'))).toBe(false);
  });

  it('handles monthly (same day-of-month)', () => {
    const rule: Recurrence = { freq: 'monthly', interval: 1 };
    const start = d('2026-01-31');
    expect(happensOn(rule, start, d('2026-02-28'))).toBe(false); // Feb has no 31st
    expect(happensOn(rule, start, d('2026-03-31'))).toBe(true);
    const next = nextOccurrence(rule, start, d('2026-01-31'));
    // Next 31st after Jan 31 is Mar 31 (February is skipped).
    expect(next?.getMonth()).toBe(2);
    expect(next?.getDate()).toBe(31);
  });

  it('handles yearly', () => {
    const rule: Recurrence = { freq: 'yearly', interval: 1 };
    const start = d('2025-03-15');
    expect(happensOn(rule, start, d('2026-03-15'))).toBe(true);
    expect(happensOn(rule, start, d('2026-03-16'))).toBe(false);
  });

  it('enumerates occurrences between dates', () => {
    const rule: Recurrence = { freq: 'daily', interval: 1 };
    const start = d('2026-08-10');
    const days = occurrencesBetween(rule, start, d('2026-08-10'), d('2026-08-15'));
    expect(days.map(dateKey)).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15',
    ]);
  });

  it('describes rules in human-readable form', () => {
    expect(describeRecurrence({ freq: 'daily', interval: 1 })).toBe('day');
    expect(describeRecurrence({ freq: 'daily', interval: 2 })).toBe('every 2 day');
    expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekdays: [1, 5] })).toBe('week on Mon, Fri');
    expect(describeRecurrence({ freq: 'monthly', interval: 1 }, '2026-08-14')).toBe('month on day 14');
  });
});

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
