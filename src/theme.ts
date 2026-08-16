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
  // Typography is a plain object referenced directly by screens; updating it
  // in place keeps text theme-aware without touching every <Text>.
  typography.title.color = colors.text;
  typography.section.color = colors.text;
  typography.body.color = colors.text;
  typography.caption.color = colors.textSecondary;
  typography.label.color = colors.textSecondary;
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

/** Rotate a hex color by `deg` degrees (HSL hue rotation) for gradient pairs. */
export function rotateHue(hex: string, deg: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / d + 2) / 6;
    else hue = ((r - g) / d + 4) / 6;
  }
  hue = (hue + deg / 360) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  r = hue2rgb(hue + 1 / 3);
  g = hue2rgb(hue);
  b = hue2rgb(hue - 1 / 3);
  const to2 = (v: number) => Math.round(Math.max(0, Math.min(255, v * 255))).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Blend a hex toward white (ratio > 0) or black (ratio < 0). */
export function shade(hex: string, ratio: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const target = ratio > 0 ? 255 : 0;
  const a = Math.abs(Math.max(-1, Math.min(1, ratio)));
  r = Math.round(r + (target - r) * a);
  g = Math.round(g + (target - g) * a);
  b = Math.round(b + (target - b) * a);
  const to2 = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/**
 * A clearly-visible bevel gradient for filled controls: lighter at the
 * top-left, darker at the bottom-right — adds depth while keeping the white
 * label legible.
 */
export function accentGradient(accent: string): [string, string] {
  return [shade(accent, 0.2), shade(accent, -0.16)];
}

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
  xl: 20,
  xxl: 28,
  pill: 999,
};

export const typography = {
  // Size-specific tracking + leading (WWDC 2020): display text tightens as it
  // grows, small labels get slight positive tracking for legibility.
  title: { fontSize: 24, fontWeight: '700' as const, color: lightColors.text, letterSpacing: -0.5, lineHeight: 29 },
  section: { fontSize: 17, fontWeight: '600' as const, color: lightColors.text, letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, color: lightColors.text, letterSpacing: 0, lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: '400' as const, color: lightColors.textSecondary, letterSpacing: 0.2, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '600' as const, color: lightColors.textSecondary, letterSpacing: 0.3, lineHeight: 18 },
};

/**
 * Motion tokens (WWDC 2018 "Designing Fluid Interfaces"). Values are the
 * spring parameters Apple ships, expressed in React Native's spring terms:
 * critically damped (no overshoot) for default UI, slight bounce only when a
 * gesture carried momentum.
 */
export const motion = {
  /** Default UI: critically damped, settle ~0.35s — graceful, no bounce. */
  spring: { damping: 20, stiffness: 260, mass: 0.6 },
  /** Momentum interactions (flicks, sheet dismiss): a touch of bounce. */
  momentumSpring: { damping: 14, stiffness: 220, mass: 0.7 },
  /** Fallback cross-fade duration (ms) for reduced-motion contexts. */
  quickFade: 160,
};

/** Elevation / depth — flat cards, floating surfaces, and accent glows. */
export const shadow = {
  sm: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  card: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  float: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
};

/** Frosty-glass material (approximated without a native blur module). */
export const glass = {
  light: 'rgba(255,255,255,0.88)',
  dark: 'rgba(30,30,38,0.88)',
  /** Light-catching top edge on glass surfaces. */
  highlight: 'rgba(255,255,255,0.55)',
  /** Hairline rim around glass panels. */
  border: 'rgba(255,255,255,0.28)',
};
