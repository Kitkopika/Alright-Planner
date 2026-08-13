import { useLifeOS } from '../src/data/store';

jest.mock('../src/data/persistence', () => ({
  getDocumentStore: () => ({
    read: async () => null,
    write: async () => {},
    readBackup: async () => null,
    remove: async () => {},
  }),
}));

describe('store CRUD safety', () => {
  it('creates a transaction through the plural collection key', () => {
    const created = useLifeOS.getState().create('transactions', {
      kind2: 'expense',
      amountCents: 1234,
      currency: 'USD',
      occurredAt: '2026-08-14T12:00',
    });
    expect(created.id).toBeTruthy();
    expect(useLifeOS.getState().data.collections.transactions).toHaveLength(1);
  });

  it('fails loudly on an unknown/singular collection key instead of spreading undefined', () => {
    const store = useLifeOS.getState();
    // 'expense' is a Quick Add label, not a collection key — this used to
    // crash with "Spread syntax requires ...iterable not be null or undefined".
    expect(() => store.create('expense' as never, {} as never)).toThrow(/unknown collection/i);
  });
});
