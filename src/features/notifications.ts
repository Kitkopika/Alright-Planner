/**
 * Notifications for reminders.
 *
 * The app keeps a local `reminders` collection (created from events'/tasks'
 * "remind me before" offsets plus standalone reminders). This module mirrors
 * that collection into real notifications:
 *
 *  - Android/iOS (expo-notifications): cancel-all + re-schedule pending
 *    future reminders as system notifications. Exact alarms are requested so
 *    deliveries happen on time; the boot receiver (library manifest)
 *    re-schedules after a reboot.
 *  - Web/PWA: uses the browser Notification API while the app is open. A
 *    periodic checker fires `new Notification(...)` for reminders whose time
 *    has arrived (tracked in localStorage so each fires once). True
 *    background delivery on the web needs Web Push, which requires a push
 *    server — out of scope for this local-first app.
 *
 * initNotifications() is safe to call from any mount (e.g. after the root
 * remounts on theme change): it re-establishes the store subscription and
 * cleans up its own interval/subscription on unmount.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useLifeOS } from '../data/store';
import { useSettings } from '../data/settings';
import { reminderBody, schedulableReminders } from './reminderSchedule';

const CHANNEL_ID = 'reminders';
const SYNC_DEBOUNCE_MS = 600;
const WEB_CHECK_MS = 20_000;
const WEB_FIRED_KEY = 'alright:web-notifications-fired';

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let webTimer: ReturnType<typeof setInterval> | null = null;

/* ------------------------------------------------------------------ */
/* Scheduling (native)                                                 */
/* ------------------------------------------------------------------ */

/** Cancels all scheduled notifications and re-schedules pending future ones. */
export async function syncNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    return; // not granted / not ready yet
  }
  const data = useLifeOS.getState().data;
  const list = schedulableReminders(data.collections.reminders ?? []);
  for (const r of list) {
    const at = tryParseRemindAt(r.remindAt);
    if (!at) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: r.title,
          body: reminderBody(r, currentLang()),
          sound: true,
          data: { reminderId: r.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: CHANNEL_ID,
        },
      });
    } catch {
      // skip a single bad entry; keep scheduling the rest
    }
  }
}

function tryParseRemindAt(iso: string): Date | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms);
}

function currentLang(): 'en' | 'th' {
  return useSettings.getState().language === 'th' ? 'th' : 'en';
}

function scheduleSyncSoon(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncNotifications();
  }, SYNC_DEBOUNCE_MS);
}

/** Schedules a notification ~2s from now so the user can verify the pipeline. */
export async function sendTestNotification(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') return false;
      fireWebNotification('Alright', 'Test notification ✓');
      return true;
    }
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return false;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Alright', body: 'Test notification ✓', sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: CHANNEL_ID,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Web / PWA notifications (Notification API, tab open)                */
/* ------------------------------------------------------------------ */

function webFiredSet(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(WEB_FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function webFiredSave(set: Set<string>): void {
  try {
    // Prune entries older than a day to keep the key small.
    const dayAgo = Date.now() - 86_400_000;
    const live = [...set].filter((id) => Date.parse(id.split(':')[0]) > dayAgo);
    globalThis.localStorage?.setItem(WEB_FIRED_KEY, JSON.stringify(live));
  } catch {
    // ignore
  }
}

function fireWebNotification(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body });
  } catch {
    // ignore
  }
}

/** Fires browser notifications for reminders whose time has arrived. */
export function checkDueWebNotifications(): void {
  if (Platform.OS !== 'web') return;
  const data = useLifeOS.getState().data;
  const now = Date.now();
  const fired = webFiredSet();
  let changed = false;
  for (const r of data.collections.reminders ?? []) {
    if (r.status !== 'pending' || r.deletedAt) continue;
    const at = tryParseRemindAt(r.remindAt);
    if (!at || at.getTime() > now) continue;
    const key = `${r.remindAt}:${r.id}`;
    if (fired.has(key)) continue;
    fired.add(key);
    changed = true;
    fireWebNotification(r.title, reminderBody(r, currentLang()));
  }
  if (changed) webFiredSave(fired);
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

/**
 * Call from the root layout. Idempotent per mount: sets up the handler /
 * channel / permission, re-establishes the store subscription (which also
 * covers the post-hydrate data arriving), and starts the web due-checker.
 * Returns an unsubscribe that also clears the interval/timer.
 */
export function initNotifications(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const isWeb = Platform.OS === 'web';

  if (!isWeb && Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    })
      .catch(() => {})
      .then(() => {
        // Only schedule once the channel exists (a missing channel silently
        // drops notifications on some devices).
        void Notifications.requestPermissionsAsync().catch(() => {});
        scheduleSyncSoon();
      });
  } else {
    void Notifications.requestPermissionsAsync().catch(() => {});
  }

  if (isWeb) {
    // Check for due reminders while the tab is open.
    checkDueWebNotifications();
    webTimer = setInterval(checkDueWebNotifications, WEB_CHECK_MS);
  } else {
    scheduleSyncSoon();
  }

  // Re-schedule whenever data changes: full hydrate arrival + reminders ref.
  let wasHydrated = useLifeOS.getState().hydrated;
  let last: unknown = useLifeOS.getState().data.collections.reminders;
  const unsub = useLifeOS.subscribe(() => {
    const s = useLifeOS.getState();
    if (s.hydrated !== wasHydrated) {
      wasHydrated = s.hydrated;
      scheduleSyncSoon();
    }
    const ref = s.data.collections.reminders;
    if (ref !== last) {
      last = ref;
      scheduleSyncSoon();
    }
  });

  return () => {
    unsub();
    if (syncTimer) clearTimeout(syncTimer);
    if (webTimer) clearInterval(webTimer);
  };
}
