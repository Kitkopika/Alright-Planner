/**
 * Add-a-reminder modal — create a standalone reminder (title + date + time +
 * optional repeat) right from the Reminders page.
 */

import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useLifeOS } from '../data/store';
import { Recurrence } from '../core/types';
import { todayKey, timeHM } from '../core/time';
import { spacing, typography } from '../theme';
import { Button, Field, TextBox, Sheet } from './ui';
import { DateField, TimeField, RecurrenceField, combineDateTime } from './form';
import { useT } from '../i18n';

export function ReminderEditorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  const create = useLifeOS((s) => s.create);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState(timeHM(new Date(Date.now() + 60 * 60 * 1000)));
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDate(todayKey());
      setTime(timeHM(new Date(Date.now() + 60 * 60 * 1000)));
      setRecurrence(null);
    }
  }, [visible]);

  const save = () => {
    if (title.trim() === '') return;
    create('reminders', { title: title.trim(), remindAt: combineDateTime(date, time), recurrence, status: 'pending' });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Sheet>
          <Text style={[typography.title, { marginBottom: spacing.md }]}>{t('addReminder')}</Text>
          <Field label={t('title')}>
            <TextBox value={title} onChangeText={setTitle} placeholder={t('remindMeTo')} autoFocus />
          </Field>
          <DateField value={date} onChange={setDate} />
          <TimeField value={time} onChange={setTime} />
          <RecurrenceField value={recurrence} onChange={setRecurrence} />
          <View style={styles.actions}>
            <Button title={t('cancel')} variant="ghost" onPress={onClose} />
            <Button title={t('save')} onPress={save} disabled={title.trim() === ''} />
          </View>
        </Sheet>
      </View>
    </Modal>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  });
}
