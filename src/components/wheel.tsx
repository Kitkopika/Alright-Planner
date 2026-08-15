/**
 * Shared infinite-loop wheel picker — two scrollable columns (e.g. hours and
 * minutes) with live selection, snapping, tap-to-select and endless scrolling.
 * Used by the focus duration picker and the time picker (HH:mm).
 *
 * Each column renders 3 copies of its values and instantly jumps back into the
 * middle copy when scrolling drifts into the buffer copies, so the wheel never
 * ends. The highlight bar is drawn behind the columns so the text stays visible.
 */

import React, { useEffect, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { useT } from '../i18n';

export const WHEEL_ITEM = 40; // px per row in the wheel columns

/** Single scrollable wheel column with infinite looping. */
export function WheelColumn({ values, selected, onSelect }: { values: number[]; selected: number; onSelect: (v: number) => void }) {
  styles = createStyles();
  const N = values.length;
  const ref = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const lastReportedRef = useRef(-1);
  const firstRenderRef = useRef(true);
  // True when a selection change came from this wheel (scroll/tap) — the
  // "follow selection" effect must not scroll back against the user's finger.
  const selfChangeRef = useRef(false);
  // True while a programmatic scrollTo animation is running — live reporting
  // must not fire with intermediate values during that animation.
  const programmaticRef = useRef(false);

  // Global index of a value, placed in the middle copy (the "real" position).
  const baseIndex = (v: number) => {
    const idx = values.indexOf(v);
    return N + (idx >= 0 ? idx : 0);
  };

  const scrollToIndex = (g: number, animated: boolean) => {
    programmaticRef.current = true;
    ref.current?.scrollTo({ y: g * WHEEL_ITEM, animated });
    if (animated) {
      setTimeout(() => {
        programmaticRef.current = false;
      }, 400);
    } else {
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    }
  };

  // Wrap the global index back into the middle copy (infinite loop).
  const normalize = (g: number) => {
    if (g < N) return g + N;
    if (g >= 2 * N) return g - N;
    return g;
  };

  const report = (g: number) => {
    const wrapped = ((g % N) + N) % N;
    if (wrapped !== lastReportedRef.current) {
      lastReportedRef.current = wrapped;
      if (values[wrapped] !== selected) {
        selfChangeRef.current = true;
        onSelect(values[wrapped]);
      }
    }
  };

  // Align the current selection when the picker first appears (deferred until
  // the modal's slide-in layout is done, otherwise scrollTo is a no-op).
  useEffect(() => {
    const timer = setTimeout(() => scrollToIndex(baseIndex(selected), false), 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external changes (preset chips, programmatic duration changes) —
  // but not changes that originated from this wheel's own scroll/tap.
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (selfChangeRef.current) {
      selfChangeRef.current = false;
      return;
    }
    scrollToIndex(baseIndex(selected), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Snap to the nearest item after a scroll settles.
  const snap = () => {
    const g = normalize(Math.round(offsetRef.current / WHEEL_ITEM));
    scrollToIndex(g, false);
    report(g);
  };

  // Tapping a value always works, even where drag-scrolling is unavailable.
  const pick = (v: number) => {
    scrollToIndex(baseIndex(v), false);
    selfChangeRef.current = true;
    onSelect(v);
  };

  // Live selection while scrolling (like an iOS wheel), wrapping at the ends.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    offsetRef.current = y;
    if (programmaticRef.current) return;
    const g = Math.round(y / WHEEL_ITEM);
    if (g < N || g >= 2 * N) {
      // Drifted into a buffer copy — jump back into the middle copy.
      const next = normalize(g);
      scrollToIndex(next, false);
      offsetRef.current = next * WHEEL_ITEM;
      report(next);
      return;
    }
    report(g);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ height: WHEEL_ITEM * 4, width: 64 }}
      contentContainerStyle={{ paddingVertical: WHEEL_ITEM * 1.5 }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={snap}
      onScrollEndDrag={snap}
    >
      {Array.from({ length: 3 * N }, (_, g) => (
        <Pressable
          key={g}
          onPress={() => pick(values[g % N])}
          style={{ height: WHEEL_ITEM, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={[styles.wheelItem, values[g % N] === selected && styles.wheelItemOn]}>
            {String(values[g % N]).padStart(2, '0')}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Two labelled wheel columns (hours + minutes) sharing one highlight bar. */
export function WheelPicker({
  hourValues,
  minuteValues,
  hour,
  minute,
  onChange,
}: {
  hourValues: number[];
  minuteValues: number[];
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  styles = createStyles();
  const t = useT();
  return (
    <View style={styles.wheelWrap}>
      <View style={styles.wheelLabels}>
        <Text style={styles.wheelLabel}>{t('hour')}</Text>
        <Text style={styles.wheelLabel}>{t('minute')}</Text>
      </View>
      <View style={styles.wheelCols}>
        {/* Rendered first so it sits BEHIND the columns — the selected text
            stays visible above the bar. */}
        <View pointerEvents="none" style={styles.wheelHighlight} />
        <WheelColumn values={hourValues} selected={hour} onSelect={(h) => onChange(h, minute)} />
        <WheelColumn values={minuteValues} selected={minute} onSelect={(m) => onChange(hour, m)} />
      </View>
    </View>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  wheelWrap: { alignItems: 'center', marginVertical: spacing.md },
  wheelLabels: { flexDirection: 'row', gap: spacing.lg, marginBottom: 4 },
  wheelLabel: { width: 64, textAlign: 'center', ...typography.caption, color: colors.textSecondary },
  wheelCols: { flexDirection: 'row', gap: spacing.lg, position: 'relative' },
  wheelItem: { fontSize: 20, fontWeight: '600', color: colors.textMuted },
  wheelItemOn: { color: colors.text, fontWeight: '800' },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: WHEEL_ITEM,
    marginTop: -WHEEL_ITEM / 2,
    backgroundColor: 'rgba(127,127,127,0.15)',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  });
}
