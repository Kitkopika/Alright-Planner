# Alright — Update Log

> Local-first life OS for planning your life.
> Every version below is a **release** of the app (Android APK / iOS build).

---

## 2.0.4 — Real System Notifications

- **Notifications now actually fire on Android**: `expo-notifications` is wired up — the app creates a notification channel, requests the Android 13+ permission on first launch, and mirrors every pending reminder (event/task "remind me before" offsets and standalone reminders) into a real scheduled system notification
- **Auto-reschedule**: whenever the reminders collection changes (or on app start after the data hydrates), scheduled notifications are re-synced — cancel-all + re-schedule pending future reminders
- **On-time delivery**: exact alarms (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`) so reminders arrive when they should; boot receiver re-schedules after reboot
- Notification text follows the app language (EN/TH), e.g. "Tue, Aug 20, 09:30"

---

## 2.0.3 — Bug Fixes & Smooth Navigation

- **Frosted glass works on Android**: real backdrop blur via `expo-blur` (`BlurView` + root `BlurTargetView`, `dimezisBlurView` method) on `Glass`/`Sheet`; web keeps CSS blur
- **Smoother animations**: style sheets computed once per theme instead of every render/`map()` iteration; `GradientFill` now uses native `expo-linear-gradient` (no re-render storm in animated buttons); progress bars animate on the UI thread (`scaleX`)
- **No more white rectangles**: every SVG paints a transparent background (e.g. behind the Focus title); ghost/outlined buttons no longer fill white on Android (elevation reset)
- **Tab switching is smooth in both directions**: slide → fade transition, scenes stay attached (`detachInactiveScreens: false`), all tabs pre-mounted, and each screen re-renders only when *its own* data changes (`useDataSlice`)

---

## 2.0.1 — New Icon & Polish

- New app icon/logo: upside-down **V (chevron)** in the app's accent gradient (all icon assets re-rendered from `assets/logo.svg`)
- Frosted-glass surfaces made more transparent
- Removed the "System" theme option (Light / Dark only)
- Quick-add sheet moved flush to the bottom of the screen (safe-area aware)
- Button press animation: native-driver (smoother), longer + more travel; nav-bar spotlight slide now respects the Animation toggle
- Tab screens pre-mounted for instant switching (no blank on first visit)

---

## 2.0.0 — Design System Overhaul

A full visual identity pass across the entire app.

**Personality & depth**
- Ambient background layer with theme-colored spotlight glows, gradient washes and frosty blur
- Shadows, gradients and glass-blur (frosted) surfaces on cards, overlays, quick-add and sheets
- Text shadow / glow on key headings and the date header
- Animated transitions: spotlight slides in the nav bar, animated filter chips, animated sheet/overlay presentation

**Theme engine**
- Fully theme-aware UI in light *and* dark mode (no more leftover hardcoded colors)
- New **beta visual settings**: independently toggle *Animation*, *Background* and *Lighting* effects
- Home-screen widgets also follow the theme when the effects are on

**Polish**
- Calendar's floating "+" circle replaced with a normal button matching other pages
- New app logo: upside-down V mark in the app theme colors

---

## 1.5.9 — Layout Config, Color Picker & Reminders

- **Configurable Today screen**: reorder / add / remove / scale home widgets (add, remove, move up/down, size scale)
- **More home widgets**: graph widgets (e.g. mini bar chart), reminders, etc.
- Home layout is saved to the JSON settings file
- **Standard square color picker** for custom theme color (saturation/value square + hue slider) — fixed the "click turns black" bug
- **Reminders page**: a real page that lists reminders from tasks/events/habits and lets you add standalone reminders
- Sub-tasks no longer duplicate as main tasks; reminder icon removed from the home page

---

## 1.5.8 — Thai Polish, Reminder Presets, Task Rework

- **Thai localization**: daily progress ("0 of 0 done"), +1w/+1m chips, h/m → ชม./น., Link-to labels
- **Remind before** rebuilt: quick presets (1/2/3 days, 2 hours, 20 min…) and **multiple** reminders per item
- **Tasks**: removed unused "estimated time"; sub-tasks are inline checklists that auto-tick with the parent; tasks can have reminders
- Navigation bar un-cluttered (Insights removed); money CSV/Category buttons restyled

---

## 1.5.7

- Rebuilt APK (versionCode 10507)

## 1.5.6 — More Widgets

- Added **Goals** and **Reminders** widgets (6 home-screen widgets total)
- Crash-proof widget layouts

## 1.5.1

- Fixed weekday labels being off by one (Monday-first indexing)

## 1.5.0 — Home-Screen Widget

- Added the first Android home-screen widget (Today)

---

## 1.4.0 — Persistence, Theme & Focus

- **Settings save to a JSON file** of the app
- Keyboard no longer hides text inputs (KeyboardAvoidingView on Android edge-to-edge)
- **Custom theme color** beyond the presets
- **Focus mode**: scrollable hour/minute wheel picker and a lock system
- Calendar redesign; smaller app icon

---

## 1.3.0 — Calendar & Money

- Calendar: multi-day events span their full range; connected multi-day lines; week time table; all-day events fill the table
- Events/tasks ordered and stacked properly; changeable event start/end time
- **Thai baht suffix (฿)**, localized week calendar
- Dark-mode tab bar; icons rendered from the logo source

---

## 1.2.0 — Localization, Dark Mode & Insights

- **Full Thai localization** across routines, money, goals, notes, quick add, event editor, calendar, focus timer, data & backup
- **Dark mode** (theme-aware typography and surfaces)
- CSV export/import hardened (formula-safe, numeric-safe)
- Focus timer accuracy, insights charts, calendar timeline + year view, edge-to-edge fixes

---

## 1.1.0 — First Release

- UI pickers (wheel date/time), settings & themes, Thai language + THB currency, calendar polish

## 1.0.2 — Initial Build

- Local-first life OS prototype (Expo / React Native)
