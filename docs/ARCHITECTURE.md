# Architecture

This document explains how the Life OS prototype is structured, why it is
shaped this way, and how to evolve it (especially toward cloud sync) without
rewriting the core.

## 1. Layers

```
┌─────────────────────────────────────────────────────────┐
│ app/            expo-router screens (thin UI)           │
├─────────────────────────────────────────────────────────┤
│ components/     shared UI kit, Quick Add, editors       │
├─────────────────────────────────────────────────────────┤
│ features/       PURE aggregations (today, calendar,     │
│                 finance, insights) — no React, testable │
├─────────────────────────────────────────────────────────┤
│ data/           store (zustand) · exchange (import/     │
│                 export/merge) · schema (validation) ·   │
│                 persistence (file adapter)              │
├─────────────────────────────────────────────────────────┤
│ core/           types · ids · time · recurrence         │
└─────────────────────────────────────────────────────────┘
```

Rules of thumb:

- **`core/` and `features/` are pure TypeScript.** No React Native imports, no
  I/O. They are unit-tested directly (`__tests__/`).
- **All data access goes through the store** (`src/data/store.ts`). Screens
  never touch the filesystem.
- **The persistence adapter is a 4-method interface** (`read`, `write`,
  `readBackup`, `remove`). Today it has two implementations (native file,
  web `localStorage`); a sync backend would be a third.
- **Screens are thin**: they read from the store and call CRUD actions.

## 2. Data model

All entities share a base shape:

```ts
interface BaseEntity {
  id: string;            // stable uuid — survives export/import
  createdAt: string;     // ISO local time
  updatedAt: string;     // ISO local time
  deletedAt: string | null; // tombstone (soft delete) — sync-ready
  rev: number;           // monotonic revision, bumped on every change
}
```

Collections (in `src/core/types.ts`):

| Collection            | Notes                                                    |
| --------------------- | -------------------------------------------------------- |
| `tasks`               | subtasks via `parentTaskId`; recurring via `completedDates` per instance |
| `events`              | recurring via `recurrence`; `reminderOffsetMin`          |
| `reminders`           | one-off or recurring; `triggeredDates` for per-instance dismissal |
| `routines`            | template + `weekdays` (0=Sun … 6=Sat); steps checklist   |
| `routineCompletions`  | per-day `doneStepIds` per routine                        |
| `habits`              | frequency (daily/weekly/custom days); `completions: date[]` |
| `notes`               | `kind2` = note/journal/project; links + attachments      |
| `transactions`        | integer minor units (`amountCents`), `occurredAt`        |
| `categories`          | income/expense, optional monthly budget                  |
| `goals`               | status + deadline                                        |
| `projects`            | `goalId` parent                                          |
| `focusSessions`       | pomodoro/custom, `durationMin`, optional task/project    |

Relationships are plain id references (see README diagram). Because every id
is globally unique and stable, relationships survive JSON export → import on
another device.

## 3. Recurrence

A small RRULE-like subset (`src/core/recurrence.ts`): `daily | weekly |
monthly | yearly`, `interval`, weekly `byWeekdays`, `until`, `count`.
`happensOn(rule, start, date)` powers the Today/Calendar views;
`nextOccurrence` powers event-series walking. Pure and unit-tested.

Monthly series only occur on months that actually contain the start
day-of-month (Jan 31 skips February) — matching common calendar behavior.

## 4. The portable document

```ts
interface LifeOSDocument {
  format: 'life-os';
  version: 1;                 // schema version
  exportedAt: string;
  device: { id: string; name: string };
  data: { collections: { [K in EntityKind]: Entity[] } };
}
```

**The persisted file and the export format are the same document.** Export =
read current state and serialize; Import = parse, validate, merge, persist.

### Import safety (`src/data/schema.ts`)

Untrusted JSON never enters the app unvalidated:

- `format` must be `life-os`; `version` must be ≤ current (future versions rejected).
- Every entity is normalized against a **field whitelist**: unknown fields are
  dropped, wrong-typed values are dropped, invalid enums are dropped.
- Required fields per kind are enforced (an entity missing them is rejected and counted).
- Ids must be 1–128 chars; timestamps must be strings; `rev` must be a non-negative number.

### Conflict policy (`src/data/exchange.ts`)

Import modes:

- **Merge** (default) — upsert by `id`:
  1. Duplicate ids inside one incoming file are collapsed (first wins, counted).
  2. For each id: newer `updatedAt` wins; tie → higher `rev`; full tie → incoming wins (an explicit user action), counted as a *conflict resolved*.
  3. Tombstones participate normally: a newer tombstone deletes locally (counted as *deleted*); an older tombstone loses to a newer live copy (resurrection is allowed — you re-edited it after deleting it elsewhere).
  4. Nothing local is ever lost: entities not present in the file stay.
- **Replace** — wipes local data and loads the file (restore).
- A **dry-run preview** (`planImport`) reports added/updated/deleted/conflicts/duplicates before applying.

## 5. Why this is sync-ready

The design deliberately mirrors what a proper sync engine needs:

1. **Single document with stable ids and `rev`/`updatedAt`** — the standard
   last-write-wins (LWW) fields are already maintained on every mutation.
2. **Tombstones** — deletes propagate as `deletedAt`, so a sync peer can learn
   about deletions instead of guessing.
3. **The exchange layer is transport-agnostic.** `mergeData(local, incoming)`
   is pure: a future sync client only needs to fetch a peer's document (or
   per-entity changes) and call the same merge. The import UI and the sync
   engine would share one code path.
4. **Persistence is behind an interface** — a sync adapter can be added
   without touching the store or screens.
5. **Offline-first by construction** — the app already reads/writes only local
   state; sync is an add-on that merges peer state into it.

Suggested next steps for sync (out of scope for the prototype): per-entity
change log (oplog) so peers exchange deltas instead of whole documents, and a
device registry to avoid same-device loops.

## 6. Finance

- Amounts are **integer minor units** (`amountCents`) — never floats.
- `buildSummaries` computes day/week/month/year income, expense, net and a
  per-category breakdown with shares.
- CSV export (`transactionsToCSV`) implements RFC-4180 escaping.

## 7. Notable limitations (prototype)

- **Reminders are in-app only.** Local OS notifications (expo-notifications)
  are a natural next step; the data model already supports per-instance
  triggering.
- Attachments on notes are stored by name only (no file copying yet).
- One currency (USD) by default; `currency` is stored per transaction.
- No OS-level backup integration; the on-device rotating backup + export file
  are the backup story.
- Date/time entry uses text fields with quick-pick chips (no native picker) so
  the identical UI runs on Android, iOS and web.
