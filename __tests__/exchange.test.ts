import {
  buildDocument,
  mergeData,
  parseDocument,
  planImport,
  replaceData,
  serializeDocument,
} from '../src/data/exchange';
import { validateDocument } from '../src/data/schema';
import { AppData, LifeOSDocument } from '../src/core/types';
import { baseEntity, makeData } from './testUtils';

const device = { id: 'device-a', name: 'Device A' };

describe('export / parse round trip', () => {
  it('serializes and parses back to the same data', () => {
    const data = makeData({
      tasks: [
        {
          ...baseEntity('task-1', '2026-01-01T08:00'),
          kind: 'task',
          title: 'Ship Life OS',
          status: 'todo',
          priority: 'high',
          dueAt: '2026-08-14T18:00',
          projectId: 'proj-1',
        },
      ],
      projects: [{ ...baseEntity('proj-1'), kind: 'project', name: 'Life OS', status: 'active', goalId: 'goal-1' }],
      goals: [{ ...baseEntity('goal-1'), kind: 'goal', title: 'Build a life OS', status: 'active' }],
    });
    const doc = buildDocument(data, device);
    const text = serializeDocument(doc);
    const parsed = parseDocument(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.document?.data.collections.tasks).toHaveLength(1);
    expect(parsed.document?.data.collections.tasks[0]).toMatchObject({
      id: 'task-1',
      title: 'Ship Life OS',
      projectId: 'proj-1',
      priority: 'high',
    });
    // IDs and relationships survive the round trip.
    expect(parsed.document?.data.collections.projects[0].goalId).toBe('goal-1');
    // Rejects malformed JSON.
    expect(parseDocument('{not json').error).toMatch(/not valid JSON/i);
  });

  it('rejects non-life-os documents', () => {
    expect(parseDocument('{"format":"other","version":1}').error).toMatch(/not a life os file/i);
  });

  it('rejects unsupported future versions', () => {
    const raw = { format: 'life-os', version: 999, data: {} };
    const result = validateDocument(raw);
    expect(result.document).toBeNull();
    expect(result.error).toMatch(/unsupported/i);
  });
});

describe('import safety (normalization)', () => {
  it('drops unknown fields and wrong-typed values', () => {
    const raw = {
      format: 'life-os',
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      device: { id: 'a', name: 'A' },
      data: {
        collections: {
          tasks: [
            {
              id: 't1',
              createdAt: '2026-01-01T00:00',
              updatedAt: '2026-01-02T00:00',
              deletedAt: null,
              rev: 1,
              title: 'ok',
              status: 'todo',
              priority: 'urgent',
              dueAt: '2026-08-14',
              evil: '<script>alert(1)</script>',
              estimatedMinutes: 'not-a-number',
            },
          ],
        },
      },
    };
    const result = validateDocument(raw);
    expect(result.document).not.toBeNull();
    const task = result.document!.data.collections.tasks[0] as unknown as Record<string, unknown>;
    expect(task.title).toBe('ok');
    expect(task.evil).toBeUndefined(); // unknown field dropped
    expect(task.estimatedMinutes).toBeUndefined(); // wrong type dropped
    expect(task.kind).toBe('task');
  });

  it('rejects structurally invalid entities and counts them', () => {
    const raw = {
      format: 'life-os',
      version: 1,
      data: {
        collections: {
          tasks: [
            null,
            { id: 'ok', createdAt: '2026-01-01T00:00', updatedAt: '2026-01-01T08:00', deletedAt: null, rev: 1, title: 'x', status: 'todo', priority: 'low' },
            { id: 42 }, // bad id type
            { id: '', createdAt: '2026-01-01T00:00', updatedAt: '2026-01-01T08:00', deletedAt: null, rev: 1 }, // empty id
          ],
        },
      },
    };
    const result = validateDocument(raw);
    expect(result.dropped.tasks).toBe(3);
    expect(result.document!.data.collections.tasks).toHaveLength(1);
  });

  it('rejects gigantic ids and bad enums', () => {
    const raw = {
      format: 'life-os',
      version: 1,
      data: {
        collections: {
          tasks: [{ id: 'a'.repeat(200), createdAt: 'c', updatedAt: 'u', deletedAt: null, rev: 1 }],
          habits: [{ id: 'h1', createdAt: 'c', updatedAt: 'u', deletedAt: null, rev: 1, name: 'x', frequency: { type: 'yearly' } }],
        },
      },
    };
    const result = validateDocument(raw);
    expect(result.dropped.tasks).toBe(1);
    expect(result.dropped.habits).toBe(1);
  });

  it('rejects entities with non-date timestamps so merge timestamps cannot be gamed', () => {
    const raw = {
      format: 'life-os',
      version: 1,
      data: {
        collections: {
          // "9999-99-99" is not a valid date -> rejected.
          tasks: [
            {
              id: 't1',
              createdAt: '2026-01-01T00:00',
              updatedAt: '9999-99-99',
              deletedAt: null,
              rev: 1,
              title: 'x',
              status: 'todo',
              priority: 'low',
            },
          ],
        },
      },
    };
    const result = validateDocument(raw);
    expect(result.dropped.tasks).toBe(1);
    expect(result.document!.data.collections.tasks).toHaveLength(0);
  });

  it('rejects out-of-range years (future-dated entities cannot win merges)', () => {
    const raw = {
      format: 'life-os',
      version: 1,
      data: {
        collections: {
          // Year 9999 is a *parseable* date but outside the allowed range.
          tasks: [
            {
              id: 't1',
              createdAt: '2026-01-01T00:00',
              updatedAt: '9999-12-31T23:59',
              deletedAt: null,
              rev: 1,
              title: 'x',
              status: 'todo',
              priority: 'low',
            },
          ],
        },
      },
    };
    const result = validateDocument(raw);
    expect(result.dropped.tasks).toBe(1);
  });
});

