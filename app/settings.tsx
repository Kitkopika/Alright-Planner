/**
 * Settings — appearance (dark/light/system + accent themes), language
 * (English/ไทย), currency, and Data & Backup (moved here from Today).
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSettings, Currency } from '../src/data/settings';
import { useT } from '../src/i18n';
import { colors, radius, spacing, typography } from '../src/theme';
import { Button, Card, Chip, ChipRow, SectionHeader } from '../src/components/ui';

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
        <Text style={[typography.caption, { marginTop: spacing.xs }]}>{t('version')} 1.1.0</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
          Local-first. Your data never leaves this device.
        </Text>
      </Card>
      </ScrollView>
      <ColorWheelModal visible={colorWheelOpen} onClose={() => setColorWheelOpen(false)} />
    </View>
  );
}

function PressableDot({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  styles = createStyles();
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

/**
 * Rainbow hue ring. Tapping a segment applies that hue as the accent and calls
 * `onPick`; the center circle always shows the current custom color.
 */
function CustomColorPanel({ onPick }: { onPick: () => void }) {
  styles = createStyles();
  const settings = useSettings();
  const t = useT();

  const size = 220;
  const cx = size / 2;
  const cy = cx;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.62;
  const centerR = innerR - 5;

  const pick = (hue: number) => {
    settings.setAccent(hslToHex(hue, 100, 50));
    onPick();
  };

  return (
    <View style={styles.wheelWrap}>
      <Svg width={size} height={size}>
        {rainbowRingParts(cx, cy, outerR, innerR, 36, 90, pick)}
        <Circle cx={cx} cy={cy} r={centerR} fill={settings.accent} stroke={colors.border} strokeWidth={2} />
      </Svg>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>{t('customColorHint')}</Text>
    </View>
  );
}

/** Overlay with the rainbow color wheel, opened from the accent-color row. */
function ColorWheelModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.wheelBackdrop} onPress={onClose}>
        <Pressable style={styles.wheelCard} onPress={() => {}}>
          <Text style={styles.wheelTitle}>{t('customColor')}</Text>
          <CustomColorPanel onPick={onClose} />
          <View style={styles.wheelFooter}>
            <Button title={t('close')} variant="ghost" small onPress={onClose} />
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
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  wheelWrap: { alignItems: 'center', marginTop: spacing.xs },
  wheelBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  wheelCard: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  wheelTitle: { ...typography.section, marginBottom: spacing.md },
  wheelFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignSelf: 'stretch', marginTop: spacing.md },
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

