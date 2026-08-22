/**
 * PWA support: registers the service worker so the web build works offline
 * and can be installed to the home screen ("Add to Home Screen").
 *
 * Only runs on web and only in production exports (`__DEV__` is false) —
 * in dev the Metro dev server is not offline-cacheable and a service worker
 * would just cache stale bundles.
 */

import { Platform } from 'react-native';

export function registerPwaServiceWorker(): void {
  if (Platform.OS !== 'web' || __DEV__) return;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    // Relative on purpose: resolves next to the app shell whether it is
    // hosted at a domain root or a subpath (e.g. GitHub Pages project sites).
    navigator.serviceWorker
      .register('sw.js')
      .catch((err) => {
        // Non-fatal: the app still works, just without offline/install support.
        console.warn('Service worker registration failed:', err);
      });
  });
}
