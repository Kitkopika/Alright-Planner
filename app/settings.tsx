/**
 * Settings — appearance (dark/light/system + accent themes), language
 * (English/ไทย), currency, and Data & Backup (moved here from Today).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  cardLabel: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.sm },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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

