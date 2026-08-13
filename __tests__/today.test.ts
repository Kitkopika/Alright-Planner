import { computeToday } from '../src/features/today';
import { baseEntity, makeData } from './testUtils';

const FRI = new Date(2026, 7, 14, 10, 0); // Friday 2026-08-14

describe('computeToday', () => {
  it('aggregates schedule, tasks, habits, routines, reminders, spending and goals', () => {
    const data = makeData({
      events: [
        { ...baseEntity('e1'), kind: 'event', title: 'Standup', startAt: '2026-08-14T09:30', endAt: '2026-08-14T10:00' },
        { ...baseEntity('e2'), kind: 'event', title: 'Weekly review', startAt: '2026-08-10T17:00', recurrence: { freq: 'weekly', interval: 1, byWeekdays: [5] } },
      ],
      tasks: [
        { ...baseEntity('t1'), kind: 'task', title: 'Due today', status: 'todo', priority: 'high', dueAt: '2026-08-14T18:00' },
        { ...baseEntity('t2'), kind: 'task', title: 'Overdue', status: 'todo', priority: 'medium', dueAt: '2026-08-13T18:00' },
        { ...baseEntity('t3'), kind: 'task', title: 'Later', status: 'todo', priority: 'low', dueAt: '2026-08-20T18:00' },
      ],
      habits: [
        { ...baseEntity('h1'), kind: 'habit', name: 'Read', frequency: { type: 'daily' }, completions: ['2026-08-13'] },
      ],
      routines: [
        {
          ...baseEntity('r1'),
          kind: 'routine',
          name: 'Evening routine',
          weekdays: [5],
          steps: [
            { id: 's1', label: 'Plan tomorrow' },
            { id: 's2', label: 'No screens' },
          ],
        },
      ],
      routineCompletions: [
        { ...baseEntity('rc1'), kind: 'routineCompletion', routineId: 'r1', date: '2026-08-14', doneStepIds: ['s1'] },
      ],
      reminders: [
        { ...baseEntity('m1'), kind: 'reminder', title: 'Take meds', remindAt: '2026-08-14T08:00', status: 'pending' },
      ],
      transactions: [
        { ...baseEntity('x1'), kind: 'transaction', kind2: 'expense', amountCents: 800, currency: 'USD', occurredAt: '2026-08-14T09:00' },
        { ...baseEntity('x2'), kind: 'transaction', kind2: 'income', amountCents: 10000, currency: 'USD', occurredAt: '2026-08-14T09:00' },
      ],
      goals: [{ ...baseEntity('g1'), kind: 'goal', title: 'Get fit', status: 'active' }],
      projects: [{ ...baseEntity('p1'), kind: 'project', name: 'Fitness', status: 'active', goalId: 'g1' }],
    });

    const today = computeToday(data, FRI);

    expect(today.schedule.map((s) => s.title)).toEqual(['Standup', 'Weekly review']);
    expect(today.tasks.map((t) => t.task.title).sort()).toEqual(['Due today', 'Overdue']);
    expect(today.tasks.find((t) => t.task.title === 'Overdue')?.overdue).toBe(true);
    expect(today.habits).toHaveLength(1);
    expect(today.habits[0].doneToday).toBe(false);
    expect(today.habits[0].streak).toBe(0);
    expect(today.routines).toHaveLength(1);
    expect(today.routines[0].doneSteps).toBe(1);
    expect(today.routines[0].doneToday).toBe(false);
    expect(today.reminders).toHaveLength(1);
    expect(today.spending.expenseCents).toBe(800);
    expect(today.spending.netCents).toBe(9200);
    expect(today.goals).toHaveLength(1);
    // Daily progress: 2 tasks + 1 habit + 2 routine steps = 5 total.
    // Done: 1 routine step (s1) already completed for today.
    expect(today.progress.total).toBe(5);
    expect(today.progress.done).toBe(1);
  });

  it('marks completed habits and routines as done', () => {
    const data = makeData({
      habits: [
        { ...baseEntity('h1'), kind: 'habit', name: 'Read', frequency: { type: 'daily' }, completions: ['2026-08-14'] },
      ],
      routines: [
        {
          ...baseEntity('r1'),
          kind: 'routine',
          name: 'R',
          weekdays: [5],
          steps: [{ id: 's1', label: 'A' }],
        },
      ],
      routineCompletions: [
        { ...baseEntity('rc1'), kind: 'routineCompletion', routineId: 'r1', date: '2026-08-14', doneStepIds: ['s1'] },
      ],
    });
    const today = computeToday(data, FRI);
    expect(today.habits[0].doneToday).toBe(true);
    expect(today.routines[0].doneToday).toBe(true);
    expect(today.progress.done).toBe(2);
    expect(today.progress.pct).toBe(100);
  });

  it('expands recurring tasks into today when due', () => {
    const data = makeData({
      tasks: [
        {
          ...baseEntity('t1'),
          kind: 'task',
          title: 'Gym',
          status: 'todo',
          priority: 'medium',
          dueAt: '2026-08-07T08:00',
          recurrence: { freq: 'weekly', interval: 1, byWeekdays: [5] },
        },
      ],
    });
    const today = computeToday(data, FRI);
    expect(today.tasks).toHaveLength(1);
    expect(today.tasks[0].task.title).toBe('Gym');
  });

  it('hides recurring tasks already completed today', () => {
    const data = makeData({
      tasks: [
        {
          ...baseEntity('t1'),
          kind: 'task',
          title: 'Gym',
          status: 'todo',
          priority: 'medium',
          dueAt: '2026-08-07T08:00',
          recurrence: { freq: 'weekly', interval: 1, byWeekdays: [5] },
          completedDates: ['2026-08-14'],
        },
      ],
    });
    const today = computeToday(data, FRI);
    expect(today.tasks).toHaveLength(0);
  });
});
