/**
 * Core data model for Life OS.
 *
 * Every entity has a stable unique `id` (uuid v4) so that relationships
 * (e.g. Goal -> Project -> Task) survive JSON export/import and a future
 * sync system. Soft deletes are used (`deletedAt` tombstone) so sync can
 * propagate deletions without ambiguity.
 *
 * All timestamps are ISO-8601 strings (local time, no timezone offset) to
 * keep the JSON portable and human-readable.
 */

/** Base fields shared by every entity. */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Tombstone: set when the entity is deleted (sync-ready soft delete). */
  deletedAt: string | null;
  /** Monotonic revision, bumped on every update. Used as a tie-breaker when merging. */
  rev: number;
}

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Simple recurrence rule. Weekday numbers: 0 = Sunday ... 6 = Saturday. */
export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
  /** For weekly recurrence: which weekdays the series occurs on. */
  byWeekdays?: number[];
  /** Optional end date (inclusive) as YYYY-MM-DD. */
  until?: string | null;
  /** Optional maximum number of occurrences (including the first). */
  count?: number | null;
}

export type TransactionKind = 'income' | 'expense';

export type NoteKind = 'note' | 'journal' | 'project';

export type GoalStatus = 'active' | 'done' | 'archived';

export type ProjectStatus = 'active' | 'done' | 'archived';

export type FocusType = 'pomodoro' | 'custom';

export type ReminderStatus = 'pending' | 'triggered' | 'dismissed' | 'snoozed';

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Task extends BaseEntity {
  kind: 'task';
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: Priority;
  /** Due date/time (ISO). May be date-only "YYYY-MM-DD" or full "YYYY-MM-DDTHH:mm". */
  dueAt?: string | null;
  /** When the task should start (ISO). */
  startAt?: string | null;
  recurrence?: Recurrence | null;
  /** Parent task id (subtasks). */
  parentTaskId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  /** Event id this task is attached to (Task -> Event). */
  eventId?: string | null;
  /** For recurring tasks: date keys ("YYYY-MM-DD") on which an instance was completed. */
  completedDates?: string[];
  completedAt?: string | null;
  estimatedMinutes?: number;
  tags?: string[];
  sortOrder?: number;
}

export interface Event extends BaseEntity {
  kind: 'event';
  title: string;
  /** ISO datetime (or date-only for all-day events). */
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  recurrence?: Recurrence | null;
  /** Minutes before start to remind. */
  reminderOffsetMin?: number | null;
  location?: string;
  notes?: string;
  color?: string;
  taskId?: string | null;
  projectId?: string | null;
}

export interface Reminder extends BaseEntity {
  kind: 'reminder';
  title: string;
  remindAt: string;
  recurrence?: Recurrence | null;
  /** Link to an event (Event -> Reminder). */
  eventId?: string | null;
  taskId?: string | null;
  status: ReminderStatus;
  snoozedUntil?: string | null;
  /** For recurring reminders: date keys already triggered. */
  triggeredDates?: string[];
}

export interface RoutineStep {
  id: string;
  label: string;
}

export interface Routine extends BaseEntity {
  kind: 'routine';
  name: string;
  /** Weekdays this routine is scheduled for: 0 = Sunday ... 6 = Saturday. */
  weekdays: number[];
  /** Best-effort time of day, "HH:mm". */
  timeOfDay?: string | null;
  steps: RoutineStep[];
  color?: string;
  icon?: string;
}

/** A single dated completion of a routine's checklist. */
export interface RoutineCompletion extends BaseEntity {
  kind: 'routineCompletion';
  routineId: string;
  /** Date key "YYYY-MM-DD". */
  date: string;
  doneStepIds: string[];
}

export interface HabitFrequency {
  type: 'daily' | 'weekly' | 'custom';
  /** For 'custom': weekdays this habit is scheduled on. */
  weekdays?: number[];
  /** For 'weekly': target completions per week. */
  timesPerWeek?: number;
}

