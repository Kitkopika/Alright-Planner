/**
 * Refreshes the Android home-screen widgets (native bridge). No-op on
 * platforms without the native module, so it is safe to call anywhere.
 */

import { NativeModules, Platform } from 'react-native';

/** Ask the native side to re-render every placed widget with fresh data. */
export function refreshWidgets(): void {
  try {
    if (Platform.OS === 'android') {
      NativeModules.WidgetUpdater?.refreshWidgets();
    }
  } catch {
    // never crash the app because of a widget refresh
  }
}
