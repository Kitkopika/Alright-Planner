/**
 * Routines & Habits — custom routine templates with per-day schedules,
 * step checklists, habit tracking with streaks and completion statistics.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { useLifeOS } from '../../src/data/store';
import { Habit, Routine, RoutineStep } from '../../src/core/types';
import { addDays, dateKey, todayKey } from '../../src/core/time';
import { habitScheduledToday, habitStreak } from '../../src/features/today';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, SectionHeader, TextBox } from '../../src/components/ui';
import { newId } from '../../src/core/id';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PALETTE = ['#4F46E5', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#DB2777'];

type Tab = 'routines' | 'habits';

export default function RoutinesScreen() {
  const data = useLifeOS((s) => s.data);
  const [tab, setTab] = useState<Tab>('routines');
  const [routineEditor, setRoutineEditor] = useState<string | null>(null);
  const [habitEditor, setHabitEditor] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const routines = data.collections.routines.filter((r) => !r.deletedAt);
  const habits = data.collections.habits.filter((h) => !h.deletedAt && !h.archived);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={typography.title}>Routines</Text>
        <View style={styles.headerActions}>
          <Button
            title="+"
            small
            onPress={() => {
              setRoutineEditor(null);
              setEditorOpen(true);
            }}
          />
        </View>
      </View>
      <ChipRow style={styles.filters}>
        <Chip label="Routines" selected={tab === 'routines'} onPress={() => setTab('routines')} />
        <Chip label="Habits" selected={tab === 'habits'} onPress={() => setTab('habits')} />
      </ChipRow>

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'routines' ? (
          routines.length === 0 ? (
            <EmptyState icon="repeat-outline" title="No routines yet" subtitle="Build a morning or evening routine" />
          ) : (
            routines.map((r) => <RoutineCard key={r.id} routine={r} onEdit={() => { setRoutineEditor(r.id); setEditorOpen(true); }} />)
          )
        ) : habits.length === 0 ? (
          <EmptyState icon="repeat-outline" title="No habits yet" subtitle="Track something daily" />
        ) : (
          habits.map((h) => <HabitCard key={h.id} habit={h} onEdit={() => { setHabitEditor(h.id); setEditorOpen(true); }} />)
        )}
      </ScrollView>

      {tab === 'routines' ? (
        <RoutineEditorModal routineId={routineEditor} visible={editorOpen} onClose={() => setEditorOpen(false)} />
      ) : (
        <HabitEditorModal habitId={habitEditor} visible={editorOpen} onClose={() => setEditorOpen(false)} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Routine card + today checklist
// ---------------------------------------------------------------------------

function RoutineCard({ routine, onEdit }: { routine: Routine; onEdit: () => void }) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const today = todayKey();
  const completion = data.collections.routineCompletions.find((c) => c.routineId === routine.id && c.date === today && !c.deletedAt);
  const doneStepIds = completion?.doneStepIds || [];
  const allDone = routine.steps.length > 0 && routine.steps.every((s) => doneStepIds.includes(s.id));
  const scheduledToday = routine.weekdays.includes(new Date().getDay());

  const toggleStep = (step: RoutineStep) => {
    const next = doneStepIds.includes(step.id) ? doneStepIds.filter((x) => x !== step.id) : [...doneStepIds, step.id];
    if (completion) {
      update('routineCompletions', completion.id, { doneStepIds: next });
    } else {
      create('routineCompletions', { routineId: routine.id, date: today, doneStepIds: next });
    }
  };

  return (
    <Card
      style={{ marginBottom: spacing.md }}
      onPress={onEdit}
      onLongPress={() =>
        Alert.alert('Delete routine?', routine.name, [
          { text: 'Delete', style: 'destructive', onPress: () => remove('routines', routine.id) },
          { text: 'Cancel', style: 'cancel' },
        ])
      }
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={typography.section}>{routine.name}</Text>
          <Text style={typography.caption}>
            {routine.weekdays.length === 7 ? 'Every day' : routine.weekdays.map((w) => WEEKDAY_LABELS[w]).join(', ')}
            {routine.timeOfDay ? ` · ${routine.timeOfDay}` : ''}
          </Text>
        </View>
        <Badge text={allDone ? 'done' : scheduledToday ? `${doneStepIds.length}/${routine.steps.length}` : '—'} color={allDone ? colors.success : colors.textSecondary} bg={allDone ? colors.successSoft : colors.surfaceAlt} />
      </View>

      {scheduledToday && routine.steps.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          {routine.steps.map((step) => {
            const done = doneStepIds.includes(step.id);
            return (
              <Pressable key={step.id} style={styles.stepRow} onPress={() => toggleStep(step)}>
                <Ionicons name={done ? 'checkbox' : 'square-outline'} size={20} color={done ? colors.success : colors.textMuted} />
                <Text style={[typography.body, { flex: 1 }, done && { textDecorationLine: 'line-through', color: colors.textMuted }]}>
                  {step.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Habit card with streak + history
// ---------------------------------------------------------------------------

function HabitCard({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const today = todayKey();
  const doneToday = habit.completions.includes(today);
  const streak = habitStreak(habit, new Date());

  // Last 28 days of completion dots.
  const days = 28;
  const history: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    history.push(dateKey(addDays(new Date(), -i)));
  }

  const toggle = () => {
    update('habits', habit.id, {
      completions: doneToday ? habit.completions.filter((d) => d !== today) : [...habit.completions, today],
    });
  };

  const scheduled = habitScheduledToday(habit, new Date());
  const completionRate = useCompletionRate(habit, 30);

  return (
    <Card
      style={{ marginBottom: spacing.md }}
      onPress={onEdit}
      onLongPress={() =>
        Alert.alert('Delete habit?', habit.name, [
          { text: 'Delete', style: 'destructive', onPress: () => remove('habits', habit.id) },
          { text: 'Cancel', style: 'cancel' },
        ])
      }
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={typography.section}>{habit.name}</Text>
          <Text style={typography.caption}>
            {habit.frequency.type === 'daily' ? 'Daily' : habit.frequency.type === 'weekly' ? 'Weekly' : 'Custom days'}
            {completionRate != null ? ` · ${completionRate}% last 30d` : ''}
          </Text>
        </View>
        <Pressable onPress={toggle} hitSlop={10} style={[styles.habitToggle, doneToday && styles.habitToggleDone]}>
          <Ionicons name={doneToday ? 'checkmark' : 'add'} size={22} color={doneToday ? '#fff' : colors.accent} />
        </Pressable>
      </View>
      <View style={styles.historyRow}>
        {history.map((d) => {
          const on = habit.completions.includes(d);
          return <View key={d} style={[styles.historyDot, on && { backgroundColor: colors.success }, !on && scheduled && { borderColor: colors.border, borderWidth: 1 }]} />;
        })}
      </View>
      <View style={styles.statsRow}>
        <Badge text={`🔥 ${streak} day streak`} color={colors.warning} bg={colors.warningSoft} />
        {!scheduled && <Badge text="not scheduled today" />}
      </View>
    </Card>
  );
}

function useCompletionRate(habit: Habit, days: number): number | null {
  const data = useLifeOS((s) => s.data);
  let scheduled = 0;
  let done = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    if (!habitScheduledToday(habit, d)) continue;
    scheduled++;
    if (habit.completions.includes(dateKey(d))) done++;
  }
  void data;
  return scheduled > 0 ? Math.round((done / scheduled) * 100) : null;
}

// ---------------------------------------------------------------------------
// Routine editor
// ---------------------------------------------------------------------------

export function RoutineEditorModal({ routineId, visible, onClose }: { routineId: string | null; visible: boolean; onClose: () => void }) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const editing = routineId ? data.collections.routines.find((r) => r.id === routineId && !r.deletedAt) : undefined;

  const [name, setName] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [timeOfDay, setTimeOfDay] = useState('');
  const [steps, setSteps] = useState<RoutineStep[]>([]);
  const [color, setColor] = useState(PALETTE[0]);
  const [newStep, setNewStep] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setWeekdays(editing.weekdays);
      setTimeOfDay(editing.timeOfDay || '');
      setSteps(editing.steps);
      setColor(editing.color || PALETTE[0]);
    } else {
      setName('');
      setWeekdays([0, 1, 2, 3, 4, 5, 6]);
      setTimeOfDay('');
      setSteps([{ id: newId(), label: '' }]);
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    }
    setNewStep('');
  }, [visible, editing]);

  const setStepLabel = (id: string, label: string) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, label } : s)));
  };

  const addStep = () => {
    const label = newStep.trim();
    if (!label) return;
    setSteps([...steps, { id: newId(), label }]);
    setNewStep('');
  };

  const save = () => {
    const cleanSteps = steps.filter((s) => s.label.trim()).map((s) => ({ ...s, label: s.label.trim() }));
    if (!name.trim() || cleanSteps.length === 0) return;
    const payload = { name: name.trim(), weekdays, timeOfDay: timeOfDay.trim() || null, steps: cleanSteps, color };
    if (editing) update('routines', editing.id, payload);
    else create('routines', payload);
    onClose();
  };

  const del = () => {
    if (editing) {
      remove('routines', editing.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit routine' : 'New routine'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Name">
              <TextBox value={name} onChangeText={setName} placeholder="e.g. Morning routine" autoFocus={!editing} />
            </Field>
            <Field label="Days">
              <ChipRow>
                {WEEKDAY_LABELS.map((l, i) => {
                  const on = weekdays.includes(i);
                  return (
                    <Chip key={l} label={l} selected={on} onPress={() => setWeekdays(on ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())} />
                  );
                })}
              </ChipRow>
              <ChipRow style={{ marginTop: 6 }}>
                <Chip label="Every day" selected={weekdays.length === 7} onPress={() => setWeekdays([0, 1, 2, 3, 4, 5, 6])} />
                <Chip label="Weekdays" selected={weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => weekdays.includes(d))} onPress={() => setWeekdays([1, 2, 3, 4, 5])} />
              </ChipRow>
            </Field>
            <Field label="Time (optional)">
              <TextBox value={timeOfDay} onChangeText={setTimeOfDay} placeholder="HH:mm" />
            </Field>
            <Field label="Steps">
              {steps.map((s, i) => (
                <View key={s.id} style={styles.stepEditRow}>
                  <Text style={styles.stepIndex}>{i + 1}.</Text>
                  <TextBox value={s.label} onChangeText={(v) => setStepLabel(s.id, v)} placeholder="Step…" style={{ flex: 1 }} />
                  <Pressable onPress={() => setSteps(steps.filter((x) => x.id !== s.id))} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
              <View style={styles.stepAdd}>
                <TextBox value={newStep} onChangeText={setNewStep} placeholder="Add step…" style={{ flex: 1 }} onSubmitEditing={addStep} returnKeyType="done" />
                <Button title="Add" small onPress={addStep} />
              </View>
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

// ---------------------------------------------------------------------------
// Habit editor
// ---------------------------------------------------------------------------

export function HabitEditorModal({ habitId, visible, onClose }: { habitId: string | null; visible: boolean; onClose: () => void }) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const editing = habitId ? data.collections.habits.find((h) => h.id === habitId && !h.deletedAt) : undefined;
  const goals = data.collections.goals.filter((g) => !g.deletedAt && g.status === 'active');

  const [name, setName] = useState('');
  const [freqType, setFreqType] = useState<Habit['frequency']['type']>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(5);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [color, setColor] = useState(PALETTE[0]);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setFreqType(editing.frequency.type);
      setWeekdays(editing.frequency.weekdays || [1, 2, 3, 4, 5]);
      setTimesPerWeek(editing.frequency.timesPerWeek || 5);
      setGoalId(editing.goalId || null);
      setColor(editing.color || PALETTE[0]);
    } else {
      setName('');
      setFreqType('daily');
      setWeekdays([1, 2, 3, 4, 5]);
      setTimesPerWeek(5);
      setGoalId(null);
      setColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    }
  }, [visible, editing]);

  const save = () => {
    if (!name.trim()) return;
    const frequency: Habit['frequency'] =
      freqType === 'custom' ? { type: 'custom', weekdays }
      : freqType === 'weekly' ? { type: 'weekly', timesPerWeek }
      : { type: 'daily' };
    const payload = { name: name.trim(), frequency, goalId: goalId || null, color };
    if (editing) update('habits', editing.id, payload);
    else create('habits', { ...payload, completions: [] });
    onClose();
  };

  const del = () => {
    if (editing) {
      remove('habits', editing.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit habit' : 'New habit'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Name">
              <TextBox value={name} onChangeText={setName} placeholder="e.g. Read 20 pages" autoFocus={!editing} />
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
                {WEEKDAY_LABELS.map((l, i) => {
                  const on = weekdays.includes(i);
                  return (
                    <Chip key={l} label={l} selected={on} onPress={() => setWeekdays(on ? weekdays.filter((x) => x !== i) : [...weekdays, i].sort())} />
                  );
                })}
              </ChipRow>
            )}
            {freqType === 'weekly' && (
              <Field label="Target times per week">
                <ChipRow>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <Chip key={n} label={String(n)} selected={timesPerWeek === n} onPress={() => setTimesPerWeek(n)} />
                  ))}
                </ChipRow>
              </Field>
            )}
            <Field label="Linked goal (optional)">
              <ChipRow>
                <Chip label="None" selected={!goalId} onPress={() => setGoalId(null)} />
                {goals.map((g) => (
                  <Chip key={g.id} label={g.title} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />
                ))}
              </ChipRow>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  filters: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 120 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  habitToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitToggleDone: { backgroundColor: colors.success, borderColor: colors.success },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: spacing.md },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt },
  statsRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '90%',
  },
  sheetTitle: { ...typography.title, marginBottom: spacing.lg },
  stepEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  stepIndex: { width: 18, color: colors.textMuted, fontSize: 14 },
  stepAdd: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