describe('merge conflict handling', () => {
  const localData = (): AppData =>
    makeData({
      tasks: [
        {
          ...baseEntity('t1', '2026-01-01T08:00', 1),
          kind: 'task',
          title: 'local title',
          status: 'todo',
          priority: 'medium',
        },
      ],
    });

  it('adds entities that do not exist locally', () => {
    const incoming = makeData({
      tasks: [{ ...baseEntity('t2', '2026-01-02T08:00', 1), kind: 'task', title: 'new', status: 'todo', priority: 'low' }],
    });
    const { data, report } = mergeData(localData(), incoming);
    expect(data.collections.tasks).toHaveLength(2);
    expect(report.added).toBe(1);
    expect(report.updated).toBe(0);
  });

  it('newer updatedAt wins', () => {
    const incoming = makeData({
      tasks: [{ ...baseEntity('t1', '2026-01-03T08:00', 1), kind: 'task', title: 'incoming newer', status: 'done', priority: 'high' }],
    });
    const { data, report } = mergeData(localData(), incoming);
    expect(data.collections.tasks[0].title).toBe('incoming newer');
    expect(report.updated).toBe(1);
    expect(report.conflicting).toBe(0);
  });

  it('older updatedAt loses and counts as unchanged', () => {
    const incoming = makeData({
      tasks: [{ ...baseEntity('t1', '2025-01-01T08:00', 1), kind: 'task', title: 'old', status: 'todo', priority: 'low' }],
    });
    const { data, report } = mergeData(localData(), incoming);
    expect(data.collections.tasks[0].title).toBe('local title');
    expect(report.unchanged).toBe(1);
  });

  it('equal timestamps but different content counts as a conflict resolved by rev/incoming', () => {
    const incoming = makeData({
      tasks: [{ ...baseEntity('t1', '2026-01-01T08:00', 1), kind: 'task', title: 'different', status: 'doing', priority: 'high' }],
    });
    const { data, report } = mergeData(localData(), incoming);
    expect(report.conflicting).toBe(1);
    expect(data.collections.tasks[0].title).toBe('different'); // incoming wins on full tie
  });

  it('a newer tombstone deletes locally; an older one does not', () => {
    const incomingDeleted = makeData({
      tasks: [{ ...baseEntity('t1', '2026-01-05T08:00', 2), deletedAt: '2026-01-05T08:00' } as never],
    });
    const { data, report } = mergeData(localData(), incomingDeleted);
    expect(data.collections.tasks[0].deletedAt).not.toBeNull();
    expect(report.deleted).toBe(1);

    const incomingOldTombstone = makeData({
      tasks: [{ ...baseEntity('t1', '2020-01-01T08:00', 2), deletedAt: '2020-01-01T08:00' } as never],
    });
    const resurrected = mergeData(localData(), incomingOldTombstone);
    expect(resurrected.data.collections.tasks[0].deletedAt).toBeNull();
    expect(resurrected.data.collections.tasks[0].title).toBe('local title');
  });

  it('collapses duplicate ids within one incoming file (first wins)', () => {
    const incoming = makeData({
      tasks: [
        { ...baseEntity('dup', '2026-01-02T08:00', 1), kind: 'task', title: 'first', status: 'todo', priority: 'low' },
        { ...baseEntity('dup', '2026-01-03T08:00', 1), kind: 'task', title: 'second', status: 'todo', priority: 'low' },
      ],
    });
    const { data, report } = mergeData(makeData(), incoming);
    expect(data.collections.tasks).toHaveLength(1);
    expect(report.duplicates).toBe(1);
    expect(data.collections.tasks[0].title).toBe('first');
  });

  it('planImport previews without mutating local data and matches the applied merge', () => {
    const incoming = makeData({
      tasks: [
        { ...baseEntity('t-new', '2026-01-02T08:00', 1), kind: 'task', title: 'n', status: 'todo', priority: 'low' },
        { ...baseEntity('t1', '2026-01-03T08:00', 1), kind: 'task', title: 'updated title', status: 'doing', priority: 'high' },
      ],
    });
    const local = localData();
    const plan = planImport(local, incoming, 'merge');
    expect(plan.report.added).toBe(1);
    expect(plan.report.updated).toBe(1);
    expect(local.collections.tasks).toHaveLength(1); // untouched
    // The plan's per-kind changes must equal what applying the merge produces.
    const { data: applied } = mergeData(local, incoming);
    const planIds = new Set([
      ...(plan.changes.tasks?.added || []),
      ...(plan.changes.tasks?.updated || []),
      ...(plan.changes.tasks?.deleted || []),
    ]);
    const appliedIds = new Set(applied.collections.tasks.filter((t) => JSON.stringify(t) !== JSON.stringify(local.collections.tasks.find((l) => l.id === t.id))).map((t) => t.id));
    expect(planIds).toEqual(appliedIds);
  });

  it('replace wipes local data', () => {
    const incoming = makeData({
      tasks: [{ ...baseEntity('only', '2026-01-02T08:00', 1), kind: 'task', title: 'only', status: 'todo', priority: 'low' }],
    });
    const { data, report } = replaceData(localData(), incoming);
    expect(data.collections.tasks).toHaveLength(1);
    expect(data.collections.tasks[0].id).toBe('only');
    expect(report.added).toBe(1);
  });
});

describe('document shape', () => {
  it('buildDocument carries format, version and device', () => {
    const doc: LifeOSDocument = buildDocument(makeData(), device);
    expect(doc.format).toBe('life-os');
    expect(doc.version).toBe(1);
    expect(doc.device).toEqual(device);
    expect(doc.data.collections.tasks).toEqual([]);
  });
});
