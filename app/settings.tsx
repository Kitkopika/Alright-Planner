/**
 * Settings — appearance (dark/light/system + accent themes), language
 * (English/ไทย), currency, and Data & Backup (moved here from Today).
 */

import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSettings, Currency } from '../src/data/settings';
import { useT } from '../src/i18n';
import { colors, radius, spacing, typography } from '../src/theme';
import { Button, Card, Chip, ChipRow, SectionHeader } from '../src/components/ui';
import { useSvgId } from '../src/components/motion';

const ACCENTS = ['#4F46E5', '#7C3AED', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#DB2777', '#0F766E'];

export default function SettingsScreen() {
  styles = createStyles();
  const router = useRouter();
  const t = useT();
  const settings = useSettings();
  const [colorWheelOpen, setColorWheelOpen] = useState(false);

  return (
    <View style={styles.screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {/* Appearance */}
      <SectionHeader title={t('appearance')} />
      <Card>
        <Text style={styles.cardLabel}>{t('theme')}</Text>
        <ChipRow>
          {(['light', 'dark', 'system'] as const).map((m) => (
            <Chip
              key={m}
              label={m === 'light' ? t('lightMode') : m === 'dark' ? t('darkMode') : t('systemMode')}
              selected={settings.theme === m}
              onPress={() => settings.setTheme(m)}
            />
          ))}
        </ChipRow>

        <Text style={[styles.cardLabel, { marginTop: spacing.lg }]}>{t('accentColor')}</Text>
        <View style={styles.swatchRow}>
          {ACCENTS.map((c) => (
            <PressableDot key={c} color={c} selected={settings.accent === c} onPress={() => settings.setAccent(c)} />
          ))}
          <RainbowDot selected={!ACCENTS.includes(settings.accent)} onPress={() => setColorWheelOpen(true)} />
        </View>
      </Card>

      {/* Language */}
      <SectionHeader title={t('language')} />
      <Card>
        <ChipRow>
          <Chip label="English" selected={settings.language === 'en'} onPress={() => settings.setLanguage('en')} />
          <Chip label="ไทย" selected={settings.language === 'th'} onPress={() => settings.setLanguage('th')} />
        </ChipRow>
      </Card>

      {/* Currency */}
      <SectionHeader title={t('currency')} />
      <Card>
        <ChipRow>
          {(['THB', 'USD'] as Currency[]).map((c) => (
            <Chip key={c} label={c === 'THB' ? '฿ Thai Baht' : '$ US Dollar'} selected={settings.currency === c} onPress={() => settings.setCurrency(c)} />
          ))}
        </ChipRow>
      </Card>

      {/* Beta */}
      <SectionHeader title={t('beta')} />
      <Card>
        <FxToggle label={t('fxAnimations')} value={settings.visualFx.animations} onChange={(v) => settings.setVisualFx({ animations: v })} />
        <FxToggle label={t('fxBackground')} value={settings.visualFx.background} onChange={(v) => settings.setVisualFx({ background: v })} />
        <FxToggle label={t('fxLighting')} value={settings.visualFx.lighting} onChange={(v) => settings.setVisualFx({ lighting: v })} />
        <FxToggle label={t('fxGlass')} value={settings.visualFx.glass} onChange={(v) => settings.setVisualFx({ glass: v })} />
        <FxToggle label={t('fxGradients')} value={settings.visualFx.gradients} onChange={(v) => settings.setVisualFx({ gradients: v })} />
      </Card>

      {/* Data & Backup */}
      <SectionHeader title={t('dataBackup')} />
      <Card>
        <Text style={typography.caption}>
          Export everything to a portable JSON file, import from another device, restore the on-device backup, or erase all data.
        </Text>
        <Button title={t('dataBackup')} onPress={() => router.push('/data')} style={{ marginTop: spacing.sm }} />
      </Card>

      {/* About */}
      <SectionHeader title={t('about')} />
      <Card>
        <Text style={typography.body}>{t('appName')}</Text>
        <Text style={[typography.caption, { marginTop: spacing.xs }]}>{t('version')} 2.0.0</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          Local-first. Your data never leaves this device.
        </Text>
      </Card>
      </ScrollView>
      <ColorWheelModal visible={colorWheelOpen} onClose={() => setColorWheelOpen(false)} />
    </View>
  );
}

function FxToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  styles = createStyles();
  const t = useT();
  return (
    <View style={styles.fxRow}>
      <Text style={[typography.body, { flex: 1 }]}>{label}</Text>
      <ChipRow>
        <Chip label={t('on')} selected={value} onPress={() => onChange(true)} />
        <Chip label={t('off')} selected={!value} onPress={() => onChange(false)} />
      </ChipRow>
    </View>
  );
}

function PressableDot({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {  styles = createStyles();
  return (
    <Pressable onPress={onPress} style={[styles.dotWrap, selected && { borderColor: colors.text }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </Pressable>
  );
}

/** HSL (h: 0-360, s/l: 0-100) → "#RRGGBB". */
function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs((2 * l) / 100 - 1)) * (s / 100);
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (val: number) => Math.round((val + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / d + 2) * 60;
    else hue = ((r - g) / d + 4) * 60;
  }
  return { h: hue, s: max === 0 ? 0 : d / max, v: max };
}

/** Annular rainbow-ring SVG segments (hueOffset shifts the start hue in degrees). When onPressSegment is given, each segment becomes its own tappable target reporting its hue. */
function rainbowRingParts(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  segments: number,
  hueOffset = 0,
  onPressSegment?: (hue: number) => void
) {
  const parts = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * 2 * Math.PI;
    const a1 = ((i + 1) / segments) * 2 * Math.PI;
    const pt = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x0, y0] = pt(outerR, a0);
    const [x1, y1] = pt(outerR, a1);
    const [x2, y2] = pt(innerR, a1);
    const [x3, y3] = pt(innerR, a0);
    const hue = ((i + 0.5) / segments) * 360 + hueOffset;
    parts.push(
      <Path
        key={i}
        d={`M ${x0} ${y0} A ${outerR} ${outerR} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${innerR} ${innerR} 0 0 0 ${x3} ${y3} Z`}
        fill={hslToHex(hue, 100, 50)}
        onPress={onPressSegment ? () => onPressSegment(hue) : undefined}
      />
    );
  }
  return parts;
}

/** Small rainbow swatch shown in the accent-color row; opens the color wheel. */
function RainbowDot({ selected, onPress }: { selected: boolean; onPress: () => void }) {
  styles = createStyles();
  const t = useT();
  const size = 30;
  const cx = size / 2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('customColor')}
      style={[styles.dotWrap, selected && { borderColor: colors.text }]}
    >
      <Svg width={size} height={size}>
        {rainbowRingParts(cx, cx, size / 2 - 1, size / 2 - 7, 12)}
      </Svg>
    </Pressable>
  );
}

