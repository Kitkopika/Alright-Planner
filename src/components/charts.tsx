/**
 * Tiny dependency-free charts (vertical bars + horizontal bars) for Insights.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

/** Vertical bars. `values` are normalized by `max` (0 -> full height). */
export function VBars({
  values,
  max,
  color = colors.accent,
  height = 64,
  labels,
}: {
  values: number[];
  max: number;
  color?: string;
  height?: number;
  /** Optional short label under each bar (e.g. day-of-month). */
  labels?: string[];
}) {
  return (
    <View style={styles.vWrap}>
      <View style={[styles.vRow, { height }]}>
        {values.map((v, i) => {
          const h = max > 0 ? Math.max(2, (v / max) * height) : 2;
          return <View key={i} style={[styles.vBar, { height: h, backgroundColor: v > 0 ? color : colors.surfaceAlt }]} />;
        })}
      </View>
      {labels ? (
        <View style={styles.vLabels}>
          {labels.map((l, i) => (
            <Text key={i} style={styles.vLabel}>{l}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Horizontal bars with labels and amounts (e.g. spending by category). */
export function HBars({
  rows,
}: {
  rows: { label: string; value: number; color?: string; valueText?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={styles.hWrap}>
      {rows.map((r, i) => (
        <View key={i} style={styles.hRow}>
          <View style={styles.hHead}>
            <Text style={styles.hLabel} numberOfLines={1}>{r.label}</Text>
            <Text style={styles.hValue}>{r.valueText ?? String(r.value)}</Text>
          </View>
          <View style={styles.hTrack}>
            <View style={[styles.hFill, { width: `${(r.value / max) * 100}%`, backgroundColor: r.color || colors.accent }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vWrap: { marginTop: spacing.sm },
  vRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  vBar: { flex: 1, borderRadius: radius.sm, minHeight: 2 },
  vLabels: { flexDirection: 'row', gap: 2, marginTop: 4 },
  vLabel: { flex: 1, textAlign: 'center', fontSize: 8, color: colors.textMuted },
  hWrap: { marginTop: spacing.sm, gap: spacing.sm },
  hRow: {},
  hHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  hLabel: { ...typography.caption, color: colors.textSecondary, flex: 1, marginRight: spacing.sm },
  hValue: { ...typography.caption, color: colors.text, fontWeight: '600' },
  hTrack: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' },
  hFill: { height: 6, borderRadius: radius.pill },
});
