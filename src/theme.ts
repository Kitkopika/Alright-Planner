/**
 * Design tokens — consistent, lightweight, no UI library.
 */

export const colors = {
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
