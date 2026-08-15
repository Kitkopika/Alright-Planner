/**
 * Tiny dependency-free charts (vertical bars + horizontal bars) for Insights,
 * plus an SVG donut for spending breakdowns.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../theme';

/** Segmented donut chart (spending by category). */
export function DonutChart({
  data,
  size = 130,
  strokeWidth = 20,
  centerLabel,
}: {
  data: { value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
}) {
  styles = createStyles();
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={strokeWidth} fill="none" />
        {total > 0 &&
          data.map((seg, i) => {
            const len = (seg.value / total) * C;
            const offset = acc;
            acc += len;
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
              />
            );
          })}
      </Svg>
      {centerLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.donutCenter]}>
          <Text style={styles.donutLabel} numberOfLines={2}>{centerLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

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
  styles = createStyles();
  return (
    <View style={styles.vWrap}>
      <View style={[styles.vRow, { height }]}>
        {values.map((v, i) => {
  styles = createStyles();
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
  styles = createStyles();
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

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
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
  donutCenter: { alignItems: 'center', justifyContent: 'center' },
  donutLabel: { ...typography.label, color: colors.text, textAlign: 'center' },
  });
}

