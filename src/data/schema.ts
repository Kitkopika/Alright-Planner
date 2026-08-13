/**
 * Validation + normalization of the portable JSON document on import.
 *
 * The import path is the security-sensitive surface of a local-first app:
 * we never trust the file. Each entity is normalized against a strict field
 * whitelist — unknown fields are dropped, wrong-typed fields are dropped,
 * and structurally invalid entities are rejected with a count.
 */

import {
  AnyEntity,
  CollectionMap,
  ENTITY_KIND_NAMES,
  ENTITY_KINDS,
  EntityKind,
  FORMAT,
  LifeOSDocument,
  SCHEMA_VERSION,
} from '../core/types';
import { tryParseISO } from '../core/time';

type Validator = (v: unknown) => boolean;

const isStr: Validator = (v) => typeof v === 'string';
const isStrOrNull: Validator = (v) => v === null || typeof v === 'string';
const isNum: Validator = (v) => typeof v === 'number' && Number.isFinite(v);
const isBool: Validator = (v) => typeof v === 'boolean';
const isObj: Validator = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStrArr: Validator = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumArr: Validator = (v) => Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x));

/** Validate a recurrence object. */
function isRecurrence(v: unknown): boolean {
  if (!isObj(v)) return false;
  const o = v as Record<string, unknown>;
  if (o.freq !== 'daily' && o.freq !== 'weekly' && o.freq !== 'monthly' && o.freq !== 'yearly') return false;
  if (!isNum(o.interval) || (o.interval as number) < 1) return false;
  if (o.byWeekdays !== undefined && !isNumArr(o.byWeekdays)) return false;
  if (o.until !== undefined && o.until !== null && !isStr(o.until)) return false;
  if (o.count !== undefined && o.count !== null && !isNum(o.count)) return false;
  return true;
}

function isRoutineStep(v: unknown): boolean {
  if (!isObj(v)) return false;
  const o = v as Record<string, unknown>;
  return isStr(o.id) && isStr(o.label);
}

function isAttachment(v: unknown): boolean {
  if (!isObj(v)) return false;
  const o = v as Record<string, unknown>;
  return isStr(o.name) && (o.uri === undefined || o.uri === null || isStr(o.uri));
}

