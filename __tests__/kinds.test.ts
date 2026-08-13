import { QUICK_ADD_KIND, SINGULAR_TO_KIND, isEntityKind } from '../src/core/kinds';

describe('quick-add kind mapping (regression: singular-key spread crash)', () => {
  it('maps every quick-add label to a valid plural collection key', () => {
    const labels = ['task', 'reminder', 'event', 'expense', 'income', 'note', 'habit', 'goal'];
    for (const label of labels) {
      expect(isEntityKind(QUICK_ADD_KIND[label])).toBe(true);
    }
    expect(QUICK_ADD_KIND.task).toBe('tasks');
    expect(QUICK_ADD_KIND.reminder).toBe('reminders');
    expect(QUICK_ADD_KIND.event).toBe('events');
    expect(QUICK_ADD_KIND.note).toBe('notes');
    expect(QUICK_ADD_KIND.habit).toBe('habits');
    expect(QUICK_ADD_KIND.goal).toBe('goals');
    // expense/income are transaction kinds, both stored in 'transactions'.
    expect(QUICK_ADD_KIND.expense).toBe('transactions');
    expect(QUICK_ADD_KIND.income).toBe('transactions');
  });

  it('derives singular -> plural for every entity kind', () => {
    expect(SINGULAR_TO_KIND.task).toBe('tasks');
    expect(SINGULAR_TO_KIND.transaction).toBe('transactions');
    expect(SINGULAR_TO_KIND.focusSession).toBe('focusSessions');
    expect(SINGULAR_TO_KIND.routineCompletion).toBe('routineCompletions');
  });
});
