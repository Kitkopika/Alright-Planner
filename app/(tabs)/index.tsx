/**
 * Today — the dashboard. Aggregates schedule, tasks, habits, routines,
 * reminders, spending, goals and quick notes for today, with a daily
 * progress figure. Data comes from `computeToday` (pure logic).
 */

import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLifeOS } from '../../src/data/store';
import { computeToday } from '../../src/features/today';
import { dateKey, timeHM, tryParseISO, weekdayNames } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Card, SectionHeader, ProgressBar, Badge, TextBox, Button, EmptyState } from '../../src/components/ui';
import { formatMoney } from '../../src/features/finance';
import { Reminder } from '../../src/core/types';

export default function TodayScreen() {
  const router = useRouter();
  const data = useLifeOS((s) => s.data);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const create = useLifeOS((s) => s.create);

  const [quickNote, setQuickNote] = useState('');

  const today = useMemo(() => computeToday(data, new Date()), [data]);
  const now = new Date();

  const toggleTask = (id: string, recurring: boolean) => {
    const t = data.collections.tasks.find((x) => x.id === id);
    if (!t) return;
    const key = dateKey(now);
    if (recurring) {
      const completed = t.completedDates || [];
      const next = completed.includes(key) ? completed.filter((d) => d !== key) : [...completed, key];
      update('tasks', id, { completedDates: next });
    } else {
      const isDone = t.status === 'done';
      update('tasks', id, { status: isDone ? 'todo' : 'done', completedAt: isDone ? null : new Date().toISOString().slice(0, 16) });
    }
  };

  const toggleHabit = (id: string) => {
    const h = data.collections.habits.find((x) => x.id === id);
    if (!h) return;
    const key = dateKey(now);
    const done = h.completions.includes(key);
    update('habits', id, {
      completions: done ? h.completions.filter((d) => d !== key) : [...h.completions, key],
    });
  };

  const toggleRoutine = (routineId: string) => {
    const key = dateKey(now);
    const routine = data.collections.routines.find((r) => r.id === routineId);
    if (!routine) return;
    const existing = data.collections.routineCompletions.find((c) => c.routineId === routineId && c.date === key && !c.deletedAt);
    if (existing) {
      remove('routineCompletions', existing.id);
    } else {
      create('routineCompletions', {
        routineId,
        date: key,
        doneStepIds: routine.steps.map((s) => s.id),
      });
    }
  };

  const saveQuickNote = () => {
    const title = quickNote.trim();
    if (!title) return;
    create('notes', { title, body: '', kind2: 'note' });
    setQuickNote('');
  };

  const dismissReminder = (r: Reminder) => {
    const key = dateKey(now);
    if (r.recurrence) {
      update('reminders', r.id, { triggeredDates: [...(r.triggeredDates || []), key] });
    } else {
      update('reminders', r.id, { status: 'dismissed' });
    }
  };

  const snoozeReminder = (r: Reminder) => {
    const base = tryParseISO(r.remindAt) || now;
    const snoozed = new Date(base.getTime() + 60 * 60 * 1000);
    const iso = `${dateKey(snoozed)}T${String(snoozed.getHours()).padStart(2, '0')}:${String(snoozed.getMinutes()).padStart(2, '0')}`;
    update('reminders', r.id, { remindAt: iso, status: 'snoozed' });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{today.weekday}</Text>
          <Text style={styles.subdate}>{formatLongDate(now)}</Text>
        </View>
        <Pressable onPress={() => router.push('/data')} style={styles.iconBtn}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Daily progress */}
      <Card style={styles.progressCard}>
        <View style={styles.progressRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.section}>Daily progress</Text>
            <Text style={typography.caption}>
              {today.progress.done} of {today.progress.total} done{today.progress.total > 0 ? ` · ${today.progress.pct}%` : ''}
            </Text>
          </View>
          <View style={styles.ring}>
            <Text style={styles.ringText}>{today.progress.pct}%</Text>
          </View>
        </View>
        <ProgressBar pct={today.progress.pct} style={{ marginTop: spacing.sm }} />
      </Card>

      {/* Schedule */}
      <SectionHeader title="Schedule" />
      {today.schedule.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Nothing scheduled today" subtitle="Add an event with +" />
      ) : (
        today.schedule.map((item) => (
          <Card key={item.id} style={styles.scheduleItem}>
            <View style={[styles.dot, { backgroundColor: item.color || colors.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{item.title}</Text>
              {item.endAt ? (
                <Text style={typography.caption}>{item.allDay ? 'All day' : `${timeHM(tryParseISO(item.startAt) || now)} – ${timeHM(tryParseISO(item.endAt) || now)}`}</Text>
              ) : (
                <Text style={typography.caption}>{item.allDay ? 'All day' : timeHM(tryParseISO(item.startAt) || now)}</Text>
              )}
            </View>
          </Card>
        ))
      )}

      {/* Tasks */}
      <SectionHeader title={`Tasks · ${today.tasks.filter((t) => t.task.status === 'done').length}/${today.tasks.length}`} />
      {today.tasks.length === 0 ? (
        <EmptyState icon="checkbox-outline" title="No tasks due today" />
      ) : (
        today.tasks.map(({ task, overdue }) => (
          <Card key={task.id} style={styles.taskItem}>
            <Pressable onPress={() => toggleTask(task.id, !!task.recurrence)} hitSlop={8}>
              <Ionicons
                name={task.status === 'done' ? 'checkbox' : 'square-outline'}
                size={22}
                color={task.status === 'done' ? colors.success : colors.textMuted}
              />
            </Pressable>
            <Text
              style={[
                typography.body,
                { flex: 1 },
                task.status === 'done' && { textDecorationLine: 'line-through', color: colors.textMuted },
              ]}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            {overdue && <Badge text="overdue" color={colors.danger} bg={colors.dangerSoft} />}
          </Card>
        ))
      )}

      {/* Habits */}
      {today.habits.length > 0 && (
        <>
          <SectionHeader title="Habits" />
          {today.habits.map(({ habit, doneToday, streak }) => (
            <Card key={habit.id} style={styles.taskItem} onPress={() => toggleHabit(habit.id)}>
              <Pressable onPress={() => toggleHabit(habit.id)} hitSlop={8}>
                <Ionicons name={doneToday ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={doneToday ? colors.success : colors.textMuted} />
              </Pressable>
              <Text style={[typography.body, { flex: 1 }]}>{habit.name}</Text>
              <Badge text={`🔥 ${streak}`} color={colors.warning} bg={colors.warningSoft} />
            </Card>
          ))}
        </>
      )}

      {/* Routines */}
      {today.routines.length > 0 && (
        <>
          <SectionHeader title="Routines" />
          {today.routines.map((r) => (
            <Card key={r.routine.id} style={styles.taskItem} onPress={() => toggleRoutine(r.routine.id)}>
              <Pressable onPress={() => toggleRoutine(r.routine.id)} hitSlop={8}>
                <Ionicons name={r.doneToday ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={r.doneToday ? colors.success : colors.textMuted} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{r.routine.name}</Text>
                <Text style={typography.caption}>
                  {r.doneSteps}/{r.totalSteps} steps
                </Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Reminders */}
      {today.reminders.length > 0 && (
        <>
          <SectionHeader title="Reminders" />
          {today.reminders.map((r) => (
            <Card
              key={r.id}
              style={styles.taskItem}
              onPress={() =>
                Alert.alert('Reminder', r.title, [
                  { text: 'Dismiss', onPress: () => dismissReminder(r) },
                  { text: 'Snooze 1h', onPress: () => snoozeReminder(r) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <Ionicons name="alarm-outline" size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{r.title}</Text>
                <Text style={typography.caption}>{r.remindAt}</Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Spending */}
      <SectionHeader title="Money today" />
      <Card>
        <View style={styles.moneyRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>Spent</Text>
            <Text style={[typography.body, { fontWeight: '700', color: colors.danger }]}>{formatMoney(today.spending.expenseCents)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>Earned</Text>
            <Text style={[typography.body, { fontWeight: '700', color: colors.success }]}>{formatMoney(today.spending.incomeCents)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>Net</Text>
            <Text style={[typography.body, { fontWeight: '700' }]}>{today.spending.label}</Text>
          </View>
        </View>
      </Card>

      {/* Goals */}
      {today.goals.length > 0 && (
        <>
          <SectionHeader title="Goals" />
          {today.goals.map((g) => (
            <Card key={g.id} style={{ marginBottom: spacing.sm }}>
              <View style={styles.goalRow}>
                <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>{g.title}</Text>
                <Text style={typography.caption}>{g.progressPct}%</Text>
              </View>
              <ProgressBar pct={g.progressPct} color={g.color || colors.accent} style={{ marginTop: spacing.xs }} />
            </Card>
          ))}
        </>
      )}

      {/* Quick note */}
      <SectionHeader title="Quick note" />
      <Card>
        <TextBox
          value={quickNote}
          onChangeText={setQuickNote}
          placeholder="Capture something…"
          onSubmitEditing={saveQuickNote}
          returnKeyType="done"
        />
        <Button title="Save note" onPress={saveQuickNote} small style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
      </Card>
    </ScrollView>
  );
}

function formatLongDate(d: Date): string {
  return `${weekdayNames(false)[d.getDay()]}, ${d.getDate()} ${['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()]}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  date: { ...typography.title, fontSize: 28 },
  subdate: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  progressCard: { marginBottom: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { fontWeight: '700', color: colors.accent },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
  },
  moneyRow: { flexDirection: 'row' },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
