/**
 * Small shared UI kit — no third-party component library, just consistent
 * primitives over react-native.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';

// ---------------------------------------------------------------------------

export function Card({
  children,
  style,
  onPress,
  onLongPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  styles = createStyles();
  const inner = <View style={[styles.card, style]}>{children}</View>;
  if (onPress || onLongPress) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export function SectionHeader({ title, right, style }: { title: string; right?: React.ReactNode; style?: ViewStyle }) {
  styles = createStyles();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={typography.section}>{title}</Text>
      {right}
    </View>
  );
}

export function Chip({
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: color || colors.accent, borderColor: color || colors.accent },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text style={[styles.chipLabel, selected && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === 'ghost' && styles.buttonGhost,
        small && styles.buttonSmall,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: fg }, small && { fontSize: 13 }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }, style]}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function ProgressBar({ pct, color, height = 6, style }: { pct: number; color?: string; height?: number; style?: ViewStyle }) {
  styles = createStyles();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.progressTrack, { height }, style]}>
      <View
        style={[
          styles.progressFill,
          {
            width: `${clamped}%`,
            height,
            backgroundColor: color || colors.accent,
          },
        ]}
      />
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  styles = createStyles();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textMuted} />
      <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.sm }]}>{title}</Text>
      {subtitle ? <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Spinner({ label }: { label?: string }) {
  styles = createStyles();
  return (
    <View style={styles.spinner}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>{label}</Text> : null}
    </View>
  );
}

export function Badge({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  styles = createStyles();
  return (
    <View style={[styles.badge, { backgroundColor: bg || colors.surfaceAlt }]}>
      <Text style={[typography.caption, { color: color || colors.textSecondary, fontWeight: '600' }]}>{text}</Text>
    </View>
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
  });
}

