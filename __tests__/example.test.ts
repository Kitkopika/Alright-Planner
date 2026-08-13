import * as fs from 'fs';
import * as path from 'path';
import { parseDocument } from '../src/data/exchange';

describe('docs/personal-data.example.json', () => {
  it('is a valid, importable Life OS document', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'docs', 'personal-data.example.json'), 'utf8');
    const parsed = parseDocument(text);
    expect(parsed.error).toBeUndefined();
    const doc = parsed.document!;
    expect(doc.format).toBe('life-os');
    // All collections round-trip with relationships intact.
    expect(doc.data.collections.tasks[0].projectId).toBe('proj-1');
    expect(doc.data.collections.projects[0].goalId).toBe('goal-1');
    expect(doc.data.collections.routineCompletions[0].routineId).toBe('routine-1');
    expect(doc.data.collections.transactions[0].categoryId).toBe('cat-food');
    expect(doc.data.collections.notes[0].projectId).toBe('proj-1');
    // Deleted entity count must be zero — the file is clean.
    const kinds = Object.keys(doc.data.collections) as (keyof typeof doc.data.collections)[];
    const all = kinds.flatMap((k) => doc.data.collections[k]);
    expect(all.every((e) => e.deletedAt === null)).toBe(true);
    // Every entity has a unique id.
    const ids = all.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
