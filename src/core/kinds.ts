/**
 * Kind name mapping helpers (pure).
 *
 * The store indexes collections by plural keys ("tasks", "transactions", …)
 * while UI forms often use singular labels ("task") or transaction kinds
 * ("expense"/"income"). This module bridges the two.
 */

import { EntityKind, ENTITY_KIND_NAMES, ENTITY_KINDS } from './types';

/** Singular entity discriminant -> plural collection key. */
export const SINGULAR_TO_KIND: Record<string, EntityKind> = Object.fromEntries(
  ENTITY_KINDS.map((kind) => [ENTITY_KIND_NAMES[kind], kind])
) as Record<string, EntityKind>;

/** Quick Add labels -> collection keys ("expense"/"income" are transaction kinds). */
export const QUICK_ADD_KIND: Record<string, EntityKind> = {
  ...SINGULAR_TO_KIND,
  task: 'tasks',
  expense: 'transactions',
  income: 'transactions',
};

/** True when the value is a valid plural collection key. */
export function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as string[]).includes(value);
}
