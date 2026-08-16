/**
 * Event editor modal — create/edit/delete calendar events, including
 * recurrence and reminders. Used by the Calendar screen.
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLifeOS } from '../data/store';
import { themedStyles, colors, spacing, typography  } from '../theme';
import { Button, Chip, ChipRow, Field, TextBox, Sheet } from './ui';
import { ReminderPicker, ReminderOffset } from './reminderPicker';
import { DateField, RecurrenceField, TimeField, splitDateTime } from './form';
import { Recurrence } from '../core/types';
import { useT } from '../i18n';
import { modalAnimationType } from '../data/settings';

const EVENT_COLORS = ['#4F46E5', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#64748B'];

export function EventEditorModal({
  eventId,
  visible,
  onClose,
  initialDate,
}: {
  /** null/undefined = create new. */
  eventId?: string | null;
  visible: boolean;
  onClose: () => void;
  /** Default date for new events (YYYY-MM-DD), e.g. the calendar day in view. */
  initialDate?: string;
}) {
  styles = createStyles();
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const t = useT();

  const editing = eventId ? data.collections.events.find((e) => e.id === eventId && !e.deletedAt) : undefined;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [notes, setNotes] = useState('');
  const [reminders, setReminders] = useState<ReminderOffset[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title);
      const { date: d, time: t } = splitDateTime(editing.startAt);
      setDate(d);
      setTime(t);
      setAllDay(!!editing.allDay);
      const { date: ed, time: et } = splitDateTime(editing.endAt);
      setEndDate(ed);
      setEndTime(et);
      setRecurrence(editing.recurrence || null);
      setColor(editing.color || EVENT_COLORS[0]);
      setNotes(editing.notes || '');
      // Migrate the legacy single offset into the reminders list.
      const legacy = editing.reminderOffsetMin != null ? [{ id: `${editing.id}:rem`, offsetMin: editing.reminderOffsetMin }] : [];
      setReminders(editing.reminders && editing.reminders.length > 0 ? editing.reminders : legacy);
    } else {
      const today = new Date();
      setTitle('');
      setDate(initialDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
      setTime('');
      setAllDay(false);
      setEndDate('');
      setEndTime('');
      setRecurrence(null);
      setColor(EVENT_COLORS[0]);
      setNotes('');
      setReminders([]);
    }
  }, [visible, editing, initialDate]);

  const buildStart = (): string => {
    if (!date) return '';
    if (allDay) return date;
    const t = time || '09:00';
    return `${date}T${t}`;
  };

  const save = () => {
    if (!title.trim() || !date) return;
    const startAt = buildStart();
    // End day defaults to the start day when only an end time is given, so
    // same-day events can set a start + end time (e.g. 12:30–14:00).
    const endDay = endDate || (endTime ? date : '');
    const endAt = endDay ? (allDay ? endDay : `${endDay}T${endTime || time || '10:00'}`) : null;
    const payload = {
      title: title.trim(),
      startAt,
      endAt,
      allDay,
      recurrence,
      color,
      notes: notes.trim() || undefined,
      reminders: reminders.length > 0 ? reminders : null,
      reminderOffsetMin: null,
    };
    if (editing) {
      update('events', editing.id, payload);
    } else {
      create('events', payload);
    }
    onClose();
  };

  const del = () => {
    if (editing) {
      remove('events', editing.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType={modalAnimationType()} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <Sheet style={{ maxHeight: '88%' }}>
          <Text style={styles.title}>{editing ? t('editEvent') : t('newEvent')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label={t('title')}>
              <TextBox value={title} onChangeText={setTitle} placeholder={t('eventTitle')} autoFocus={!editing} />
            </Field>
            <DateField value={date} onChange={setDate} />
            <Field label={t('allDay')}>
              <ChipRow>
                <Chip label={t('allDay')} selected={allDay} onPress={() => setAllDay((v) => !v)} />
              </ChipRow>
            </Field>
            {!allDay && <TimeField value={time} onChange={setTime} />}
            {!allDay && <TimeField label={t('endTime')} value={endTime} onChange={setEndTime} />}
            <DateField label={t('endDateOpt')} value={endDate} onChange={setEndDate} />
            <RecurrenceField value={recurrence} onChange={setRecurrence} />
            <Field label={t('color')}>
              <ChipRow>
                {EVENT_COLORS.map((c) => (
                  <PressableDot key={c} color={c} selected={color === c} onPress={() => setColor(c)} />
                ))}
              </ChipRow>
            </Field>
            <Field label={t('remindBefore')}>
              <ReminderPicker reminders={reminders} onChange={setReminders} />
            </Field>
            <Field label={t('taskNotes')}>
              <TextBox value={notes} onChangeText={setNotes} placeholder={t('optional')} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
            </Field>
            <View style={styles.actions}>
              {editing && <Button title={t('delete')} variant="danger" onPress={del} style={{ flex: 1 }} />}
              <Button title={t('cancel')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Sheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PressableDot({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  styles = createStyles();
  return (
    <PressableDotInner selected={selected} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: color }, selected && styles.dotSelected]} />
    </PressableDotInner>
  );
}

function PressableDotInner({ children, selected, onPress }: { children: React.ReactNode; selected: boolean; onPress: () => void }) {
  styles = createStyles();
  return (
    <Pressable onPress={onPress} style={[styles.dotWrap, selected && { borderColor: colors.text }]}>
      {children}
    </Pressable>
  );
}


const createStyles = themedStyles(() => {
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  title: { ...typography.title, marginBottom: spacing.lg },
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
  dotSelected: { transform: [{ scale: 0.85 }] },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  });
});

let styles = createStyles();

