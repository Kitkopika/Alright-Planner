import { reminderBody, reminderIsSchedulable, schedulableReminders } from '../src/features/reminderSchedule';
import { Reminder } from '../src/core/types';

function mk(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    kind: 'reminder',
    title: 'Standup',
    remindAt: '2026-08-20T09:00',
    status: 'pending',
    createdAt: '2026-08-01T00:00:00',
    updatedAt: '2026-08-01T00:00:00',
    deletedAt: null,
    rev: 1,
    ...overrides,
  };
}

describe('reminderIsSchedulable', () => {
  const now = Date.parse('2026-08-20T08:00:00');

  it('schedules pending future reminders', () => {
    expect(reminderIsSchedulable(mk(), now)).toBe(true);
  });
  it('skips past reminders', () => {
    expect(reminderIsSchedulable(mk({ remindAt: '2026-08-20T07:59' }), now)).toBe(false);
  });
  it('skips triggered/dismissed/snoozed statuses', () => {
    expect(reminderIsSchedulable(mk({ status: 'triggered' }), now)).toBe(false);
    expect(reminderIsSchedulable(mk({ status: 'dismissed' }), now)).toBe(false);
    expect(reminderIsSchedulable(mk({ status: 'snoozed' }), now)).toBe(false);
  });
  it('skips soft-deleted reminders', () => {
    expect(reminderIsSchedulable(mk({ deletedAt: '2026-08-20T07:00' }), now)).toBe(false);
  });
});

describe('schedulableReminders', () => {
  const now = Date.parse('2026-08-20T08:00');

  it('returns only pending future reminders, soonest first', () => {
    const later = mk({ id: 'b', remindAt: '2026-08-21T09:00' });
    const sooner = mk({ id: 'a', remindAt: '2026-08-20T09:00' });
    const past = mk({ id: 'c', remindAt: '2026-08-01T09:00' });
    const done = mk({ id: 'd', status: 'dismissed' });
    const out = schedulableReminders([later, done, past, sooner], now);
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('reminderBody', () => {
  it('renders a locale-aware date+time line', () => {
    const r = mk({ remindAt: '2026-08-20T09:30' });
    expect(reminderBody(r, 'en')).toMatch(/20/i);
    expect(reminderBody(r, 'th')).toBeTruthy();
  });
});
