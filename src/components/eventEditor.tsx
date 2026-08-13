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
import { colors, radius, spacing, typography } from '../theme';
import { Button, Chip, ChipRow, Field, TextBox } from './ui';
import { DateField, RecurrenceField, TimeField, splitDateTime } from './form';
import { Recurrence } from '../core/types';

const EVENT_COLORS = ['#4F46E5', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#64748B'];

export function EventEditorModal({
  eventId,
  visible,
  onClose,
}: {
  /** null/undefined = create new. */
  eventId?: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);

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
  const [reminderMin, setReminderMin] = useState<string>('');

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
      setReminderMin(editing.reminderOffsetMin != null ? String(editing.reminderOffsetMin) : '');
    } else {
      const today = new Date();
      setTitle('');
      setDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
      setTime('');
      setAllDay(false);
      setEndDate('');
      setEndTime('');
      setRecurrence(null);
      setColor(EVENT_COLORS[0]);
      setNotes('');
      setReminderMin('');
    }
  }, [visible, editing]);

  const buildStart = (): string => {
    if (!date) return '';
    if (allDay) return date;
    const t = time || '09:00';
    return `${date}T${t}`;
  };

  const save = () => {
    if (!title.trim() || !date) return;
    const startAt = buildStart();
    const endAt = endDate ? (allDay ? endDate : `${endDate}T${endTime || '10:00'}`) : null;
    const reminderOffsetMin = reminderMin.trim() === '' ? null : parseInt(reminderMin.trim(), 10);
    const payload = {
      title: title.trim(),
      startAt,
      endAt,
      allDay,
      recurrence,
      color,
      notes: notes.trim() || undefined,
      reminderOffsetMin,
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{editing ? 'Edit event' : 'New event'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Title">
              <TextBox value={title} onChangeText={setTitle} placeholder="Event title" autoFocus={!editing} />
            </Field>
            <DateField value={date} onChange={setDate} />
            <Field label="All day">
              <ChipRow>
                <Chip label="All day" selected={allDay} onPress={() => setAllDay((v) => !v)} />
              </ChipRow>
            </Field>
            {!allDay && <TimeField value={time} onChange={setTime} />}
            <DateField label="End date (optional)" value={endDate} onChange={setEndDate} />
            {!allDay && endDate && <TimeField label="End time" value={endTime} onChange={setEndTime} />}
            <RecurrenceField value={recurrence} onChange={setRecurrence} />
            <Field label="Color">
              <ChipRow>
                {EVENT_COLORS.map((c) => (
                  <PressableDot key={c} color={c} selected={color === c} onPress={() => setColor(c)} />
                ))}
              </ChipRow>
            </Field>
            <Field label="Remind before (minutes, optional)">
              <TextBox value={reminderMin} onChangeText={setReminderMin} placeholder="e.g. 30" keyboardType="number-pad" />
            </Field>
            <Field label="Notes">
              <TextBox value={notes} onChangeText={setNotes} placeholder="Optional" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
            </Field>
            <View style={styles.actions}>
              {editing && <Button title="Delete" variant="danger" onPress={del} style={{ flex: 1 }} />}
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Save" onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PressableDot({ color, selected, onPress }: { color: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableDotInner selected={selected} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: color }, selected && styles.dotSelected]} />
    </PressableDotInner>
  );
}

function PressableDotInner({ children, selected, onPress }: { children: React.ReactNode; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.dotWrap, selected && { borderColor: colors.text }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '88%',
  },
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
