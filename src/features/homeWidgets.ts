/**
 * Chart data for the optional Today-screen widgets (money / habits / focus).
 * Each returns 7 points (one per day) plus a scale max for the bar chart.
 */

import { AppData } from '../core/types';
import { dateKey } from '../core/time';
import { habitScheduledToday } from './today';
import { buildSummaries } from './finance';

export interface ChartDay {
  key: string;
  label: string;
}

export interface ChartSeries {
  points: { key: string; label: string; value: number }[];
  /** Value that the tallest bar should be scaled against (>= 1). */
  max: number;
}

export function lastNDays(n: number, dayLabel: (d: Date) => string): ChartDay[] {
  const out: ChartDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({ key: dateKey(d), label: dayLabel(d) });
  }
  return out;
}

/** Net spending (expense = negative, income = positive) per day, in currency units. */
export function chartMoneySeries(data: AppData, days: ChartDay[]): ChartSeries {
  const byKey = new Map<string, number>();
  for (const tx of data.collections.transactions) {
    if (tx.deletedAt) continue;
    const key = dateKey(new Date(tx.occurredAt));
    byKey.set(key, (byKey.get(key) || 0) + (tx.kind2 === 'expense' ? -tx.amountCents : tx.amountCents));
  }
  const points = days.map((d) => ({ key: d.key, label: d.label, value: (byKey.get(d.key) || 0) / 100 }));
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  return { points, max };
}

/** Fraction (0..1) of scheduled habits completed per day. */
export function chartHabitsSeries(data: AppData, days: ChartDay[]): ChartSeries {
  const byKey = new Map<string, { done: number; scheduled: number }>();
  for (const habit of data.collections.habits) {
    if (habit.deletedAt || habit.archived) continue;
    for (const d of days) {
      const day = new Date(`${d.key}T12:00:00`);
      if (!habitScheduledToday(habit, day)) continue;
      const cur = byKey.get(d.key) || { done: 0, scheduled: 0 };
      cur.scheduled += 1;
      if (habit.completions.includes(d.key)) cur.done += 1;
      byKey.set(d.key, cur);
    }
  }
  const points = days.map((d) => {
    const c = byKey.get(d.key) || { done: 0, scheduled: 0 };
    return { key: d.key, label: d.label, value: c.scheduled > 0 ? c.done / c.scheduled : 0 };
  });
  return { points, max: 1 };
}

/** Focus minutes per day. */
export function chartFocusSeries(data: AppData, days: ChartDay[]): ChartSeries {
  const byKey = new Map<string, number>();
  for (const s of data.collections.focusSessions) {
    if (s.deletedAt) continue;
    const key = dateKey(new Date(s.startedAt));
    byKey.set(key, (byKey.get(key) || 0) + (s.durationMin || 0));
  }
  const points = days.map((d) => ({ key: d.key, label: d.label, value: byKey.get(d.key) || 0 }));
  const max = Math.max(...points.map((p) => p.value), 1);
  return { points, max };
}

/** Tasks completed per day (by completedAt), last 7 days. */
export function chartTasksSeries(data: AppData, days: ChartDay[]): ChartSeries {
  const byKey = new Map<string, number>();
  for (const task of data.collections.tasks) {
    if (task.deletedAt || !task.completedAt) continue;
    const key = dateKey(new Date(task.completedAt));
    byKey.set(key, (byKey.get(key) || 0) + 1);
  }
  const points = days.map((d) => ({ key: d.key, label: d.label, value: byKey.get(d.key) || 0 }));
  const max = Math.max(...points.map((p) => p.value), 1);
  return { points, max };
}

/** Total balance across all transactions, in cents. */
export function moneyBalanceCents(data: AppData): number {
  let sum = 0;
  for (const tx of data.collections.transactions) {
    if (tx.deletedAt) continue;
    sum += tx.kind2 === 'expense' ? -tx.amountCents : tx.amountCents;
  }
  return sum;
}

export interface SpendingCategory {
  name: string;
  color: string;
  cents: number;
  pct: number;
}

/** Top expense categories this month (by amount), 0..n. */
export function topSpending(data: AppData, n: number, now = new Date()): SpendingCategory[] {
  const summaries = buildSummaries(data.collections.transactions, data.collections.categories, now);
  return summaries.month.byCategory
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents)
    .slice(0, n)
    .map((c) => ({ name: c.name, color: c.color, cents: c.cents, pct: c.pct }));
}
