/**
 * JSON exchange: export the whole app to a portable `personal-data.json`,
 * import it on another device, with safe conflict handling.
 *
 * Conflict policy (deterministic, documented):
 *  - Entities are matched by stable `id`.
 *  - Newer `updatedAt` wins; on a tie, higher `rev` wins; on a full tie the
 *    incoming copy wins (import is an explicit user action).
 *  - Tombstones (`deletedAt` set) participate normally: a newer tombstone
 *    deletes, an older tombstone loses to a newer live copy (resurrection is
 *    allowed — it reflects "I edited this again after deleting it elsewhere").
 *  - Duplicate ids inside a single incoming file are collapsed (first wins,
 *    counted in the report).
 */

import {
  AppData,
  CollectionMap,
  EntityKind,
  ENTITY_KINDS,
  DeviceInfo,
  LifeOSDocument,
  SCHEMA_VERSION,
  FORMAT,
  AnyEntity,
} from '../core/types';
import { validateDocument } from './schema';
import { newId, shortId } from '../core/id';

export interface ImportReport {
  added: number;
  updated: number;
  /** Entities where both sides changed and we resolved by timestamp. */
  conflicting: number;
  unchanged: number;
  /** Entities removed locally because the incoming side has a newer tombstone. */
  deleted: number;
  /** Structurally invalid entities dropped from the incoming file. */
  dropped: number;
  /** Duplicate ids collapsed within the incoming file. */
  duplicates: number;
  totalIncoming: number;
}

export function emptyReport(): ImportReport {
  return { added: 0, updated: 0, conflicting: 0, unchanged: 0, deleted: 0, dropped: 0, duplicates: 0, totalIncoming: 0 };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  data: AppData;
  report: ImportReport;
}

