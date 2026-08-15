/**
 * Central application store (zustand). Holds the whole `AppData` document in
 * memory, exposes typed generic CRUD, soft-deletes (tombstones), debounced
 * persistence to the JSON file, and JSON export/import entry points.
 */

import { create } from 'zustand';
import {
  AnyEntity,
  AppData,
  CollectionMap,
  DeviceInfo,
  emptyData,
  ENTITY_KIND_NAMES,
  EntityKind,
  LifeOSDocument,
} from '../core/types';
import { newId } from '../core/id';
import { nowIso } from '../core/time';
import { getDocumentStore } from './persistence';
import { refreshWidgets } from '../widgets';
import {
  ImportMode,
  ImportPlan,
  ImportReport,
  buildDocument,
  mergeData,
  newDeviceInfo,
  parseDocument,
  planImport,
  replaceData,
  serializeDocument,
} from './exchange';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export interface LifeOSState {
  data: AppData;
  device: DeviceInfo;
  hydrated: boolean;
  lastSavedAt: string | null;
  saveError: string | null;

  // --- lifecycle ---------------------------------------------------------
  hydrate: () => Promise<void>;
  saveNow: () => Promise<void>;
  resetAll: () => Promise<void>;

  // --- generic CRUD ------------------------------------------------------
  create: <K extends EntityKind>(kind: K, partial: Partial<CollectionMap[K]>) => CollectionMap[K];
  update: <K extends EntityKind>(kind: K, id: string, patch: Partial<CollectionMap[K]>) => void;
  /** Soft delete (tombstone) — sync-safe. */
  remove: (kind: EntityKind, id: string) => void;
  /** Undo a soft delete. */
  restore: (kind: EntityKind, id: string) => void;
  /** Replace all data at once (import). */
  bulkSet: (data: AppData) => void;

  // --- exchange ----------------------------------------------------------
  exportJSON: () => string;
  exportDocument: () => LifeOSDocument;
  importJSON: (text: string, mode: ImportMode) => Promise<ImportResult2>;
  previewImport: (text: string, mode: ImportMode) => ImportPlan | null;
}

export interface ImportResult2 {
  report: ImportReport;
  data: AppData;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function baseEntity(partial: Partial<AnyEntity>): Pick<AnyEntity, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'rev'> {
  const now = nowIso();
  return {
    id: partial.id || newId(),
    createdAt: partial.createdAt || now,
    updatedAt: now,
    deletedAt: partial.deletedAt ?? null,
    rev: typeof partial.rev === 'number' ? partial.rev + 1 : 1,
  };
}

/** Reads a collection as an AnyEntity[] (internal CRUD uses the union type). */
function asList(data: AppData, kind: EntityKind): AnyEntity[] {
  const list = data.collections[kind];
  if (!Array.isArray(list)) {
    throw new Error(`LifeOS: unknown collection "${String(kind)}".`);
  }
  return list as AnyEntity[];
}

/** Returns a shallow copy of data with one collection replaced. */
function withCollection(data: AppData, kind: EntityKind, list: AnyEntity[]): AppData {
  return {
    ...data,
    collections: { ...data.collections, [kind]: list } as AppData['collections'],
  };
}

export const useLifeOS = create<LifeOSState>((set, get) => {
  const persist = async () => {
    const { data, device } = get();
    const doc = buildDocument(data, device);
    const text = serializeDocument(doc);
    try {
      await getDocumentStore().write(text);
      set({ lastSavedAt: nowIso(), saveError: null });
      refreshWidgets();
    } catch (e) {
      set({ saveError: e instanceof Error ? e.message : String(e) });
    }
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void persist();
    }, 400);
  };

