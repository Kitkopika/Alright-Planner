/** Shared helpers for building test fixtures. */

import { AppData, emptyData, EntityKind } from '../src/core/types';

export function makeData(overrides?: Partial<AppData['collections']>): AppData {
  const data = emptyData();
  if (overrides) {
    for (const key of Object.keys(overrides) as EntityKind[]) {
      (data.collections[key] as unknown[]) = overrides[key] as unknown[];
    }
  }
  return data;
}

export function baseEntity(id: string, updatedAt = '2026-01-01T08:00', rev = 1) {
  return { id, createdAt: '2026-01-01T00:00', updatedAt, deletedAt: null, rev };
}
