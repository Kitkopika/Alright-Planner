import { buildSummaries, formatCents, formatMoney } from '../src/features/finance';
import { transactionsToCSV } from '../src/features/financeCsv';
import { baseEntity, makeData } from './testUtils';

const cat = (id: string, name: string) => ({
  ...baseEntity(id),
  kind: 'category' as const,
  name,
  kind2: 'expense' as const,
  color: '#ff0000',
});

describe('finance summaries', () => {
  it('builds day/week/month/year totals', () => {
    const now = new Date(2026, 7, 14); // Friday 2026-08-14
    const data = makeData({
      categories: [cat('food', 'Food')],
      transactions: [
        { ...baseEntity('t1'), kind: 'transaction', kind2: 'expense', amountCents: 1234, currency: 'USD', categoryId: 'food', occurredAt: '2026-08-14T12:00' },
        { ...baseEntity('t2'), kind: 'transaction', kind2: 'income', amountCents: 50000, currency: 'USD', occurredAt: '2026-08-14T09:00' },
        { ...baseEntity('t3'), kind: 'transaction', kind2: 'expense', amountCents: 200, currency: 'USD', occurredAt: '2026-08-12T12:00' }, // same week
        { ...baseEntity('t4'), kind: 'transaction', kind2: 'expense', amountCents: 999, currency: 'USD', occurredAt: '2026-07-20T12:00' }, // last month
        { ...baseEntity('t5'), kind: 'transaction', kind2: 'expense', amountCents: 100, currency: 'USD', occurredAt: '2025-08-14T12:00' }, // last year
      ],
    });
    const s = buildSummaries(data.collections.transactions, data.collections.categories, now);
    expect(s.today.expenseCents).toBe(1234);
    expect(s.today.incomeCents).toBe(50000);
    expect(s.today.netCents).toBe(48766);
    expect(s.today.count).toBe(2);
    expect(s.week.expenseCents).toBe(1434);
    expect(s.month.expenseCents).toBe(1434); // t4 is in July
    expect(s.year.expenseCents).toBe(2433); // t5 is in 2025
    // Category breakdown: Food (1234) + Uncategorized (200 from t3).
    expect(s.month.byCategory).toHaveLength(2);
    expect(s.month.byCategory[0].name).toBe('Food');
    expect(s.month.byCategory[0].pct).toBeCloseTo(1234 / 1434, 5);
    expect(s.month.byCategory[1].name).toBe('Uncategorized');
  });

  it('money formatting avoids float errors', () => {
    expect(formatCents(1234)).toBe('12.34');
    expect(formatCents(5)).toBe('0.05');
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(-50)).toBe('-0.50');
    expect(formatMoney(123456, 'USD')).toBe('$1234.56');
  });
});

describe('CSV export', () => {
  it('escapes commas, quotes and newlines', () => {
    const data = makeData({
      categories: [cat('food', 'Food')],
      transactions: [
        {
          ...baseEntity('t1'),
          kind: 'transaction',
          kind2: 'expense',
          amountCents: 1500,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: '2026-08-14T12:00',
          note: 'Lunch, with "friends"\nand a newline',
        },
      ],
    });
    const csv = transactionsToCSV(data.collections.transactions, data.collections.categories);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,type,amount,currency,category,note,projectId');
    expect(lines[1]).toContain('"Lunch, with ""friends""');
    expect(lines).toHaveLength(3); // note newline split
  });

  it('neutralizes spreadsheet formula injection', () => {
    const data = makeData({
      categories: [cat('food', '=HYPERLINK("http://evil")')],
      transactions: [
        {
          ...baseEntity('t1'),
          kind: 'transaction',
          kind2: 'expense',
          amountCents: 100,
          currency: 'USD',
          categoryId: 'food',
          occurredAt: '2026-08-14T12:00',
          note: '=cmd|/C calc!A0',
        },
        {
          ...baseEntity('t2'),
          kind: 'transaction',
          kind2: 'expense',
          amountCents: -1234, // negative amount must stay numeric
          currency: 'USD',
          occurredAt: '2026-08-14T12:00',
          note: '  @SUM(A1:A9)', // leading whitespace then @
        },
      ],
    });
    const csv = transactionsToCSV(data.collections.transactions, data.collections.categories);
    // Leading = must be neutralized with a quote prefix in the cell
    // (the cell is also quoted because it contains double quotes).
    expect(csv).toContain("'=HYPERLINK(\"\"http://evil\"\")");
    expect(csv).toContain("'=cmd|/C calc!A0");
    expect(csv).not.toContain(',=cmd');
    // Whitespace-before-@ is neutralized too.
    expect(csv).toContain("'  @SUM(A1:A9)");
    // Negative amounts stay numeric (no quote prefix) so sums still work.
    expect(csv).toContain('expense,-12.34,USD');
    expect(csv).not.toContain("'-12.34");
  });
});
