/**
 * Today dashboard aggregation. Pure functions over AppData — no React.
 * Computes schedule, tasks due, reminders, habits/routines, spending and
 * goals for "today", plus an overall daily progress figure.
 */

import { AppData, Event, Habit, Routine, Task, Reminder } from '../core/types';
import {
  DateKey,
  dateKey,
  dayDiff,
  isoCompare,
  isoDateTime,
  parseDateKey,
  startOfDay,
  tryParseISO,
  weekdayNames,
} from '../core/time';
import { happensOn } from '../core/recurrence';
import { buildSummaries, formatMoney } from './finance';

export interface ScheduleItem {
  id: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  allDay: boolean;
  color?: string;
  source: 'event';
  eventId: string;
  taskId?: string | null;
}

export interface TodayTask {
  task: Task;
  /** For recurring tasks: the instance date key. */
  instanceDate: DateKey;
  overdue: boolean;
}

export interface HabitToday {
  habit: Habit;
  scheduledToday: boolean;
  doneToday: boolean;
  streak: number;
}

export interface RoutineToday {
  routine: Routine;
  doneToday: boolean;
  doneSteps: number;
  totalSteps: number;
}

export interface DailyProgress {
  done: number;
  total: number;
  pct: number;
}

export interface GoalSnapshot {
  id: string;
  title: string;
  color?: string;
  deadline?: string | null;
  progressPct: number;
}

export interface TodayData {
  date: DateKey;
  weekday: string;
  schedule: ScheduleItem[];
  tasks: TodayTask[];
  habits: HabitToday[];
  routines: RoutineToday[];
  reminders: Reminder[];
  spending: { incomeCents: number; expenseCents: number; netCents: number; label: string };
  goals: GoalSnapshot[];
  progress: DailyProgress;
  totalSpentLabel: string;
}

function eventInstances(events: Event[], day: Date): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  for (const ev of events) {
    if (ev.deletedAt) continue;
    const start = tryParseISO(ev.startAt);
    if (!start) continue;
    if (ev.recurrence) {
      if (!happensOn(ev.recurrence, start, day)) continue;
      // Rebase the instance onto `day` preserving wall-clock time.
      const rebased = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        start.getHours(),
        start.getMinutes()
      );
      const end = tryParseISO(ev.endAt);
      const rebasedEnd = end
        ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), end.getHours(), end.getMinutes())
        : null;
      out.push({
        id: `${ev.id}:${dateKey(day)}`,
        title: ev.title,
        startAt: isoDateTime(rebased),
        endAt: rebasedEnd ? isoDateTime(rebasedEnd) : null,
        allDay: !!ev.allDay,
        color: ev.color,
        source: 'event',
        eventId: ev.id,
        taskId: ev.taskId,
      });
    } else {
      if (dayDiff(startOfDay(start), day) !== 0) continue;
      out.push({
        id: ev.id,
        title: ev.title,
        startAt: ev.startAt,
        endAt: ev.endAt || null,
        allDay: !!ev.allDay,
        color: ev.color,
        source: 'event',
        eventId: ev.id,
        taskId: ev.taskId,
      });
    }
  }
  // All-day first, then by start time.
  return out.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return isoCompare(a.startAt || '', b.startAt || '');
  });
}

function taskInstances(tasks: Task[], day: Date): TodayTask[] {
  const out: TodayTask[] = [];
  for (const t of tasks) {
    if (t.deletedAt || t.status === 'cancelled' || t.parentTaskId) continue; // subtasks live inside their parent
    const doneForDay = t.status === 'done';
    if (t.recurrence) {
      const start = tryParseISO(t.dueAt || t.startAt);
      if (!start) continue;
      if (!happensOn(t.recurrence, start, day)) continue;
      const key = dateKey(day);
      const completed = (t.completedDates || []).includes(key);
      if (completed) continue; // instance already completed
      out.push({ task: t, instanceDate: key, overdue: dayDiff(day, new Date()) > 0 });
    } else {
      const due = tryParseISO(t.dueAt);
      if (!due) continue;
      // Due today OR overdue (still needs attention). dayDiff(due, day) = day - due.
      if (dayDiff(startOfDay(due), day) < 0) continue; // due in the future
      if (doneForDay) continue;
      out.push({ task: t, instanceDate: dateKey(due), overdue: dayDiff(startOfDay(due), day) > 0 });
    }
  }
  // Overdue first, then priority, then time.
  return out.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const prio = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    return prio[a.task.priority] - prio[b.task.priority];
  });
}

export function habitStreak(habit: Habit, day: Date): number {
  const done = new Set(habit.completions);
  let streak = 0;
  let cursor = startOfDay(day);
  // Count backwards including today only if done today.
  if (done.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  while (done.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 3650) break;
  }
  return streak;
}

