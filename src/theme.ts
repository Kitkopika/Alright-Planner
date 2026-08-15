/**
 * Design tokens — consistent, lightweight, no UI library.
 *
 * `colors` is mutable: the Settings screen calls `applyTheme(mode, accent)`
 * to swap between light/dark palettes and a custom accent at runtime. Screens
 * read `colors.*` at render time; the root layout remounts the tree on theme
 * changes so every screen picks up the new palette.
 */

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
}

export const lightColors: Palette = {
  background: '#F7F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F4',
  border: '#E4E4EA',
  text: '#1C1C22',
  textSecondary: '#6B6B76',
  textMuted: '#9A9AA5',
  accent: '#4F46E5',
  accentSoft: '#EEEDFB',
  success: '#16A34A',
  successSoft: '#E7F6EC',
  danger: '#DC2626',
  dangerSoft: '#FDEBEB',
  warning: '#D97706',
  warningSoft: '#FCF3E3',
  info: '#0891B2',
  infoSoft: '#E2F5F8',
};

export const darkColors: Palette = {
  background: '#121216',
  surface: '#1E1E26',
  surfaceAlt: '#2A2A33',
  border: '#363640',
  text: '#ECECF1',
  textSecondary: '#A8A8B4',
  textMuted: '#71717E',
  accent: '#8B8FF8',
  accentSoft: '#2A2A45',
  success: '#34D399',
  successSoft: '#133326',
  danger: '#F87171',
  dangerSoft: '#3A2024',
  warning: '#FBBF24',
  warningSoft: '#3A2F14',
  info: '#22D3EE',
  infoSoft: '#14303A',
};

export const colors: Palette = { ...lightColors };

let isDark = false;
let version = 0;

/** True when the OS prefers dark (used for 'system' mode). */
function prefersDarkScheme(): boolean {
  try {
    return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Applies a palette + accent, bumping the theme version (used as remount key). */
export function applyTheme(mode: 'light' | 'dark' | 'system', accent: string): void {
  isDark = mode === 'dark' || (mode === 'system' && prefersDarkScheme());
  const base = isDark ? darkColors : lightColors;
  Object.assign(colors, base);
  colors.accent = accent;
  colors.accentSoft = accent + '22';
  version++;
}

/** Current dark-mode state (for the status bar). */
export function isDarkMode(): boolean {
  return isDark;
}

/** Incremented on every palette change; use as a remount key to re-render screens. */
export function themeVersion(): number {
  return version;
}

/** Priority colors used across tasks/events. */
export const priorityColors: Record<string, string> = {
  low: '#16A34A',
  medium: '#D97706',
  high: '#DC2626',
  urgent: '#7C3AED',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const },
  section: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
};
