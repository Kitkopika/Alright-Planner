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
import { useSettings } from '../data/settings';
import { useDateNames, useT } from '../i18n';
import { colors, radius, spacing, typography } from '../theme';
import { Chip, ChipRow, Field, TextBox, Button, Sheet } from './ui';
import { Reveal } from './motion';
import { DateField, MoneyField, RecurrenceField, TimeField, combineDateTime } from './form';
import { addDays, dateKey, todayKey, timeHM, isoDateTime } from '../core/time';
import { Priority, Recurrence, TransactionKind } from '../core/types';
import { QUICK_ADD_KIND } from '../core/kinds';
import { TKey } from '../i18n';

type QuickType = 'task' | 'reminder' | 'event' | 'expense' | 'income' | 'note' | 'habit' | 'goal';

const TYPES: { type: QuickType; tKey: TKey; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'task', tKey: 'typeTask', icon: 'checkbox-outline', color: colors.accent },
  { type: 'reminder', tKey: 'typeReminder', icon: 'alarm-outline', color: colors.warning },
  { type: 'event', tKey: 'typeEvent', icon: 'calendar-outline', color: colors.info },
  { type: 'expense', tKey: 'typeExpense', icon: 'remove-circle-outline', color: colors.danger },
  { type: 'income', tKey: 'typeIncome', icon: 'add-circle-outline', color: colors.success },
  { type: 'note', tKey: 'typeNote', icon: 'document-text-outline', color: colors.textSecondary },
  { type: 'habit', tKey: 'typeHabit', icon: 'repeat-outline', color: '#7C3AED' },
  { type: 'goal', tKey: 'typeGoal', icon: 'flag-outline', color: colors.warning },
];

export function QuickAddModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const create = useLifeOS((s) => s.create);
  const categories = useLifeOS((s) => s.data.collections.categories);
  const insets = useSafeAreaInsets();
  const t = useT();
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdropInner}>
          <Pressable onPress={() => {}} style={{ marginBottom: insets.bottom + 52 }}>
            <Sheet style={{ maxHeight: '85%', paddingBottom: Math.max(spacing.xl, spacing.md) }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{type ? t(TYPES.find((x) => x.type === type)?.tKey ?? 'typeTask') : t('quickAddTitle')}</Text>
              <Pressable onPress={close} hitSlop={12} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {!type ? (
              <Reveal key="grid" distance={10}>
                <View style={styles.grid}>
                  {TYPES.map((x) => (
                    <PressableTile key={x.type} icon={x.icon} label={t(x.tKey)} color={x.color} onPress={() => setType(x.type)} />
                  ))}
                </View>
              </Reveal>
            ) : (
              <Reveal key="form" distance={10}>
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
              </Reveal>
            )}
            </Sheet>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
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
  styles = createStyles();
  return (
    <PressableTileInner onPress={onPress}>
      <View style={[styles.tileIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </PressableTileInner>
  );
}

function PressableTileInner({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  styles = createStyles();  return (
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

function FormShell({ onBack, children, onSave, saveLabel }: { onBack: () => void; children: React.ReactNode; onSave: () => void; saveLabel?: string }) {
  styles = createStyles();
  const t = useT();
  return (
    <View>
      {children}
      <View style={styles.formActions}>
        <Button title={t('back')} variant="ghost" onPress={onBack} style={{ flex: 1 }} />
        <Button title={saveLabel ?? t('save')} onPress={onSave} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

function TaskForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayKey());
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), dueAt: combineDateTime(due, time) || null, priority, recurrence, status: 'todo' })}>
      <Field label={t('title')}>
        <TextBox value={title} onChangeText={setTitle} placeholder={t('whatNeedsDoing')} autoFocus />
      </Field>
      <DateField value={due} onChange={setDue} />
      <TimeField value={time} onChange={setTime} />
      <Field label={t('priority')}>
        <ChipRow>
          {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
            <Chip key={p} label={t(p)} selected={priority === p} onPress={() => setPriority(p)} />
          ))}
        </ChipRow>
      </Field>
      <RecurrenceField value={recurrence} onChange={setRecurrence} />
    </FormShell>
  );
}

function ReminderForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState(timeHM(new Date(Date.now() + 60 * 60 * 1000)));
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), remindAt: combineDateTime(date, time), recurrence, status: 'pending' })}>
      <Field label={t('title')}>
        <TextBox value={title} onChangeText={setTitle} placeholder={t('remindMeTo')} autoFocus />
      </Field>
      <DateField value={date} onChange={setDate} />
      <TimeField value={time} onChange={setTime} />
      <RecurrenceField value={recurrence} onChange={setRecurrence} />
    </FormShell>
  );
}

function EventForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState(timeHM(new Date(Date.now() + 60 * 60 * 1000)));
  const [allDay, setAllDay] = useState(false);
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), startAt: combineDateTime(date, allDay ? '' : start), allDay, endAt: null })}>
      <Field label={t('title')}>
        <TextBox value={title} onChangeText={setTitle} placeholder={t('eventTitle')} autoFocus />
      </Field>
      <DateField value={date} onChange={setDate} />
      <Field label={t('allDay')}>
        <ChipRow>
          <Chip label={t('allDay')} selected={allDay} onPress={() => setAllDay((v) => !v)} />
        </ChipRow>
      </Field>
      {!allDay && <TimeField value={start} onChange={setStart} />}
    </FormShell>
  );
}

function MoneyForm({ kind, categories, onCreate, onBack }: { kind: 'expense' | 'income'; categories: { id: string; name: string; kind2: TransactionKind }[]; onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const currency = useSettings((s) => s.currency);
  const t = useT();
  const [cents, setCents] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const expenseCats = categories.filter((c) => c.kind2 === kind);
  return (
    <FormShell
      onBack={onBack}
      onSave={() =>
        onCreate({
          kind2: kind,
          amountCents: cents,
          currency,
          categoryId: categoryId || null,
          occurredAt: isoDateTime(new Date()),
          note: note.trim() || undefined,
        })
      }
    >
      <MoneyField cents={cents} onChange={setCents} label={kind === 'expense' ? t('amountSpent') : t('amountReceived')} />
      <Field label={t('category')}>
        {expenseCats.length === 0 ? (
          <Text style={typography.caption}>{t('noCatsYet')}</Text>
        ) : (
          <ChipRow>
            {expenseCats.map((c) => (
              <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </ChipRow>
        )}
      </Field>
      <Field label={t('note')}>
        <TextBox value={note} onChangeText={setNote} placeholder={t('optionalNote')} />
      </Field>
    </FormShell>
  );
}

function NoteForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  return (
    <FormShell onBack={onBack} onSave={() => onCreate({ title: title.trim(), body: body.trim(), kind2: 'note' })}>
      <Field label={t('title')}>
        <TextBox value={title} onChangeText={setTitle} placeholder={t('noteTitle')} autoFocus />
      </Field>
      <Field label={t('noteBody')}>
        <TextBox value={body} onChangeText={setBody} placeholder={t('writeSomething')} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} />
      </Field>
    </FormShell>
  );
}

function HabitForm({ onCreate, onBack }: { onCreate: (p: Record<string, unknown>) => void; onBack: () => void }) {
  const t = useT();
  const { weekdaysShort } = useDateNames();
  const [name, setName] = useState('');
  const [freqType, setFreqType] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const palette = ['#4F46E5', '#16A34A', '#D97706', '#DC2626', '#0891B2', '#7C3AED'];
  const [color] = useState(palette[Math.floor(Math.random() * palette.length)]);
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
      <Field label={t('habitName')}>
        <TextBox value={name} onChangeText={setName} placeholder="e.g. Read 20 pages" autoFocus />
      </Field>
      <Field label={t('frequency')}>
        <ChipRow>
          <Chip label={t('daily')} selected={freqType === 'daily'} onPress={() => setFreqType('daily')} />
          <Chip label={t('weekly')} selected={freqType === 'weekly'} onPress={() => setFreqType('weekly')} />
          <Chip label={t('customDays')} selected={freqType === 'custom'} onPress={() => setFreqType('custom')} />
        </ChipRow>
      </Field>
      {freqType === 'custom' && (
        <ChipRow style={{ marginTop: 6 }}>
          {weekdaysShort.map((l, i) => {
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
  const t = useT();
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState(addDays(new Date(), 30));
  const [hasDeadline, setHasDeadline] = useState(true);
  return (
    <FormShell
      onBack={onBack}
      onSave={() => onCreate({ title: title.trim(), status: 'active', deadline: hasDeadline ? dateKey(deadline) : null })}
    >
      <Field label={t('typeGoal')}>
        <TextBox value={title} onChangeText={setTitle} placeholder={t('goalExample')} autoFocus />
      </Field>
      <Field label={t('deadline')}>
        <ChipRow>
          <Chip label={t('set')} selected={hasDeadline} onPress={() => setHasDeadline(true)} />
          <Chip label={t('none')} selected={!hasDeadline} onPress={() => setHasDeadline(false)} />
        </ChipRow>
      </Field>
      {hasDeadline && <DateField value={dateKey(deadline)} onChange={(v) => v && setDeadline(new Date(v + 'T00:00'))} />}
    </FormShell>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  backdropInner: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.title,
    flex: 1,
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
}