export function habitScheduledToday(habit: Habit, day: Date): boolean {
  const dow = day.getDay();
  switch (habit.frequency.type) {
    case 'daily':
      return true;
    case 'custom':
      return !!habit.frequency.weekdays && habit.frequency.weekdays.includes(dow);
    case 'weekly':
      return true; // goal is times-per-week, so today is always eligible
  }
}

function habitsToday(habits: Habit[], day: Date): HabitToday[] {
  return habits
    .filter((h) => !h.deletedAt && !h.archived && habitScheduledToday(h, day))
    .map((h) => ({
      habit: h,
      scheduledToday: true,
      doneToday: h.completions.includes(dateKey(day)),
      streak: habitStreak(h, day),
    }));
}

function routinesToday(routines: Routine[], completions: AppData['collections']['routineCompletions'], day: Date): RoutineToday[] {
  const dow = day.getDay();
  const key = dateKey(day);
  return routines
    .filter((r) => !r.deletedAt && r.weekdays.includes(dow))
    .map((r) => {
      const done = completions.find((c) => c.routineId === r.id && c.date === key && !c.deletedAt);
      const totalSteps = r.steps.length;
      const doneSteps = done ? r.steps.filter((s) => done.doneStepIds.includes(s.id)).length : 0;
      return { routine: r, doneToday: totalSteps > 0 && doneSteps === totalSteps, doneSteps, totalSteps };
    });
}

function dueReminders(reminders: Reminder[], day: Date): Reminder[] {
  const end = startOfDay(day);
  end.setDate(end.getDate() + 1);
  const key = dateKey(day);
  return reminders
    .filter((r) => {
      if (r.deletedAt || r.status === 'dismissed') return false;
      const when = tryParseISO(r.remindAt);
      if (!when) return false;
      if (r.recurrence) {
        // Recurring: show the instance when it occurs today and hasn't been
        // triggered for today yet (per-instance dismissal).
        if (!happensOn(r.recurrence, when, day)) return false;
        return !(r.triggeredDates || []).includes(key);
      }
      // One-off: pending or snoozed, and due today or overdue (still needs
      // attention). Snoozed reminders keep their +1h remindAt and reappear.
      return (r.status === 'pending' || r.status === 'snoozed') && when.getTime() < end.getTime();
    })
    .sort((a, b) => isoCompare(a.remindAt, b.remindAt));
}

export function goalProgress(goalId: string, data: AppData): number {
  const projects = data.collections.projects.filter((p) => p.goalId === goalId && !p.deletedAt);
  const projectIds = new Set(projects.map((p) => p.id));
  const tasks = data.collections.tasks.filter((t) => !t.deletedAt && t.projectId && projectIds.has(t.projectId));
  const actionable = tasks.filter((t) => t.status !== 'cancelled');
  if (actionable.length > 0) {
    const done = actionable.filter((t) => t.status === 'done').length;
    return Math.round((done / actionable.length) * 100);
  }
  const activeProjects = projects.filter((p) => p.status !== 'archived');
  if (activeProjects.length > 0) {
    const doneProjects = activeProjects.filter((p) => p.status === 'done').length;
    return Math.round((doneProjects / activeProjects.length) * 100);
  }
  return 0;
}

/** Aggregates everything the Today screen needs for `day`. */
export function computeToday(data: AppData, day: Date): TodayData {
  const habits = habitsToday(data.collections.habits, day);
  const routines = routinesToday(data.collections.routines, data.collections.routineCompletions, day);
  const tasks = taskInstances(data.collections.tasks, day);
  const schedule = eventInstances(data.collections.events, day);
  const reminders = dueReminders(data.collections.reminders, day);
  const spending = buildSummaries(data.collections.transactions, data.collections.categories, day).today;

  const goals = data.collections.goals
    .filter((g) => !g.deletedAt && g.status === 'active')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((g) => ({ id: g.id, title: g.title, color: g.color, deadline: g.deadline, progressPct: goalProgress(g.id, data) }));

  // Daily progress: tasks + habits + routine steps.
  const total = tasks.length + habits.length + routines.reduce((a, r) => a + r.totalSteps, 0);
  const done = habits.filter((h) => h.doneToday).length +
    routines.reduce((a, r) => a + r.doneSteps, 0) +
    tasks.filter((t) => t.task.status === 'done').length;
  const progress: DailyProgress = {
    done,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };

  return {
    date: dateKey(day),
    weekday: weekdayNames(false)[day.getDay()],
    schedule,
    tasks,
    habits,
    routines,
    reminders,
    spending: {
      incomeCents: spending.incomeCents,
      expenseCents: spending.expenseCents,
      netCents: spending.netCents,
      label: formatMoney(spending.netCents),
    },
    goals,
    progress,
    totalSpentLabel: formatMoney(spending.expenseCents),
  };
}

/** Convenience for tests: parse a date key. */
export function dayFromKey(key: DateKey): Date {
  return parseDateKey(key);
}
