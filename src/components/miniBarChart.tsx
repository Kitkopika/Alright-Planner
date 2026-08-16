/**
 * Mini bar chart for the Today-screen chart widgets. Values are normalized to
 * `max`; each bar is colored via `colorFor`. Labels are shown underneath when
 * `showLabels` is set.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

export interface MiniBarChartProps {
  values: number[];
  labels?: string[];
  max: number;
  /** Per-bar color (or a function of the value). */
  color: string | ((value: number) => string);
  /** Chart area height (bars only, labels are extra). */
  height: number;
  showLabels?: boolean;
  showZeroBaseline?: boolean;
}

export function MiniBarChart({ values, labels, max, color, height, showLabels, showZeroBaseline }: MiniBarChartProps) {
  const barMax = Math.max(max, 0.0001);
  const labelH = showLabels ? 14 : 0;
  const usable = Math.max(height - labelH, 8);
  return (
    <View>
      <View style={{ height: usable, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        {values.map((v, i) => {
          const ratio = Math.min(Math.abs(v) / barMax, 1);
          const c = typeof color === 'function' ? color(v) : color;
          const isNeg = v < 0;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: usable }}>
              <View
                style={{
                  width: '70%',
                  height: Math.max(ratio * usable, 2),
                  borderRadius: radius.sm,
                  backgroundColor: isNeg ? (typeof color === 'function' ? c : colors.danger) : c,
                }}
              />
            </View>
          );
        })}
      </View>
      {showZeroBaseline && <View style={styles.baseline} />}
      {showLabels && labels && (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
          {labels.map((l, i) => (
            <Text key={i} style={[typography.caption, styles.label]} numberOfLines={1}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  baseline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 2 },
  label: { flex: 1, textAlign: 'center', fontSize: 10, color: colors.textMuted },
  });
}
