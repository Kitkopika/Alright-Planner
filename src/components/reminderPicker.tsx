/**
 * Reminder offsets picker — set a "remind me X before" offset with a
 * DD:HH:MM wheel (like the time picker), then add it. Supports multiple
 * reminders per event/task, each listed with a remove button.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themedStyles, colors, radius, spacing, typography  } from '../theme';
import { Button } from './ui';
import { WheelPicker3 } from './wheel';
import { TKey, useT } from '../i18n';
import { newId } from '../core/id';

export interface ReminderOffset {
  id: string;
  offsetMin: number;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function reminderLabel(offsetMin: number, t: (k: TKey) => string): string {
  const d = Math.floor(offsetMin / 1440);
  const h = Math.floor((offsetMin % 1440) / 60);
  const m = offsetMin % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}${t('dayShort')}`);
  if (h > 0) parts.push(`${h}${t('hourShort')}`);
  if (m > 0 || parts.length === 0) parts.push(`${m}${t('minShort')}`);
  return parts.join(' ');
}

export function ReminderPicker({ reminders, onChange }: { reminders: ReminderOffset[]; onChange: (r: ReminderOffset[]) => void }) {
  styles = createStyles();
  const t = useT();
  const [day, setDay] = useState(0);
  const [hour, setHour] = useState(0);
  const [min, setMin] = useState(0);
  const total = day * 1440 + hour * 60 + min;

  const add = () => {
    if (total <= 0) return;
    if (reminders.some((r) => r.offsetMin === total)) return;
    onChange([...reminders, { id: newId(), offsetMin: total }]);
    setDay(0);
    setHour(0);
    setMin(0);
  };

  const remove = (id: string) => onChange(reminders.filter((r) => r.id !== id));

  return (
    <View>
      <WheelPicker3
        firstValues={DAYS}
        secondValues={HOURS}
        thirdValues={MINUTES}
        first={day}
        second={hour}
        third={min}
        firstLabel={t('day')}
        secondLabel={t('hour')}
        thirdLabel={t('minute')}
        onChange={(d, h, m) => {
          setDay(d);
          setHour(h);
          setMin(m);
        }}
      />
      <Button title={`+ ${t('remindBefore')}`} small onPress={add} disabled={total <= 0} style={{ marginTop: spacing.sm }} />
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


const createStyles = themedStyles(() => {
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
});

let styles = createStyles();
