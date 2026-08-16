/**
 * Small shared UI kit — no third-party component library, just consistent
 * primitives over react-native.
 */

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glass, isDarkMode, motion, radius, accentGradient, shadow, spacing, typography } from '../theme';
import { GradientFill, Reveal, PressableScale } from './motion';
import { useSettings } from '../data/settings';

/** Web-only frosted-glass (backdrop blur); native falls back to translucent. */
const FROST = { backdropFilter: 'blur(10px) saturate(150%)', WebkitBackdropFilter: 'blur(10px) saturate(150%)' } as unknown as ViewStyle;

// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
  onPress,
  onLongPress,
  variant = 'filled',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: 'filled' | 'outlined' | 'glass';
}) {
  styles = createStyles();
  const fx = useSettings((s) => s.visualFx.glass);
  const inner = (
    <Reveal distance={10}>
      <View
        style={[
          styles.card,
          variant === 'outlined' && styles.cardOutlined,
          variant === 'glass' && fx && styles.cardGlass,
          style,
        ]}
      >
        {children}
      </View>
    </Reveal>
  );
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => (pressed ? { opacity: 0.9, transform: [{ scale: 0.985 }] } : undefined)}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export const SectionHeader = React.memo(function SectionHeader({ title, right, style }: { title: string; right?: React.ReactNode; style?: ViewStyle }) {
  styles = createStyles();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={typography.section}>{title}</Text>
      {right}
    </View>
  );
});

export const Chip = React.memo(function Chip({
  label,
  selected,
  onPress,
  color,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  style?: ViewStyle;
}) {
  styles = createStyles();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      style={[
        styles.chip,
        selected && { backgroundColor: color || colors.accent, borderColor: color || colors.accent },
        style,
      ]}
    >
      {selected && <GradientFill colors={accentGradient(color || colors.accent)} />}
      <Text style={[styles.chipLabel, selected && { color: '#FFFFFF' }]}>{label}</Text>
    </PressableScale>
  );
});

export function ChipRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  styles = createStyles();
  return <View style={[styles.chipRow, style]}>{children}</View>;
}

export function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  styles = createStyles();
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function TextBox(props: TextInputProps) {
  styles = createStyles();
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.style]} />;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
}) {
  styles = createStyles();
  const bg =
    variant === 'primary' ? colors.accent
    : variant === 'danger' ? colors.danger
    : 'transparent';
  const fg =
    variant === 'primary' ? '#FFFFFF'
    : variant === 'danger' ? '#FFFFFF'
    : colors.accent;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: bg },
        variant === 'ghost' && styles.buttonGhost,
        small && styles.buttonSmall,
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {variant !== 'ghost' && (
        <GradientFill colors={accentGradient(bg)} />
      )}
      <Text style={[styles.buttonLabel, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>
    </PressableScale>
  );
}

export const IconButton = React.memo(function IconButton({
  name,
  onPress,
  color = colors.textSecondary,
  size = 20,
  style,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  styles = createStyles();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6, transform: [{ scale: 0.9 }] }, style]}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
});

export const ProgressBar = React.memo(function ProgressBar({ pct, color, height = 6, style }: { pct: number; color?: string; height?: number; style?: ViewStyle }) {
  styles = createStyles();
  const clamped = Math.max(0, Math.min(100, pct));
  const w = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    Animated.spring(w, { toValue: clamped, useNativeDriver: false, ...motion.spring }).start();
  }, [w, clamped]);
  return (
    <View style={[styles.progressTrack, { height }, style]}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            height,
            width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          },
        ]}
      >
        <GradientFill colors={accentGradient(color || colors.accent)} />
      </Animated.View>
    </View>
  );
});

export const EmptyState = React.memo(function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  styles = createStyles();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textMuted} />
      <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>{title}</Text>
      {subtitle ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
});

export const Spinner = React.memo(function Spinner({ label }: { label?: string }) {
  styles = createStyles();
  return (
    <View style={styles.spinner}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>{label}</Text> : null}
    </View>
  );
});

export const Badge = React.memo(function Badge({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  styles = createStyles();
  return (
    <View style={[styles.badge, { backgroundColor: bg || colors.surfaceAlt }]}>
      <Text style={[typography.caption, { color: color || colors.textSecondary, fontWeight: '600' }]}>{text}</Text>
    </View>
  );
});

/**
 * Bottom-sheet surface + grab handle, so every modal shares one geometry and
 * one drag affordance (spatial consistency — §7/§12).
 */
export function SheetHandle() {
  styles = createStyles();
  return <View style={styles.sheetHandle} />;
}

/**
 * Frosty-glass panel with a light-catching top edge (no native blur required).
 */
export function Glass({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  styles = createStyles();
  const fx = useSettings((s) => s.visualFx.glass);
  return (
    <View style={[styles.glass, fx && Platform.OS === 'web' && FROST, style]}>
      <View style={styles.glassEdge} />
      {children}
    </View>
  );
}

export function Sheet({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  styles = createStyles();
  const animFx = useSettings((s) => s.visualFx.animations);
  const glassFx = useSettings((s) => s.visualFx.glass);
  const y = useRef(new Animated.Value(animFx ? 0 : 1)).current;
  useEffect(() => {
    if (!animFx) {
      y.setValue(1);
      return;
    }
    const anim = Animated.spring(y, { toValue: 1, useNativeDriver: true, ...motion.spring });
    anim.start();
    return () => anim.stop();
  }, [y, animFx]);
  return (
    <Animated.View
      style={[
        styles.sheet,
        !glassFx && { backgroundColor: colors.surface },
        glassFx && Platform.OS === 'web' && FROST,
        style,
        {
          opacity: y,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        },
      ]}
    >
      {glassFx && <View style={styles.sheetEdge} />}
      <SheetHandle />
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGlass: {
    backgroundColor: isDarkMode() ? glass.dark : glass.light,
    borderColor: glass.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  field: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.sm,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonSmall: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  iconButton: {
    padding: spacing.xs,
  },
  progressTrack: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  spinner: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  sheet: {
    backgroundColor: isDarkMode() ? glass.dark : glass.light,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
    ...shadow.float,
  },
  sheetEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: glass.highlight,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  glass: {
    backgroundColor: isDarkMode() ? glass.dark : glass.light,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  glassEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: glass.highlight,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  });
}