  return {
    data: emptyData(),
    device: newDeviceInfo(),
    hydrated: false,
    lastSavedAt: null,
    saveError: null,

    hydrate: async () => {
      try {
        const store = getDocumentStore();
        let text = await store.read();
        if (text == null) text = await store.readBackup();
        if (text != null) {
          const parsed = parseDocument(text);
          if (parsed.document) {
            set({
              data: parsed.document.data,
              device: { id: get().device.id, name: parsed.document.device.name },
              hydrated: true,
            });
            return;
          }
          // Invalid main file: fall back to backup if the main file differed.
          const backup = await store.readBackup();
          if (backup && backup !== text) {
            const parsedBackup = parseDocument(backup);
            if (parsedBackup.document) {
              set({
                data: parsedBackup.document.data,
                device: { id: get().device.id, name: parsedBackup.document.device.name },
                hydrated: true,
              });
              return;
            }
          }
        }
        set({ hydrated: true });
      } catch (e) {
        console.warn('LifeOS: hydrate failed', e);
        set({ hydrated: true });
      }
    },

    saveNow: persist,

    resetAll: async () => {
      // Clear in-memory data, then hard-delete both the main file and its
      // rotating backup, then write a fresh empty document.
      set({ data: emptyData() });
      try {
        await getDocumentStore().remove();
      } catch (e) {
        console.warn('LifeOS: reset remove failed', e);
      }
      await persist();
    },

    create: (kind, partial) => {
      const now = nowIso();
      const entity = {
        ...(partial as Record<string, unknown>),
        ...baseEntity(partial as unknown as Partial<AnyEntity>),
        kind: ENTITY_KIND_NAMES[kind],
        updatedAt: now,
      } as unknown as AnyEntity;
      const data = get().data;
      const list = [...asList(data, kind), entity];
      set({ data: withCollection(data, kind, list) });
      scheduleSave();
      return entity as unknown as CollectionMap[typeof kind];
    },

    update: (kind, id, patch) => {
      const data = get().data;
      const list = asList(data, kind);
      const index = list.findIndex((e) => e.id === id);
      if (index === -1) return;
      const current = list[index];
      const next = {
        ...current,
        ...(patch as Record<string, unknown>),
        id: current.id,
        kind: current.kind,
        createdAt: current.createdAt,
        updatedAt: nowIso(),
        rev: current.rev + 1,
      } as AnyEntity;
      const copy = [...list];
      copy[index] = next;
      set({ data: withCollection(data, kind, copy) });
      scheduleSave();
    },

    remove: (kind, id) => {
      const data = get().data;
      const list = asList(data, kind);
      const index = list.findIndex((e) => e.id === id);
      if (index === -1) return;
      const current = list[index];
      const next = {
        ...current,
        deletedAt: nowIso(),
        updatedAt: nowIso(),
        rev: current.rev + 1,
      } as AnyEntity;
      const copy = [...list];
      copy[index] = next;
      set({ data: withCollection(data, kind, copy) });
      scheduleSave();
    },

    restore: (kind, id) => {
      const data = get().data;
      const list = asList(data, kind);
      const index = list.findIndex((e) => e.id === id);
      if (index === -1) return;
      const current = list[index];
      const next = {
        ...current,
        deletedAt: null,
        updatedAt: nowIso(),
        rev: current.rev + 1,
      } as AnyEntity;
      const copy = [...list];
      copy[index] = next;
      set({ data: withCollection(data, kind, copy) });
      scheduleSave();
    },

    bulkSet: (data) => {
      set({ data: clone(data) });
      scheduleSave();
    },

    exportDocument: () => buildDocument(get().data, get().device),
    exportJSON: () => serializeDocument(buildDocument(get().data, get().device)),

    importJSON: async (text, mode) => {
      const parsed = parseDocument(text);
      if (!parsed.document) {
        throw new Error(parsed.error || 'Could not parse file.');
      }
      const incoming = parsed.document.data;
      const local = get().data;
      const { data, report } = mode === 'replace' ? replaceData(local, incoming) : mergeData(local, incoming);
      set({ data });
      await persist();
      return { report, data };
    },

    previewImport: (text, mode) => {
      const parsed = parseDocument(text);
      if (!parsed.document) return null;
      return planImport(get().data, parsed.document.data, mode);
    },
  };
});

/** Convenience: returns an entity by kind+id from the given data. */
export function getEntity<K extends EntityKind>(data: AppData, kind: K, id: string): CollectionMap[K] | undefined {
  return (data.collections[kind] as CollectionMap[K][]).find((e) => e.id === id && !e.deletedAt);
}