/** Saturation/value square — the standard color-picker surface. */
function SVSquare({ hue, sat, val, onChange }: { hue: number; sat: number; val: number; onChange: (s: number, v: number) => void }) {
  const id = useSvgId('sv');
  const [size, setSize] = useState(1);
  const sizeRef = useRef(1);
  const applyEvent = (e: GestureResponderEvent) => {
    const sz = sizeRef.current;
    if (sz <= 0) return;
    const ne = e.nativeEvent as unknown as { locationX?: number; locationY?: number };
    if (typeof ne.locationX !== 'number' || typeof ne.locationY !== 'number') return;
    const s = Math.max(0, Math.min(1, ne.locationX / sz));
    const v = Math.max(0, Math.min(1, 1 - ne.locationY / sz));
    onChange(s, v);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => applyEvent(e),
      onPanResponderMove: (e) => applyEvent(e),
    })
  ).current;
  return (
    <View
      style={styles.svSquare}
      onLayout={(e) => {
        sizeRef.current = e.nativeEvent.layout.width;
        setSize(e.nativeEvent.layout.width);
      }}
      {...pan.panHandlers}
    >
      {size > 1 && (
        <Svg width={size} height={size} pointerEvents="none">
          <Defs>
            <LinearGradient id={`${id}-sat`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={`${id}-val`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width={size} height={size} fill={hsvToHex(hue, 1, 1)} />
          <Rect width={size} height={size} fill={`url(#${id}-sat)`} />
          <Rect width={size} height={size} fill={`url(#${id}-val)`} />
        </Svg>
      )}
      <View pointerEvents="none" style={[styles.svThumb, { left: sat * size - 7, top: (1 - val) * size - 7 }]} />
    </View>
  );
}

/** Horizontal hue slider. */
function HueSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const id = useSvgId('hue');
  const [w, setW] = useState(1);
  const wRef = useRef(1);
  const applyEvent = (e: GestureResponderEvent) => {
    const width = wRef.current;
    if (width <= 0) return;
    const ne = e.nativeEvent as unknown as { locationX?: number };
    if (typeof ne.locationX !== 'number') return;
    onChange(Math.max(0, Math.min(360, (ne.locationX / width) * 360)));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => applyEvent(e),
      onPanResponderMove: (e) => applyEvent(e),
    })
  ).current;
  return (
    <View
      style={styles.hueBar}
      onLayout={(e) => {
        wRef.current = e.nativeEvent.layout.width;
        setW(e.nativeEvent.layout.width);
      }}
      {...pan.panHandlers}
    >
      {w > 1 && (
        <Svg width={w} height={18} pointerEvents="none">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FF0000" />
              <Stop offset="0.17" stopColor="#FFFF00" />
              <Stop offset="0.33" stopColor="#00FF00" />
              <Stop offset="0.5" stopColor="#00FFFF" />
              <Stop offset="0.67" stopColor="#0000FF" />
              <Stop offset="0.83" stopColor="#FF00FF" />
              <Stop offset="1" stopColor="#FF0000" />
            </LinearGradient>
          </Defs>
          <Rect width={w} height={18} rx={9} fill={`url(#${id})`} />
        </Svg>
      )}
      <View pointerEvents="none" style={[styles.hueThumb, { left: (hue / 360) * w - 8 }]} />
    </View>
  );
}