export interface ParseOutcome {
  document: LifeOSDocument | null;
  error?: string;
  dropped: number;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function buildDocument(data: AppData, device: DeviceInfo, exportedAt?: string): LifeOSDocument {
  return {
    format: FORMAT,
    version: SCHEMA_VERSION,
    exportedAt: exportedAt || new Date().toISOString(),
    device: { id: device.id || 'unknown', name: device.name || 'Device' },
    data: deepCopyData(data),
  };
}

export function serializeDocument(doc: LifeOSDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function cloneDocument(doc: LifeOSDocument): LifeOSDocument {
  return JSON.parse(JSON.stringify(doc)) as LifeOSDocument;
}

export function deepCopyData(data: AppData): AppData {
  const collections = {} as AppData['collections'];
  for (const kind of ENTITY_KINDS) {
    (collections as Record<string, unknown[]>)[kind] = (data.collections[kind] as AnyEntity[]).map((e) => ({ ...e }));
  }
  return { collections };
}

// ---------------------------------------------------------------------------
// Parse (file -> validated document)
// ---------------------------------------------------------------------------

export function parseDocument(text: string): ParseOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { document: null, error: 'File is not valid JSON.', dropped: 0 };
  }
  const result = validateDocument(raw);
  const dropped = Object.values(result.dropped).reduce((a, b) => a + b, 0);
  if (!result.document) return { document: null, error: result.error, dropped };
  return { document: result.document, dropped };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Newer updatedAt wins; then higher rev; then incoming (explicit import). */
function pickWinner(local: AnyEntity, incoming: AnyEntity): { winner: AnyEntity; conflicting: boolean } {
  const same =
    local.updatedAt === incoming.updatedAt &&
    local.rev === incoming.rev &&
    JSON.stringify(local) === JSON.stringify(incoming);
  if (same) return { winner: local, conflicting: false };
  if (local.updatedAt > incoming.updatedAt) return { winner: local, conflicting: false };
  if (local.updatedAt < incoming.updatedAt) return { winner: incoming, conflicting: false };
  if (local.rev > incoming.rev) return { winner: local, conflicting: false };
  if (local.rev < incoming.rev) return { winner: incoming, conflicting: false };
  return { winner: incoming, conflicting: true };
}

/** Merges `incoming` into `local`, mutating a deep copy of `local`. */
export function mergeData(local: AppData, incoming: AppData): ImportResult {
  const result = deepCopyData(local);
  const report = emptyReport();
  report.dropped = 0;

  for (const kind of ENTITY_KINDS) {
    const localList = result.collections[kind] as AnyEntity[];
    const rawIncoming = incoming.collections[kind] as AnyEntity[];
    // Collapse duplicate ids inside the incoming file (first wins).
    const seen = new Set<string>();
    const incomingList: AnyEntity[] = [];
    for (const e of rawIncoming) {
      if (seen.has(e.id)) {
        report.duplicates++;
        continue;
      }
      seen.add(e.id);
      incomingList.push(e);
    }
    report.totalIncoming += rawIncoming.length;

    const localById = new Map<string, AnyEntity>();
    for (const e of localList) localById.set(e.id, e);

    for (const incomingEntity of incomingList) {
      const existing = localById.get(incomingEntity.id);
      if (!existing) {
        localList.push(incomingEntity);
        localById.set(incomingEntity.id, incomingEntity);
        report.added++;
        continue;
      }
      const { winner, conflicting } = pickWinner(existing, incomingEntity);
      if (conflicting) report.conflicting++;
      if (winner === existing) {
        // Local copy kept: nothing changed locally.
        report.unchanged++;
        continue;
      }
      // incoming wins
      const index = localList.indexOf(existing);
      localList[index] = winner;
      localById.set(winner.id, winner);
      if (winner.deletedAt && !existing.deletedAt) report.deleted++;
      else if (existing.deletedAt && !winner.deletedAt) report.updated++; // resurrection
      else report.updated++;
    }
  }
  return { data: result, report };
}

/** Replaces all local data with the incoming data (fresh start / restore). */
export function replaceData(_local: AppData, incoming: AppData): ImportResult {
  const data = deepCopyData(incoming);
  let totalIncoming = 0;
  for (const kind of ENTITY_KINDS) totalIncoming += data.collections[kind].length;
  const report: ImportReport = { ...emptyReport(), totalIncoming, added: totalIncoming };
  return { data, report };
}

// ---------------------------------------------------------------------------
// Preview (dry run for the import UI)
// ---------------------------------------------------------------------------

export interface ImportPlan {
  mode: ImportMode;
  report: ImportReport;
  /** Per kind -> ids that would change. */
  changes: Partial<Record<EntityKind, { added: string[]; updated: string[]; deleted: string[] }>>;
}

export function planImport(local: AppData, incoming: AppData, mode: ImportMode): ImportPlan {
  if (mode === 'replace') {
    const report = { ...emptyReport() };
    for (const kind of ENTITY_KINDS) report.totalIncoming += incoming.collections[kind].length;
    report.added = report.totalIncoming;
    return { mode, report, changes: {} };
  }
  // Derive the plan from an actual dry merge so the preview can never
  // disagree with what applying the import would do.
  const { data, report } = mergeData(local, incoming);
  const changes: ImportPlan['changes'] = {};
  for (const kind of ENTITY_KINDS) {
    const localById = new Map(local.collections[kind].map((e) => [e.id, e]));
    const merged = data.collections[kind];
    const added: string[] = [];
    const updated: string[] = [];
    const deleted: string[] = [];
    for (const e of merged) {
      const prev = localById.get(e.id);
      if (!prev) {
        added.push(e.id);
        continue;
      }
      if (JSON.stringify(prev) === JSON.stringify(e)) continue;
      if (e.deletedAt && !prev.deletedAt) deleted.push(e.id);
      else updated.push(e.id);
    }
    if (added.length || updated.length || deleted.length) {
      changes[kind] = { added, updated, deleted };
    }
  }
  return { mode, report, changes };
}

/** Fresh device metadata for a new install. */
export function newDeviceInfo(): DeviceInfo {
  return { id: shortId(), name: 'My Device' };
}
