/**
 * Today — the dashboard. Aggregates schedule, tasks, habits, routines,
 * reminders, spending, goals and quick notes for today, with a daily
 * progress figure. Data comes from `computeToday` (pure logic).
 */

import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLifeOS } from '../../src/data/store';
import { useT, useDateNames } from '../../src/i18n';
import { computeToday } from '../../src/features/today';
import { dateKey, isoDateTime, timeHM, tryParseISO } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Card, SectionHeader, ProgressBar, Badge, TextBox, Button, EmptyState } from '../../src/components/ui';
import { QuickAddModal } from '../../src/components/quickAdd';
import { formatMoney } from '../../src/features/finance';
import { Reminder } from '../../src/core/types';

export default function TodayScreen() {
  styles = createStyles();
  const router = useRouter();
  const data = useLifeOS((s) => s.data);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const create = useLifeOS((s) => s.create);

  const [quickNote, setQuickNote] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const t = useT();
  const { months, weekdays } = useDateNames();

  const today = useMemo(() => computeToday(data, new Date()), [data]);
  const now = new Date();

  const focusTodayMin = useMemo(() => {
    const key = dateKey(now);
    return data.collections.focusSessions
      .filter((s) => !s.deletedAt && s.startedAt.startsWith(key))
      .reduce((a, s) => a + s.durationMin, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const focusTodayLabel = focusTodayMin >= 60 ? `${Math.floor(focusTodayMin / 60)}h ${focusTodayMin % 60}m` : `${focusTodayMin}m`;

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
      update('tasks', id, { status: isDone ? 'todo' : 'done', completedAt: isDone ? null : isoDateTime(new Date()) });
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
    const text = quickNote.trim();
    if (!text) return;
    const firstLine = text.split('\n')[0].slice(0, 80);
    create('notes', { title: firstLine || 'Quick note', body: text, kind2: 'note' });
    setQuickNote('');
  };

  const recentQuickNotes = useMemo(
    () =>
      data.collections.notes
        .filter((n) => !n.deletedAt && n.kind2 === 'note')
        .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
        .slice(0, 3),
    [data]
  );

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{weekdays[now.getDay()]}</Text>
          <Text style={styles.subdate}>{formatLongDate(now, weekdays, months)}</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Daily progress */}
      <Card style={styles.progressCard}>
        <View style={styles.progressRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.section}>{t('dailyProgress')}</Text>
            <Text style={typography.caption}>
              {t('progressOf').replace('{done}', String(today.progress.done)).replace('{total}', String(today.progress.total))}
              {today.progress.total > 0 ? ` · ${today.progress.pct}%` : ''}
            </Text>
          </View>
          <View style={styles.ring}>
            <Text style={styles.ringText}>{today.progress.pct}%</Text>
          </View>
        </View>
        <ProgressBar pct={today.progress.pct} style={{ marginTop: spacing.sm }} />
      </Card>

      {/* At-a-glance stats */}
      <View style={styles.statsRow}>
        <StatTile icon="checkbox-outline" color={colors.accent} value={`${today.tasks.filter((t) => t.task.status === 'done').length}/${today.tasks.length}`} label={t('tasksToday')} />
        <StatTile icon="repeat-outline" color={colors.success} value={`${today.habits.filter((h) => h.doneToday).length}/${today.habits.length}`} label={t('habits')} />
        <StatTile icon="timer-outline" color={colors.warning} value={focusTodayLabel} label={t('focus')} />
        <StatTile icon="wallet-outline" color={today.spending.netCents >= 0 ? colors.success : colors.danger} value={today.spending.label} label={t('netLabel')} />
      </View>

      {/* Schedule */}
      <SectionHeader title={t('schedule')} />
      {today.schedule.length === 0 ? (
        <EmptyState icon="calendar-outline" title={t('nothingScheduledToday')} subtitle={t('addEventWithPlus')} />
      ) : (
        today.schedule.map((item) => (
          <Card key={item.id} style={styles.scheduleItem}>
            <View style={[styles.dot, { backgroundColor: item.color || colors.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>{item.title}</Text>
              {item.endAt ? (
                <Text style={typography.caption}>{item.allDay ? t('allDay') : `${timeHM(tryParseISO(item.startAt) || now)} – ${timeHM(tryParseISO(item.endAt) || now)}`}</Text>
              ) : (
                <Text style={typography.caption}>{item.allDay ? t('allDay') : timeHM(tryParseISO(item.startAt) || now)}</Text>
              )}
            </View>
          </Card>
        ))
      )}

      {/* Tasks */}
      <SectionHeader title={`${t('tasks')} · ${today.tasks.filter((t) => t.task.status === 'done').length}/${today.tasks.length}`} />
      {today.tasks.length === 0 ? (
        <EmptyState icon="checkbox-outline" title={t('noTasksDueToday')} />
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
            {overdue && <Badge text={t('overdueBadge')} color={colors.danger} bg={colors.dangerSoft} />}
          </Card>
        ))
      )}

      {/* Habits */}
      {today.habits.length > 0 && (
        <>
          <SectionHeader title={t('habits')} />
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
          <SectionHeader title={t('routines')} />
          {today.routines.map((r) => (
            <Card key={r.routine.id} style={styles.taskItem} onPress={() => toggleRoutine(r.routine.id)}>
              <Pressable onPress={() => toggleRoutine(r.routine.id)} hitSlop={8}>
                <Ionicons name={r.doneToday ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={r.doneToday ? colors.success : colors.textMuted} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{r.routine.name}</Text>
                <Text style={typography.caption}>
                  {r.doneSteps}/{r.totalSteps} {t('stepsLabel')}
                </Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Reminders */}
      {today.reminders.length > 0 && (
        <>
          <SectionHeader title={t('reminders')} />
          {today.reminders.map((r) => (
            <Card
              key={r.id}
              style={styles.taskItem}
              onPress={() =>
                Alert.alert('Reminder', r.title, [
                  { text: t('dismiss'), onPress: () => dismissReminder(r) },
                  { text: t('snooze1h'), onPress: () => snoozeReminder(r) },
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
      <SectionHeader title={t('moneyToday')} />
      <Card>
        <View style={styles.moneyRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>{t('spentLabel')}</Text>
            <Text style={[typography.body, { fontWeight: '700', color: colors.danger }]}>{formatMoney(today.spending.expenseCents)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>{t('earnedLabel')}</Text>
            <Text style={[typography.body, { fontWeight: '700', color: colors.success }]}>{formatMoney(today.spending.incomeCents)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={typography.caption}>{t('netLabel')}</Text>
            <Text style={[typography.body, { fontWeight: '700' }]}>{today.spending.label}</Text>
          </View>
        </View>
      </Card>

      {/* Goals */}
      {today.goals.length > 0 && (
        <>
          <SectionHeader title={t('goals')} />
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
      <SectionHeader title={t('quickNote')} />
      <Card>
        <TextBox
          value={quickNote}
          onChangeText={setQuickNote}
          placeholder={t('captureThought')}
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
        <Button title={t('saveNote')} onPress={saveQuickNote} disabled={!quickNote.trim()} small style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
        {recentQuickNotes.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            {recentQuickNotes.map((n) => (
              <View key={n.id} style={styles.recentNoteRow}>
                <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                <Text style={[typography.caption, { flex: 1 }]} numberOfLines={1}>{n.title}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{dateKey(new Date(n.updatedAt))}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
      </ScrollView>

      {/* Universal Quick Add — lives only on Home */}
      <Pressable onPress={() => setQuickAddOpen(true)} style={styles.fab} accessibilityLabel="Quick add">
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>
      <QuickAddModal visible={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </KeyboardAvoidingView>
  );
}

function formatLongDate(d: Date, weekdays: string[], months: string[]): string {
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function StatTile({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string }) {
  styles = createStyles();
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[typography.body, { fontWeight: '700', fontSize: 15 }]} numberOfLines={1}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
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
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
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
  recentNoteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    zIndex: 10,
  },
  });
}