/** Overlay with the standard square color picker. */
function ColorWheelModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  const settings = useSettings();
  const [hsv, setHsv] = useState(() => hexToHsv(settings.accent));
  useEffect(() => {
    if (visible) setHsv(hexToHsv(settings.accent));
  }, [visible, settings.accent]);
  const color = hsvToHex(hsv.h, hsv.s, hsv.v);
  const apply = () => {
    settings.setAccent(color);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.wheelBackdrop} onPress={onClose}>
        <Pressable style={styles.wheelCard} onPress={() => {}}>
          <Text style={styles.wheelTitle}>{t('customColor')}</Text>
          <SVSquare hue={hsv.h} sat={hsv.s} val={hsv.v} onChange={(s, v) => setHsv((p) => ({ ...p, s, v }))} />
          <HueSlider hue={hsv.h} onChange={(h) => setHsv((p) => ({ ...p, h }))} />
          <View style={styles.hsvPreview}>
            <View style={[styles.hsvSwatch, { backgroundColor: color }]} />
            <Text style={typography.caption}>{color}</Text>
          </View>
          <View style={styles.wheelFooter}>
            <Button title={t('cancel')} variant="ghost" small onPress={onClose} />
            <Button title={t('save')} small onPress={apply} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  cardLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  fxRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  wheelWrap: { alignItems: 'center', marginTop: spacing.xs },
  wheelBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  wheelCard: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  wheelTitle: { ...typography.section, marginBottom: spacing.md },
  wheelFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignSelf: 'stretch', marginTop: spacing.md },
  svSquare: { width: '100%', aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', marginTop: spacing.xs },
  svThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  hueBar: { width: '100%', height: 18, marginTop: spacing.md, borderRadius: radius.pill, overflow: 'hidden' },
  hueThumb: { position: 'absolute', top: 1, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  hsvPreview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, alignSelf: 'stretch' },
  hsvSwatch: { width: 28, height: 28, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  dotWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 24, height: 24, borderRadius: 12 },
  });
}

