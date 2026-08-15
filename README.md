# Alright

A lightweight, **local-first personal life operating system** prototype. Android-first, one codebase that also runs on iOS and the web.

Everything you track — tasks, calendar, routines, habits, reminders, money, notes, goals, projects and focus time — lives in **one portable JSON file on your device**. No cloud, no account, no AI. Move to another device by exporting and importing that file; IDs and relationships survive intact.

> **Prototype status.** This is a functional first prototype, not a finished product. It is built so a real sync system can be added later without touching the core app.

## Highlights

- **Today dashboard** — schedule, tasks, habits/routines, reminders, spending, goals, quick notes and a daily progress ring in one screen.
- **Calendar** — day / week / month / agenda views, events, deadlines, recurring events, tasks integrated, event reminders.
- **Tasks** — subtasks, priorities, due dates, recurring tasks, projects, calendar integration.
- **Routines & Habits** — custom routine templates scheduled per weekday, step checklists, habit streaks and 30-day completion history.
- **Reminders** — date/time, recurring and event-linked; dismiss/snooze per occurrence (in-app; OS notifications are a later add-on).
- **Finance** — income/expenses, categories (with budgets), quick entry, day/week/month/year summaries, category stats, CSV + JSON export.
- **Notes** — quick notes, journal, project notes, tags, links, global search across notes/tasks/events/goals/projects, and linking to tasks/projects/goals/events.
- **Goals & Projects** — Goal → Project → Task with automatic progress, deadlines.
- **Focus/Study** — Pomodoro or custom timer linked to a task/project; sessions feed Insights.
- **Insights** — task completion, habit rates and streaks, focus time, spending, goal progress (week/month).
- **Quick Add** — universal `+` button for Task, Reminder, Event, Expense, Income, Note, Habit, Goal.
- **Data & Backup** — export to `personal-data.json`, import (merge or replace with a dry-run preview), restore from the on-device rotating backup, erase all.

## Tech stack

- [Expo](https://expo.dev) (React Native, TypeScript) — one codebase for Android / iOS / Web.
- [expo-router](https://docs.expo.dev/router/introduction/) — file-based navigation.
- [zustand](https://github.com/pmndrs/zustand) — tiny state store.
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) — local JSON persistence.
- No UI library, no native date pickers, no background work: fast startup, minimal moving parts.

## Run it

```bash
npm install
npm start            # Expo dev server (QR code → open in Expo Go on Android)
npm run android      # start on Android (Expo Go)
npm run web          # start in the browser
```

**Testing on your Android phone (no Android Studio needed):** install **Expo Go** from the Play Store, scan the QR code from `npm start`. For a standalone APK later, use `npx eas build` (Expo EAS).

### Verify locally

```bash
npm run typecheck    # tsc --noEmit
npm test             # jest (core logic: data model, import/export, recurrence, finance, today, insights)
npm run export:web   # bundles the whole app for web (proves it compiles end to end)
```

### Build a standalone APK (Android)

A signed, installable release APK is built and left at the project root:

```
life-os-1.1.0-release.apk   (com.lifeos.app, v1.1.0, minSdk 24, targetSdk 36)
```

Rebuild it yourself with:

```bash
npx expo prebuild -p android   # generates the native android/ project once
cd android
JAVA_HOME=<jdk17> ANDROID_HOME=<android-sdk> ./gradlew assembleRelease
```

(Requires a JDK 17+, the Android SDK with platforms;android-36, build-tools 35/36,
and NDK 27.0.12077973 + 27.1.12297006.) For a Play Store–ready AAB or cloud
builds, use `npx eas build` with your Expo account instead.

## Data: one portable JSON file

The entire app is a single document, `personal-data.json`, stored in the app's document directory (a rotating `.backup` copy is kept before each write). The same document is what you export and import — **the file is the source of truth**.

```text
Device A                    Device B
   │                            │
   └── Export JSON  ──▶  personal-data.json  ──▶  Import (merge or replace)
```

Every entity has a stable unique `id` (uuid) so relationships survive the trip:

```text
Goal ──▶ Project ──▶ Task
Goal ──▶ Habit
Project ──▶ Notes / Tasks
Event ──▶ Reminder
Task ──▶ Event / FocusSession
Transaction ──▶ Category / Project
```

Example document (trimmed):

```json
{
  "format": "life-os",
  "version": 1,
  "exportedAt": "2026-08-14T09:00:00.000Z",
  "device": { "id": "a1b2c3d4", "name": "My Device" },
  "data": {
    "collections": {
      "tasks": [
        {
          "id": "9f8e…",
          "kind": "task",
          "title": "Ship the prototype",
          "status": "todo",
          "priority": "high",
          "dueAt": "2026-08-18T18:00",
          "projectId": "5c1a…",
          "createdAt": "2026-08-14T09:00",
          "updatedAt": "2026-08-14T09:00",
          "deletedAt": null,
          "rev": 1
        }
      ]
    }
  }
}
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full schema, the import conflict policy, and how the data layer is designed so a sync system can be added later.

## Layout

```
app/                    expo-router routes (Today, Calendar, Tasks, Routines,
│                       Money, Goals, Notes, Insights, Data & Backup)
src/
├── core/               pure logic: types, ids, time, recurrence
├── data/               schema validation, JSON exchange (import/export/merge),
│                       persistence adapter, zustand store
├── features/           pure aggregations: today, calendar, finance, insights
├── components/         shared UI kit, forms, Quick Add, editors
└── theme.ts            design tokens
__tests__/              jest unit tests for the core logic
docs/                   architecture + sample data
```

## Privacy & design constraints

- Offline-first: no network requests at runtime, no analytics, no telemetry.
- No AI features.
- Minimal background processing (a single debounced file write).
- Imported JSON is strictly validated (field whitelist, type checks, required fields, size-safe ids) before anything is merged — see `src/data/schema.ts`.
- Amounts are stored as integer minor units (cents) to avoid float rounding.
