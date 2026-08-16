/**
 * System notifications (Android/iOS) for reminders.
 *
 * The app keeps a local `reminders` collection (created from events'/tasks'
 * "remind me before" offsets plus standalone reminders). This module mirrors
 * that collection into real OS notifications: on start (and whenever the
 * collection changes) it cancels everything and re-schedules all pending,
 * future reminders. Exact alarms are requested so deliveries happen on time.
 *
 * Web is a no-op (no system notifications in the browser).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useLifeOS } from '../data/store';
import { useSettings } from '../data/settings';
import { reminderBody, schedulableReminders } from './reminderSchedule';

const CHANNEL_ID = 'reminders';
const SYNC_DEBOUNCE_MS = 600;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let inited = false;

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

/**
 * Call once from the root layout. Sets the foreground handler, creates the
 * Android channel, requests permission, and re-schedules whenever the
 * reminders collection changes (which also covers post-hydrate data).
 */
export function initNotifications(): () => void {
  if (Platform.OS === 'web') return () => {};
  if (inited) return () => {};
  inited = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    }).catch(() => {});
  }

  Notifications.requestPermissionsAsync().catch(() => {});

  // Re-schedule when the reminders collection actually changes (including
  // the async hydrate replacing it with the persisted copy on launch).
  let last: unknown;
  const unsub = useLifeOS.subscribe(() => {
    const ref = useLifeOS.getState().data.collections.reminders;
    if (ref !== last) {
      last = ref;
      scheduleSyncSoon();
    }
  });
  scheduleSyncSoon();

  return unsub;
}
