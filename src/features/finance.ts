/**
 * Finance summaries: day/week/month/year income, expense, net, plus spending
 * breakdown by category. All amounts are integer minor units (cents).
 */

import { Category, Transaction } from '../core/types';
import { dateFromISO, startOfDay, addDays, startOfWeek, startOfMonth } from '../core/time';

export interface RangeSummary {
  label: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  count: number;
  byCategory: CategorySlice[];
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string;
  cents: number;
  count: number;
  /** Share of total expenses in this range, 0..1. */
  pct: number;
}

export interface FinanceSummaries {
  today: RangeSummary;
  week: RangeSummary;
  month: RangeSummary;
  year: RangeSummary;
}

const CATEGORY_FALLBACK = { name: 'Uncategorized', color: '#9CA3AF' };

export function categoryById(categories: Category[], id: string | null | undefined): { name: string; color: string } {
  if (!id) return CATEGORY_FALLBACK;
  const c = categories.find((x) => x.id === id);
  return c ? { name: c.name, color: c.color || CATEGORY_FALLBACK.color } : CATEGORY_FALLBACK;
}

function summarize(
  label: string,
  txns: Transaction[],
  categories: Category[]
): RangeSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  const byCat = new Map<string, CategorySlice>();
  let count = 0;

  for (const t of txns) {
    count++;
    if (t.kind2 === 'income') {
      incomeCents += t.amountCents;
      continue;
    }
    expenseCents += t.amountCents;
    const key = t.categoryId || 'none';
    const cat = categoryById(categories, t.categoryId);
    const slice = byCat.get(key) || {
      categoryId: t.categoryId || null,
      name: cat.name,
      color: cat.color,
      cents: 0,
      count: 0,
      pct: 0,
    };
    slice.cents += t.amountCents;
    slice.count += 1;
    byCat.set(key, slice);
  }

  const slices = [...byCat.values()].sort((a, b) => b.cents - a.cents);
  for (const s of slices) s.pct = expenseCents > 0 ? s.cents / expenseCents : 0;

  return {
    label,
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    count,
    byCategory: slices,
  };
}

/** Builds day/week/month/year summaries for the given transactions. */
export function buildSummaries(transactions: Transaction[], categories: Category[], now = new Date()): FinanceSummaries {
  // Ignore tombstoned (soft-deleted) transactions everywhere.
  const live = transactions.filter((t) => !t.deletedAt);
  // Week uses Monday start; month/year use calendar ranges.
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const inRangeTxns = (from: Date, to: Date) =>
    live.filter((t) => {
      const when = dateFromISO(t.occurredAt);
      const startMs = startOfDay(from).getTime();
      const endExclusive = startOfDay(to).getTime() + 86400000;
      return when.getTime() >= startMs && when.getTime() < endExclusive;
    });

  return {
    today: summarize('Today', inRangeTxns(now, now), categories),
    week: summarize('This week', inRangeTxns(weekStart, addDays(weekStart, 6)), categories),
    month: summarize('This month', inRangeTxns(monthStart, endOfMonth(now)), categories),
    year: summarize('This year', inRangeTxns(yearStart, new Date(now.getFullYear(), 11, 31)), categories),
  };
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Cents -> "12.34". Never uses float division for the fractional part. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${sign}${major}.${minor.toString().padStart(2, '0')}`;
}

export function formatMoney(cents: number, currency = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', KRW: '₩', CNY: '¥' };
  const sym = symbols[currency] || `${currency} `;
  return `${sym}${formatCents(cents)}`;
}
