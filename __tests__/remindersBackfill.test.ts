import { useLifeOS } from '../src/data/store';
import { buildDocument, serializeDocument } from '../src/data/exchange';
import { makeData, baseEntity } from './testUtils';

// An event and a task that carry remind-before offsets but NO Reminder
// entities (as if saved before the reminder-sync feature existed).
const data = makeData({
  events: [{ ...baseEntity('ev1'), kind: 'event', title: 'Old meeting', startAt: '2026-08-20T10:00', reminders: [{ id: 'o1', offsetMin: 60 }] }],
  tasks: [
    {
      ...baseEntity('tk1'),
      kind: 'task',
      title: 'Old task',
      priority: 'medium',
      status: 'todo',
      dueAt: '2026-08-21T18:00',
      reminders: [{ id: 'o2', offsetMin: 120 }],
    },
  ],
});

const mockSerializedDoc = serializeDocument(buildDocument(data, { id: 'dev1', name: 'Test' }));

jest.mock('../src/data/persistence', () => ({
  getDocumentStore: () => ({
    read: async () => mockSerializedDoc,
    write: async () => {},
    readBackup: async () => null,
    remove: async () => {},
  }),
}));

describe('reminder backfill on hydrate', () => {
  it('materializes reminders for pre-existing events/tasks with offsets', async () => {
    await useLifeOS.getState().hydrate();
    const reminders = useLifeOS.getState().data.collections.reminders;
    expect(reminders).toHaveLength(2);
    expect(reminders.find((r) => r.eventId === 'ev1')).toMatchObject({ title: 'Old meeting', remindAt: '2026-08-20T09:00', status: 'pending' });
    expect(reminders.find((r) => r.taskId === 'tk1')).toMatchObject({ title: 'Old task', remindAt: '2026-08-21T16:00', status: 'pending' });
  });
});
