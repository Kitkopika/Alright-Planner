/**
 * Tiny dependency-free charts (vertical bars + horizontal bars) for Insights,
 * plus an SVG donut for spending breakdowns.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../theme';
import { useSvgId } from './motion';

/**
 * Smooth line + area chart (7-day trends). Supports a signed series (zero
 * baseline in the middle) for money, or an unsigned one (baseline at bottom).
 */
export function TrendChart({
  values,
  labels,
  color,
  max,
  height,
  showLabels,
  signed = false,
}: {
  values: number[];
  labels?: string[];
  color: string;
  max: number;
  height: number;
  showLabels?: boolean;
  signed?: boolean;
}) {
  const id = useSvgId('trend');
  const [w, setW] = useState(0);
  const labelH = showLabels ? 16 : 0;
  const usable = Math.max(height - labelH, 8);
  const n = values.length;
  const maxAbs = Math.max(max, 0.0001);
  const pad = 3;
  const step = n > 1 ? (w - pad * 2) / (n - 1) : w;
  const yFor = (v: number) =>
    signed
      ? usable / 2 - (v / maxAbs) * (usable / 2 - pad)
      : usable - pad - (v / maxAbs) * (usable - pad * 2);
  const pts = values.map((v, i) => ({ x: pad + i * step, y: Math.max(pad, Math.min(usable - pad, yFor(v))) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const zeroY = signed ? usable / 2 : usable - pad;
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${zeroY} L${pts[0].x.toFixed(1)},${zeroY} Z`;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={usable}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.32} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {signed && <Line x1={0} y1={zeroY} x2={w} y2={zeroY} stroke={colors.border} strokeWidth={1} />}
          <Path d={area} fill={`url(#${id})`} />
          <Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      )}
      {showLabels && labels && (
        <View style={{ flexDirection: 'row', marginTop: 2 }}>
          {labels.map((l, i) => (
            <Text
              key={i}
              style={[typography.caption, { flex: 1, textAlign: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center', fontSize: 10, color: colors.textMuted }]}
              numberOfLines={1}
            >
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

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
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
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

