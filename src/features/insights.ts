/**
 * Insights: computed statistics over a date range (week/month).
 * Pure functions — no React.
 */

import { AppData } from '../core/types';
import { DateKey, addDays, dateFromISO, dateKey, startOfDay, startOfWeek } from '../core/time';
import { habitStreak, goalProgress } from './today';
import { buildSummaries, CategorySlice } from './finance';

export type RangeLabel = 'week' | 'month';

export interface Insights {
  range: RangeLabel;
  tasks: { due: number; done: number; rate: number };
  habits: { scheduled: number; done: number; rate: number; bestStreak: number };
  focus: { minutes: number; sessions: number; avgMinutes: number };
  spending: { incomeCents: number; expenseCents: number; netCents: number; topCategory: CategorySlice | null; byCategory: CategorySlice[] };
  goals: { active: number; done: number; avgProgress: number };
  /** Minutes of focus per day across the range (for charts). */
  focusByDay: number[];
  /** 0..1 habit-completion ratio per day across the range (for charts). */
  habitByDay: number[];
  /** Date keys for each chart bucket. */
  dayKeys: DateKey[];
}

function rangeStart(label: RangeLabel, now: Date): Date {
  return label === 'week' ? startOfWeek(now) : new Date(now.getFullYear(), now.getMonth(), 1);
}

function rangeEnd(label: RangeLabel, start: Date): Date {
  return label === 'week' ? addDays(start, 6) : new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

/** Builds the insights payload for the given range. */
export function computeInsights(data: AppData, label: RangeLabel, now = new Date()): Insights {
  const start = rangeStart(label, now);
  const end = rangeEnd(label, start);
  const startKey = dateKey(start);
  const endKey = dateKey(end);

  // Tasks due in range (by due date), completion rate.
  const tasks = data.collections.tasks.filter((t) => !t.deletedAt && t.status !== 'cancelled');
  const dueTasks = tasks.filter((t) => {
    const due = t.dueAt ? dateFromISO(t.dueAt) : null;
    return due && due >= startOfDay(start) && due <= startOfDay(end);
  });
  const doneTasks = dueTasks.filter((t) => t.status === 'done');

  // Habits: scheduled days in range vs completed.
  let habitScheduled = 0;
  let habitDone = 0;
  let bestStreak = 0;
  for (const h of data.collections.habits) {
    if (h.deletedAt || h.archived) continue;
    const streak = habitStreak(h, now);
    if (streak > bestStreak) bestStreak = streak;
    let cursor = startOfDay(start);
    while (cursor.getTime() <= startOfDay(end).getTime()) {
      const dow = cursor.getDay();
      const scheduled =
        h.frequency.type === 'daily' ||
        (h.frequency.type === 'custom' && !!h.frequency.weekdays && h.frequency.weekdays.includes(dow)) ||
        h.frequency.type === 'weekly';
      if (scheduled) {
        habitScheduled++;
        if (h.completions.includes(dateKey(cursor))) habitDone++;
      }
      cursor = addDays(cursor, 1);
      if (habitScheduled > 100000) break;
    }
  }

  // Focus sessions in range.
  let focusMinutes = 0;
  let focusSessions = 0;
  const focusByDayMap = new Map<DateKey, number>();
  for (const s of data.collections.focusSessions) {
    if (s.deletedAt) continue;
    const key = dateKey(dateFromISO(s.startedAt));
    if (key >= startKey && key <= endKey) {
      focusMinutes += s.durationMin;
      focusSessions++;
      focusByDayMap.set(key, (focusByDayMap.get(key) || 0) + s.durationMin);
    }
  }

  // Per-day series (and per-day habit ratio).
  const dayKeys: DateKey[] = [];
  const focusByDay: number[] = [];
  const habitByDay: number[] = [];
  {
    let cursor = startOfDay(start);
    while (cursor.getTime() <= startOfDay(end).getTime()) {
      const key = dateKey(cursor);
      dayKeys.push(key);
      focusByDay.push(focusByDayMap.get(key) || 0);
      // Habit ratio for this day across all habits.
      let sched = 0;
      let done = 0;
      const dow = cursor.getDay();
      for (const h of data.collections.habits) {
        if (h.deletedAt || h.archived) continue;
        const scheduled =
          h.frequency.type === 'daily' ||
          (h.frequency.type === 'custom' && !!h.frequency.weekdays && h.frequency.weekdays.includes(dow)) ||
          h.frequency.type === 'weekly';
        if (!scheduled) continue;
        sched++;
        if (h.completions.includes(key)) done++;
      }
      habitByDay.push(sched > 0 ? done / sched : 0);
      cursor = addDays(cursor, 1);
    }
  }

  // Spending for the range.
  const spending = buildSummaries(data.collections.transactions, data.collections.categories, now);
  const rangeSummary = label === 'week' ? spending.week : spending.month;

  // Goals.
  const goals = data.collections.goals.filter((g) => !g.deletedAt);
  const activeGoals = goals.filter((g) => g.status === 'active');
  const doneGoals = goals.filter((g) => g.status === 'done');
  const avgProgress =
    activeGoals.length > 0
      ? Math.round(activeGoals.reduce((a, g) => a + goalProgress(g.id, data), 0) / activeGoals.length)
      : 0;

  return {
    range: label,
    tasks: {
      due: dueTasks.length,
      done: doneTasks.length,
      rate: dueTasks.length > 0 ? Math.round((doneTasks.length / dueTasks.length) * 100) : 0,
    },
    habits: {
      scheduled: habitScheduled,
      done: habitDone,
      rate: habitScheduled > 0 ? Math.round((habitDone / habitScheduled) * 100) : 0,
      bestStreak: bestStreak,
    },
    focus: {
      minutes: focusMinutes,
      sessions: focusSessions,
      avgMinutes: focusSessions > 0 ? Math.round(focusMinutes / focusSessions) : 0,
    },
    spending: {
      incomeCents: rangeSummary.incomeCents,
      expenseCents: rangeSummary.expenseCents,
      netCents: rangeSummary.netCents,
      topCategory: rangeSummary.byCategory[0] || null,
      byCategory: rangeSummary.byCategory,
    },
    goals: { active: activeGoals.length, done: doneGoals.length, avgProgress },
    focusByDay,
    habitByDay,
    dayKeys,
  };
}
