/**
 * CSV export for transactions (finance module).
 * Pure string building with proper RFC-4180 escaping.
 */

import { Transaction, Category } from '../core/types';
import { categoryById } from '../features/finance';

function escapeCell(value: string): string {
  // Spreadsheet formula injection (OWASP): a leading = + - @ (or tab/CR)
  // makes Excel/Sheets evaluate the cell as a formula. Leading whitespace is
  // stripped first because some importers trim before evaluating.
  // Numeric cells (e.g. the amount column, including negatives) are exempt —
  // a "-12.34" amount must stay numeric so spreadsheet sums still work.
  const trimmed = value.trimStart();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed) && /^[=+\-@\t\r]/.test(trimmed)) {
    value = `'${value}`;
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionsToCSV(transactions: Transaction[], categories: Category[]): string {
  const header = ['date', 'type', 'amount', 'currency', 'category', 'note', 'projectId'];
  const rows = transactions.map((t) => {
    const cat = categoryById(categories, t.categoryId);
    const amount = (t.amountCents / 100).toFixed(2);
    return [
      t.occurredAt,
      t.kind2,
      amount,
      t.currency,
      cat.name,
      t.note || '',
      t.projectId || '',
    ]
      .map(escapeCell)
      .join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

export function transactionsToJSON(transactions: Transaction[]): string {
  return JSON.stringify(transactions, null, 2);
}
