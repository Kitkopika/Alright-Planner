/**
 * Universal Quick Add ("+" button): pick a type, fill a minimal form,
 * save. Optimized for very fast entry with smart defaults.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLifeOS } from '../data/store';
import { colors, radius, spacing, typography } from '../theme';
import { Chip, ChipRow, Field, TextBox, Button } from './ui';
import { DateField, MoneyField, RecurrenceField, TimeField, combineDateTime } from './form';
import { addDays, dateKey, todayKey, timeHM, isoDateTime } from '../core/time';
import { Priority, Recurrence, TransactionKind } from '../core/types';
import { QUICK_ADD_KIND } from '../core/kinds';

type QuickType = 'task' | 'reminder' | 'event' | 'expense' | 'income' | 'note' | 'habit' | 'goal';

const TYPES: { type: QuickType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'task', label: 'Task', icon: 'checkbox-outline', color: colors.accent },
  { type: 'reminder', label: 'Reminder', icon: 'alarm-outline', color: colors.warning },
  { type: 'event', label: 'Event', icon: 'calendar-outline', color: colors.info },
  { type: 'expense', label: 'Expense', icon: 'remove-circle-outline', color: colors.danger },
  { type: 'income', label: 'Income', icon: 'add-circle-outline', color: colors.success },
  { type: 'note', label: 'Note', icon: 'document-text-outline', color: colors.textSecondary },
  { type: 'habit', label: 'Habit', icon: 'repeat-outline', color: '#7C3AED' },
  { type: 'goal', label: 'Goal', icon: 'flag-outline', color: colors.warning },
];

export function QuickAddModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const create = useLifeOS((s) => s.create);
  const categories = useLifeOS((s) => s.data.collections.categories);
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<QuickType | null>(null);

  // Reset form when opened.
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (visible) {
      setType(null);
      setResetKey((k) => k + 1);
    }
  }, [visible]);

  const close = () => {
    setType(null);
    onClose();
  };

  const done = () => close();

  const now = new Date();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.sm) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{type ? TYPES.find((t) => t.type === type)?.label : 'Quick add'}</Text>

          {!type ? (
            <View style={styles.grid}>
              {TYPES.map((t) => (
                <PressableTile key={t.type} icon={t.icon} label={t.label} color={t.color} onPress={() => setType(t.type)} />
              ))}
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <FormFor
                key={resetKey}
                type={type}
                now={now}
                categories={categories}
                onCreate={(partial) => {
                  create(QUICK_ADD_KIND[type], partial as never);
                  done();
                }}
                onBack={() => setType(null)}
              />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PressableTile({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <PressableTileInner onPress={onPress}>
      <View style={[styles.tileIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </PressableTileInner>
  );
}

function PressableTileInner({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Per-type mini forms
// ---------------------------------------------------------------------------

function FormFor({
  type,
  now,
  categories,
  onCreate,
  onBack,
}: {
  type: QuickType;
  now: Date;
  categories: { id: string; name: string; kind2: TransactionKind }[];
  onCreate: (partial: Record<string, unknown>) => void;
  onBack: () => void;
}) {
  if (type === 'task') return <TaskForm onCreate={onCreate} onBack={onBack} />;
  if (type === 'reminder') return <ReminderForm onCreate={onCreate} onBack={onBack} />;
  if (type === 'event') return <EventForm onCreate={onCreate} onBack={onBack} />;
  if (type === 'expense' || type === 'income')
    return <MoneyForm kind={type} categories={categories} onCreate={onCreate} onBack={onBack} />;
  if (type === 'note') return <NoteForm onCreate={onCreate} onBack={onBack} />;
  if (type === 'habit') return <HabitForm onCreate={onCreate} onBack={onBack} />;
  return <GoalForm onCreate={onCreate} onBack={onBack} />;
}

function FormShell({ onBack, children, onSave, saveLabel = 'Save' }: { onBack: () => void; children: React.ReactNode; onSave: () => void; saveLabel?: string }) {
  return (
    <View>
      {children}
      <View style={styles.formActions}>
        <Button title="Back" variant="ghost" onPress={onBack} style={{ flex: 1 }} />
        <Button title={saveLabel} onPress={onSave} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

function TaskForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayKey());
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), dueAt: combineDateTime(due, time) || null, priority, recurrence, status: 'todo' })}>
      <Field label="Title">
        <TextBox value={title} onChangeText={setTitle} placeholder="What needs doing?" autoFocus />
      </Field>
      <DateField value={due} onChange={setDue} />
      <TimeField value={time} onChange={setTime} />
      <Field label="Priority">
        <ChipRow>
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
            <Chip key={p} label={p} selected={priority === p} onPress={() => setPriority(p)} />
          ))}
        </ChipRow>
      </Field>
      <RecurrenceField value={recurrence} onChange={setRecurrence} />
    </FormShell>
  );
}

function ReminderForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState(timeHM(new Date(Date.now() + 60 * 60 * 1000)));
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), remindAt: combineDateTime(date, time), recurrence, status: 'pending' })}>
      <Field label="Title">
        <TextBox value={title} onChangeText={setTitle} placeholder="Remind me to…" autoFocus />
      </Field>
      <DateField value={date} onChange={setDate} />
      <TimeField value={time} onChange={setTime} />
      <RecurrenceField value={recurrence} onChange={setRecurrence} />
    </FormShell>
  );
}

function EventForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState(timeHM(new Date(Date.now() + 60 * 60 * 1000)));
  const [allDay, setAllDay] = useState(false);
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), startAt: combineDateTime(date, allDay ? '' : start), allDay, endAt: null })}>
      <Field label="Title">
        <TextBox value={title} onChangeText={setTitle} placeholder="Event title" autoFocus />
      </Field>
      <DateField value={date} onChange={setDate} />
      <Field label="All day">
        <ChipRow>
          <Chip label="All day" selected={allDay} onPress={() => setAllDay((v) => !v)} />
        </ChipRow>
      </Field>
      {!allDay && <TimeField value={start} onChange={setStart} />}
    </FormShell>
  );
}

function MoneyForm({ kind, categories, onCreate, onBack }: { kind: 'expense' | 'income'; categories: { id: string; name: string; kind2: TransactionKind }[]; onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const [cents, setCents] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const expenseCats = categories.filter((c) => c.kind2 === kind);
  return (
    <FormShell
      onBack={onBack}
      saveLabel="Save"
      onSave={() =>
        onCreate({
          kind2: kind,
          amountCents: cents,
          currency: 'USD',
          categoryId: categoryId || null,
          occurredAt: isoDateTime(new Date()),
          note: note.trim() || undefined,
        })
      }
    >
      <MoneyField cents={cents} onChange={setCents} label={kind === 'expense' ? 'Amount spent' : 'Amount received'} />
      <Field label="Category">
        {expenseCats.length === 0 ? (
          <Text style={typography.caption}>No {kind} categories yet — add them in Money.</Text>
        ) : (
          <ChipRow>
            {expenseCats.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </ChipRow>
        )}
      </Field>
      <Field label="Note">
        <TextBox value={note} onChangeText={setNote} placeholder="Optional note" />
      </Field>
    </FormShell>
  );
}

function NoteForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), body: body.trim(), kind2: 'note' })}>
      <Field label="Title">
        <TextBox value={title} onChangeText={setTitle} placeholder="Note title" autoFocus />
      </Field>
      <Field label="Body">
        <TextBox value={body} onChangeText={setBody} placeholder="Write something…" multiline style={{ minHeight: 100, textAlignVertical: 'top' }} />
      </Field>
    </FormShell>
  );
}

function HabitForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const [name, setName] = useState('');
  const [freqType, setFreqType] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const palette = ['#4F46E5', '#16A34A', '#D97706', '#DC2626', '#0891B2', '#7C3AED'];
  const [color] = useState(palette[Math.floor(Math.random() * palette.length)]);
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return (
    <FormShell
      onBack={onBack}
      onSave={() =>
        onCreate({
          name: name.trim(),
          frequency: freqType === 'custom' ? { type: 'custom', weekdays } : { type: freqType },
          color,
          completions: [],
        })
      }
    >
      <Field label="Habit name">
        <TextBox value={name} onChangeText={setName} placeholder="e.g. Read 20 pages" autoFocus />
      </Field>
      <Field label="Frequency">
        <ChipRow>
          <Chip label="Daily" selected={freqType === 'daily'} onPress={() => setFreqType('daily')} />
          <Chip label="Weekly" selected={freqType === 'weekly'} onPress={() => setFreqType('weekly')} />
          <Chip label="Custom days" selected={freqType === 'custom'} onPress={() => setFreqType('custom')} />
        </ChipRow>
      </Field>
      {freqType === 'custom' && (
        <ChipRow style={{ marginTop: 6 }}>
          {labels.map((l, i) => {
            const on = weekdays.includes(i);
            return (
              <Chip key={l} label={l} selected={on} onPress={() => setWeekdays(on ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())} />
            );
          })}
        </ChipRow>
      )}
    </FormShell>
  );
}

function GoalForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState(addDays(new Date(), 30));
  const [hasDeadline, setHasDeadline] = useState(true);
  return (
    <FormShell
      onBack={onBack}
      onSave={() => onCreate({ title: title.trim(), status: 'active', deadline: hasDeadline ? dateKey(deadline) : null })}
    >
      <Field label="Goal">
        <TextBox value={title} onChangeText={setTitle} placeholder="e.g. Run a half marathon" autoFocus />
      </Field>
      <Field label="Deadline">
        <ChipRow>
          <Chip label="Set" selected={hasDeadline} onPress={() => setHasDeadline(true)} />
          <Chip label="None" selected={!hasDeadline} onPress={() => setHasDeadline(false)} />
        </ChipRow>
      </Field>
      {hasDeadline && <DateField value={dateKey(deadline)} onChange={(v) => v && setDeadline(new Date(v + 'T00:00'))} />}
    </FormShell>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  tile: {
    width: '22%',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
