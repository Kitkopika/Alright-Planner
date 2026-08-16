import { useLifeOS } from '../src/data/store';

jest.mock('../src/data/persistence', () => ({
  getDocumentStore: () => ({
    read: async () => null,
    write: async () => {},
    readBackup: async () => null,
    remove: async () => {},
  }),
}));

describe('reminder sync (remind-before offsets → reminders)', () => {
  it('creates one reminder per offset at start minus offset', () => {
    const ev = useLifeOS.getState().create('events', {
      title: 'Meeting',
      startAt: '2026-08-20T10:00',
      reminders: [{ id: 'o1', offsetMin: 60 }],
    });
    const linked = useLifeOS.getState().data.collections.reminders.filter((r) => r.eventId === ev.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({ title: 'Meeting', remindAt: '2026-08-20T09:00', status: 'pending', eventId: ev.id, taskId: null });
  });

  it('re-syncs on update: old reminders replaced, new offsets materialized', () => {
    const ev = useLifeOS.getState().create('events', {
      title: 'Meeting',
      startAt: '2026-08-20T10:00',
      reminders: [{ id: 'o1', offsetMin: 60 }],
    });
    useLifeOS.getState().update('events', ev.id, {
      reminders: [
        { id: 'o1', offsetMin: 1440 },
        { id: 'o2', offsetMin: 120 },
      ],
    });
    const linked = useLifeOS.getState().data.collections.reminders.filter((r) => r.eventId === ev.id);
    expect(linked).toHaveLength(2);
    expect(linked.map((r) => r.remindAt).sort()).toEqual(['2026-08-19T10:00', '2026-08-20T08:00']);
  });

  it('creates task reminders from dueAt and drops them on remove', () => {
    const task = useLifeOS.getState().create('tasks', {
      title: 'Submit',
      priority: 'high',
      status: 'todo',
      dueAt: '2026-08-20T18:00',
      reminders: [{ id: 'o1', offsetMin: 30 }],
    });
    let linked = useLifeOS.getState().data.collections.reminders.filter((r) => r.taskId === task.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].remindAt).toBe('2026-08-20T17:30');
    useLifeOS.getState().remove('tasks', task.id);
    linked = useLifeOS.getState().data.collections.reminders.filter((r) => r.taskId === task.id);
    expect(linked).toHaveLength(0);
  });

  it('creates no reminders when there are no offsets', () => {
    const ev = useLifeOS.getState().create('events', { title: 'Plain', startAt: '2026-08-20T10:00' });
    expect(useLifeOS.getState().data.collections.reminders.some((r) => r.eventId === ev.id)).toBe(false);
  });
});