/** Per-kind whitelist: field name -> validator. Base fields are implicit. */
const SHAPES: Record<EntityKind, Record<string, Validator>> = {
  tasks: {
    title: isStr,
    notes: isStr,
    status: (v) => v === 'todo' || v === 'doing' || v === 'done' || v === 'cancelled',
    priority: (v) => v === 'low' || v === 'medium' || v === 'high' || v === 'urgent',
    dueAt: isStrOrNull,
    startAt: isStrOrNull,
    recurrence: (v) => v === null || v === undefined || isRecurrence(v),
    parentTaskId: isStrOrNull,
    projectId: isStrOrNull,
    goalId: isStrOrNull,
    eventId: isStrOrNull,
    completedDates: isStrArr,
    completedAt: isStrOrNull,
    estimatedMinutes: isNum,
    tags: isStrArr,
    sortOrder: isNum,
  },
  events: {
    title: isStr,
    startAt: isStr,
    endAt: isStrOrNull,
    allDay: isBool,
    recurrence: (v) => v === null || v === undefined || isRecurrence(v),
    reminderOffsetMin: (v) => v === null || v === undefined || isNum(v),
    location: isStr,
    notes: isStr,
    color: isStr,
    taskId: isStrOrNull,
    projectId: isStrOrNull,
  },
  reminders: {
    title: isStr,
    remindAt: isStr,
    recurrence: (v) => v === null || v === undefined || isRecurrence(v),
    eventId: isStrOrNull,
    taskId: isStrOrNull,
    status: (v) => v === 'pending' || v === 'triggered' || v === 'dismissed' || v === 'snoozed',
    snoozedUntil: isStrOrNull,
    triggeredDates: isStrArr,
  },
  routines: {
    name: isStr,
    weekdays: isNumArr,
    timeOfDay: isStrOrNull,
    steps: (v) => Array.isArray(v) && v.every(isRoutineStep),
    color: isStr,
    icon: isStr,
  },
  routineCompletions: {
    routineId: isStr,
    date: isStr,
    doneStepIds: isStrArr,
  },
  habits: {
    name: isStr,
    frequency: (v) =>
      isObj(v) &&
      ((v as Record<string, unknown>).type === 'daily' ||
        (v as Record<string, unknown>).type === 'weekly' ||
        (v as Record<string, unknown>).type === 'custom') &&
      ((v as Record<string, unknown>).weekdays === undefined || isNumArr((v as Record<string, unknown>).weekdays)) &&
      ((v as Record<string, unknown>).timesPerWeek === undefined || isNum((v as Record<string, unknown>).timesPerWeek)),
    goalId: isStrOrNull,
    color: isStr,
    icon: isStr,
    archived: isBool,
    completions: isStrArr,
  },
  notes: {
    title: isStr,
    body: isStr,
    kind2: (v) => v === 'note' || v === 'journal' || v === 'project',
    tags: isStrArr,
    attachments: (v) => Array.isArray(v) && v.every(isAttachment),
    links: isStrArr,
    taskId: isStrOrNull,
    projectId: isStrOrNull,
    goalId: isStrOrNull,
    eventId: isStrOrNull,
    journalDate: isStrOrNull,
  },
  transactions: {
    kind2: (v) => v === 'income' || v === 'expense',
    amountCents: (v) => isNum(v) && Number.isInteger(v),
    currency: isStr,
    categoryId: isStrOrNull,
    projectId: isStrOrNull,
    occurredAt: isStr,
    note: isStr,
  },
  categories: {
    name: isStr,
    kind2: (v) => v === 'income' || v === 'expense',
    color: isStr,
    icon: isStr,
    monthlyBudgetCents: (v) => v === null || v === undefined || (isNum(v) && Number.isInteger(v)),
  },
  goals: {
    title: isStr,
    description: isStr,
    deadline: isStrOrNull,
    status: (v) => v === 'active' || v === 'done' || v === 'archived',
    color: isStr,
    sortOrder: isNum,
  },
  projects: {
    name: isStr,
    description: isStr,
    goalId: isStrOrNull,
    status: (v) => v === 'active' || v === 'done' || v === 'archived',
    deadline: isStrOrNull,
    color: isStr,
    sortOrder: isNum,
  },
  focusSessions: {
    startedAt: isStr,
    endedAt: isStrOrNull,
    durationMin: isNum,
    type: (v) => v === 'pomodoro' || v === 'custom',
    taskId: isStrOrNull,
    projectId: isStrOrNull,
    subject: isStrOrNull,
  },
};

export interface NormalizeResult {
  entity: AnyEntity | null;
}

/** Fields without which an entity of a kind is considered invalid. */
const REQUIRED: Record<EntityKind, string[]> = {
  tasks: ['title', 'status', 'priority'],
  events: ['title', 'startAt'],
  reminders: ['title', 'remindAt', 'status'],
  routines: ['name', 'weekdays', 'steps'],
  routineCompletions: ['routineId', 'date', 'doneStepIds'],
  habits: ['name', 'frequency'],
  notes: ['title', 'kind2'],
  transactions: ['kind2', 'amountCents', 'occurredAt'],
  categories: ['name', 'kind2'],
  goals: ['title', 'status'],
  projects: ['name', 'status'],
  focusSessions: ['startedAt', 'durationMin', 'type'],
};

