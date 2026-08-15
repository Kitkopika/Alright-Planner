/**
 * Reminder offsets picker — tap a preset chip to add a "remind me X before"
 * reminder; each added reminder is listed with a remove button. Supports
 * multiple reminders per event/task.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../theme';
import { Chip, ChipRow } from './ui';
import { TKey, useT } from '../i18n';
import { newId } from '../core/id';

export interface ReminderOffset {
  id: string;
  offsetMin: number;
}

const PRESETS: { offsetMin: number; tKey: TKey }[] = [
  { offsetMin: 1440, tKey: 'reminder1d' },
  { offsetMin: 2880, tKey: 'reminder2d' },
  { offsetMin: 4320, tKey: 'reminder3d' },
  { offsetMin: 120, tKey: 'reminder2h' },
  { offsetMin: 20, tKey: 'reminder20m' },
];

export function reminderLabel(offsetMin: number, t: (k: TKey) => string): string {
  const preset = PRESETS.find((p) => p.offsetMin === offsetMin);
  if (preset) return t(preset.tKey);
  return `${offsetMin} ${t('minShort')}`;
}

export function ReminderPicker({ reminders, onChange }: { reminders: ReminderOffset[]; onChange: (r: ReminderOffset[]) => void }) {
  styles = createStyles();
  const t = useT();
  const add = (offsetMin: number) => {
    if (reminders.some((r) => r.offsetMin === offsetMin)) return;
    onChange([...reminders, { id: newId(), offsetMin }]);
  };
  const remove = (id: string) => onChange(reminders.filter((r) => r.id !== id));

  return (
    <View>
      <ChipRow>
        {PRESETS.map((p) => (
          <Chip key={p.offsetMin} label={t(p.tKey)} selected={reminders.some((r) => r.offsetMin === p.offsetMin)} onPress={() => add(p.offsetMin)} />
        ))}
      </ChipRow>
      {reminders.length > 0 && (
        <View style={styles.list}>
          {reminders.map((r) => (
            <View key={r.id} style={styles.row}>
              <Ionicons name="alarm-outline" size={14} color={colors.textSecondary} />
              <Text style={[typography.body, { flex: 1, fontSize: 13 }]}>{reminderLabel(r.offsetMin, t)}</Text>
              <Pressable onPress={() => remove(r.id)} hitSlop={8}>
                <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  list: { marginTop: spacing.sm, gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  });
}