export interface Habit extends BaseEntity {
  kind: 'habit';
  name: string;
  frequency: HabitFrequency;
  goalId?: string | null;
  color?: string;
  icon?: string;
  archived?: boolean;
  /** Date keys "YYYY-MM-DD" the habit was completed on. */
  completions: string[];
}

export interface NoteAttachment {
  name: string;
  uri?: string | null;
}

export interface Note extends BaseEntity {
  kind: 'note';
  title: string;
  body: string;
  kind2: NoteKind;
  tags?: string[];
  attachments?: NoteAttachment[];
  /** Plain URLs / links. */
  links?: string[];
  taskId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  eventId?: string | null;
  /** Date key for journal entries (defaults to createdAt's date). */
  journalDate?: string | null;
}

export interface Transaction extends BaseEntity {
  kind: 'transaction';
  kind2: TransactionKind;
  /** Integer minor units (cents) to avoid float rounding issues. */
  amountCents: number;
  currency: string;
  categoryId?: string | null;
  projectId?: string | null;
  /** ISO datetime the transaction happened. */
  occurredAt: string;
  note?: string;
}

export interface Category extends BaseEntity {
  kind: 'category';
  name: string;
  kind2: TransactionKind;
  color?: string;
  icon?: string;
  /** Optional monthly budget in minor units. */
  monthlyBudgetCents?: number | null;
}

export interface Goal extends BaseEntity {
  kind: 'goal';
  title: string;
  description?: string;
  deadline?: string | null;
  status: GoalStatus;
  color?: string;
  sortOrder?: number;
}

export interface Project extends BaseEntity {
  kind: 'project';
  name: string;
  description?: string;
  goalId?: string | null;
  status: ProjectStatus;
  deadline?: string | null;
  color?: string;
  sortOrder?: number;
}

export interface FocusSession extends BaseEntity {
  kind: 'focusSession';
  startedAt: string;
  endedAt: string | null;
  durationMin: number;
  type: FocusType;
  taskId?: string | null;
  projectId?: string | null;
  subject?: string | null;
}

// ---------------------------------------------------------------------------
// Document (the portable JSON file)
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 1;
export const FORMAT = 'life-os';

export interface CollectionMap {
  tasks: Task;
  events: Event;
  reminders: Reminder;
  routines: Routine;
  routineCompletions: RoutineCompletion;
  habits: Habit;
  notes: Note;
  transactions: Transaction;
  categories: Category;
  goals: Goal;
  projects: Project;
  focusSessions: FocusSession;
}

export type EntityKind = keyof CollectionMap;
export type AnyEntity = CollectionMap[EntityKind];

/** Plural collection key -> singular entity discriminant (e.g. "tasks" -> "task"). */
export const ENTITY_KIND_NAMES: Record<EntityKind, AnyEntity['kind']> = {
  tasks: 'task',
  events: 'event',
  reminders: 'reminder',
  routines: 'routine',
  routineCompletions: 'routineCompletion',
  habits: 'habit',
  notes: 'note',
  transactions: 'transaction',
  categories: 'category',
  goals: 'goal',
  projects: 'project',
  focusSessions: 'focusSession',
};

export const ENTITY_KINDS: EntityKind[] = [
  'tasks',
  'events',
  'reminders',
  'routines',
  'routineCompletions',
  'habits',
  'notes',
  'transactions',
  'categories',
  'goals',
  'projects',
  'focusSessions',
];

export interface AppData {
  /** Each key holds a plain array of entities of that kind. */
  collections: { [K in EntityKind]: CollectionMap[K][] };
}

export interface DeviceInfo {
  id: string;
  name: string;
}

/** The full portable document: what is persisted on device and exported/imported. */
export interface LifeOSDocument {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  device: DeviceInfo;
  data: AppData;
}

export function emptyData(): AppData {
  const collections = {} as AppData['collections'];
  for (const kind of ENTITY_KINDS) {
    (collections as Record<string, unknown[]>)[kind] = [];
  }
  return { collections };
}