/** Normalizes one raw entity of a given kind, or null when invalid. */
export function normalizeEntity(kind: EntityKind, raw: unknown): AnyEntity | null {
  if (!isObj(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id.length === 0 || o.id.length > 128) return null;
  if (typeof o.createdAt !== 'string' || typeof o.updatedAt !== 'string') return null;
  // Timestamps must be real ISO-ish dates ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm")
  // so lexicographic conflict resolution cannot be gamed with "9999-…".
  if (tryParseISO(o.createdAt) === null || tryParseISO(o.updatedAt) === null) return null;
  if (o.deletedAt !== null && (typeof o.deletedAt !== 'string' || tryParseISO(o.deletedAt) === null)) return null;
  if (typeof o.rev !== 'number' || !Number.isFinite(o.rev) || o.rev < 0) return null;

  const shape = SHAPES[kind];
  const out: Record<string, unknown> = {
    id: o.id,
    kind: ENTITY_KIND_NAMES[kind],
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    deletedAt: typeof o.deletedAt === 'string' ? o.deletedAt : null,
    rev: Math.floor(o.rev),
  };
  for (const [field, validate] of Object.entries(shape)) {
    if (!(field in o) || o[field] === undefined) continue;
    const value = o[field];
    if (value === null) {
      out[field] = null; // nullable fields accept null
      continue;
    }
    if (!validate(value)) continue; // wrong type -> drop field
    out[field] = value;
  }
  // Reject when a required field is missing or was dropped as invalid.
  for (const field of REQUIRED[kind]) {
    if (out[field] === undefined) return null;
  }
  return out as unknown as AnyEntity;
}

export interface DocumentValidation {
  document: LifeOSDocument | null;
  /** Entities dropped because they were structurally invalid. */
  dropped: Record<EntityKind, number>;
  error?: string;
}

/**
 * Validates a parsed (unknown) JSON value as a LifeOS document. Returns the
 * normalized document (invalid entities dropped) or null + error.
 */
export function validateDocument(raw: unknown): DocumentValidation {
  const dropped = Object.fromEntries(ENTITY_KINDS.map((k) => [k, 0])) as Record<EntityKind, number>;
  if (!isObj(raw)) return { document: null, dropped, error: 'File is not a JSON object.' };
  const doc = raw as Record<string, unknown>;
  if (doc.format !== FORMAT) {
    return { document: null, dropped, error: `Not a Life OS file (format="${String(doc.format)}").` };
  }
  if (typeof doc.version !== 'number' || doc.version > SCHEMA_VERSION) {
    return { document: null, dropped, error: `Unsupported file version ${String(doc.version)} (app supports ${SCHEMA_VERSION}).` };
  }
  if (!isObj(doc.data)) return { document: null, dropped, error: 'File has no data section.' };
  const data = doc.data as Record<string, unknown>;
  const collectionsRaw = data.collections;
  if (!isObj(collectionsRaw)) return { document: null, dropped, error: 'File has no collections section.' };

  const collections = {} as LifeOSDocument['data']['collections'];
  for (const kind of ENTITY_KINDS) {
    const list = (collectionsRaw as Record<string, unknown>)[kind];
    const out: unknown[] = [];
    if (Array.isArray(list)) {
      for (const item of list) {
        const e = normalizeEntity(kind, item);
        if (e) out.push(e);
        else dropped[kind]++;
      }
    }
    (collections as Record<string, unknown[]>)[kind] = out;
  }

  return {
    document: {
      format: FORMAT,
      version: Math.min(SCHEMA_VERSION, typeof doc.version === 'number' ? Math.floor(doc.version) : SCHEMA_VERSION),
      exportedAt: typeof doc.exportedAt === 'string' ? doc.exportedAt : new Date().toISOString(),
      device: isObj(doc.device)
        ? {
            id: typeof (doc.device as Record<string, unknown>).id === 'string' ? (doc.device as Record<string, unknown>).id as string : 'unknown',
            name: typeof (doc.device as Record<string, unknown>).name === 'string' ? (doc.device as Record<string, unknown>).name as string : 'Imported',
          }
        : { id: 'unknown', name: 'Imported' },
      data: { collections },
    },
    dropped,
  };
}
