import { computeInsights } from '../src/features/insights';
import { baseEntity, makeData } from './testUtils';

describe('computeInsights', () => {
  it('computes task/habit/focus/spending/goal stats for a week', () => {
    const now = new Date(2026, 7, 14); // Friday
    const data = makeData({
      tasks: [
        { ...baseEntity('t1'), kind: 'task', title: 'A', status: 'done', priority: 'low', dueAt: '2026-08-11' },
        { ...baseEntity('t2'), kind: 'task', title: 'B', status: 'todo', priority: 'low', dueAt: '2026-08-12' },
        { ...baseEntity('t3'), kind: 'task', title: 'C', status: 'done', priority: 'low', dueAt: '2026-08-10' }, // Monday, in week
      ],
      habits: [
        { ...baseEntity('h1'), kind: 'habit', name: 'Read', frequency: { type: 'daily' }, completions: ['2026-08-10', '2026-08-11', '2026-08-12'] },
      ],
      focusSessions: [
        { ...baseEntity('f1'), kind: 'focusSession', startedAt: '2026-08-12T09:00', endedAt: '2026-08-12T09:25', durationMin: 25, type: 'pomodoro' },
        { ...baseEntity('f2'), kind: 'focusSession', startedAt: '2026-08-13T10:00', endedAt: '2026-08-13T11:00', durationMin: 60, type: 'custom' },
        { ...baseEntity('f3'), kind: 'focusSession', startedAt: '2026-07-01T10:00', endedAt: '2026-07-01T10:30', durationMin: 30, type: 'custom' }, // outside
      ],
      transactions: [
        { ...baseEntity('x1'), kind: 'transaction', kind2: 'expense', amountCents: 1000, currency: 'USD', occurredAt: '2026-08-13T12:00' },
        { ...baseEntity('x2'), kind: 'transaction', kind2: 'expense', amountCents: 2000, currency: 'USD', occurredAt: '2026-08-05T12:00' }, // outside week
      ],
      goals: [
        { ...baseEntity('g1'), kind: 'goal', title: 'Goal A', status: 'active' },
        { ...baseEntity('g2'), kind: 'goal', title: 'Goal B', status: 'done' },
      ],
    });

    const insights = computeInsights(data, 'week', now);
    // Tasks due in the week of Aug 10-16: t1(11), t2(12), t3(10) = 3 due, 2 done.
    expect(insights.tasks.due).toBe(3);
    expect(insights.tasks.done).toBe(2);
    expect(insights.tasks.rate).toBe(67);
    // Habit: 7 scheduled days, 3 done.
    expect(insights.habits.scheduled).toBe(7);
    expect(insights.habits.done).toBe(3);
    expect(insights.habits.rate).toBe(43);
    // Current streak ends today (today not done), so 0.
    expect(insights.habits.bestStreak).toBe(0);
    // Focus: 85 minutes, 2 sessions, avg 43 (rounded).
    expect(insights.focus.minutes).toBe(85);
    expect(insights.focus.sessions).toBe(2);
    expect(insights.focus.avgMinutes).toBe(43);
    // Spending: week = 1000.
    expect(insights.spending.expenseCents).toBe(1000);
    // Goals: 1 active, 1 done.
    expect(insights.goals.active).toBe(1);
    expect(insights.goals.done).toBe(1);
  });

  it('returns zeros when there is no data', () => {
    const insights = computeInsights(makeData(), 'week', new Date(2026, 7, 14));
    expect(insights.tasks).toEqual({ due: 0, done: 0, rate: 0, overdue: 0 });
    expect(insights.habits.scheduled).toBe(0);
    expect(insights.focus.minutes).toBe(0);
    expect(insights.spending.expenseCents).toBe(0);
  });
});
