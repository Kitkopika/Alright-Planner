import { makeData, baseEntity } from './testUtils';
import { chartTasksSeries, moneyBalanceCents, topSpending, lastNDays } from '../src/features/homeWidgets';

describe('home widget data', () => {
  const dayLabel = (d: Date) => d.getDate().toString();

  it('chartTasksSeries counts completed tasks per day', () => {
    const days = lastNDays(7, dayLabel);
    const data = makeData({
      tasks: [
        { ...baseEntity('t1'), kind: 'task', title: 'a', priority: 'medium', status: 'done', completedAt: `${days[3].key}T10:00` },
        { ...baseEntity('t2'), kind: 'task', title: 'b', priority: 'medium', status: 'done', completedAt: `${days[3].key}T11:00` },
        { ...baseEntity('t3'), kind: 'task', title: 'c', priority: 'medium', status: 'todo', completedAt: null },
        { ...baseEntity('t4'), kind: 'task', title: 'd', priority: 'medium', status: 'done', completedAt: `${days[1].key}T09:00` },
      ],
    });
    const series = chartTasksSeries(data, days);
    expect(series.points[3].value).toBe(2);
    expect(series.points[1].value).toBe(1);
    expect(series.points[0].value).toBe(0);
    expect(series.max).toBe(2);
  });

  it('moneyBalanceCents sums income minus expenses', () => {
    const data = makeData({
      transactions: [
        { ...baseEntity('x1'), kind: 'transaction', kind2: 'income', amountCents: 10000, currency: 'USD', occurredAt: '2026-01-05T10:00' },
        { ...baseEntity('x2'), kind: 'transaction', kind2: 'expense', amountCents: 2500, currency: 'USD', occurredAt: '2026-01-06T10:00' },
        { ...baseEntity('x3'), kind: 'transaction', kind2: 'expense', amountCents: 1500, currency: 'USD', occurredAt: '2026-01-07T10:00', deletedAt: '2026-01-08T00:00' },
      ],
    });
    expect(moneyBalanceCents(data)).toBe(7500); // deleted expense ignored
  });

  it('topSpending returns the largest categories this month', () => {
    const data = makeData({
      transactions: [
        { ...baseEntity('x1'), kind: 'transaction', kind2: 'expense', amountCents: 1000, currency: 'USD', categoryId: 'c1', occurredAt: '2026-01-10T10:00' },
        { ...baseEntity('x2'), kind: 'transaction', kind2: 'expense', amountCents: 5000, currency: 'USD', categoryId: 'c2', occurredAt: '2026-01-12T10:00' },
        { ...baseEntity('x3'), kind: 'transaction', kind2: 'expense', amountCents: 2000, currency: 'USD', categoryId: 'c1', occurredAt: '2026-01-13T10:00' },
      ],
      categories: [
        { ...baseEntity('c1'), kind: 'category', name: 'Food', color: '#FF0000', icon: 'restaurant', kind2: 'expense' },
        { ...baseEntity('c2'), kind: 'category', name: 'Travel', color: '#00FF00', icon: 'airplane', kind2: 'expense' },
      ],
    });
    const top = topSpending(data, 2, new Date(2026, 0, 15));
    expect(top.map((c) => c.name)).toEqual(['Travel', 'Food']);
    expect(top[0].cents).toBe(5000);
  });
});
