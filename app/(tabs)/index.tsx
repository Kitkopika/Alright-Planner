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
import { colors, radius, accentGradient, shadow, spacing, typography } from '../../src/theme';
import { Card, SectionHeader, ProgressBar, Badge, TextBox, Button, EmptyState } from '../../src/components/ui';
import { HomeLayoutModal } from '../../src/components/homeLayoutModal';
import { MiniBarChart } from '../../src/components/miniBarChart';
import { TrendChart } from '../../src/components/charts';
import { Reveal, Spotlight, GradientFill } from '../../src/components/motion';
import { AmbientBackground } from '../../src/components/ambient';
import { useSettings, HomeSectionId } from '../../src/data/settings';
import { chartMoneySeries, chartHabitsSeries, chartFocusSeries, chartTasksSeries, moneyBalanceCents, topSpending, lastNDays } from '../../src/features/homeWidgets';
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
  const [layoutOpen, setLayoutOpen] = useState(false);
  const t = useT();
  const homeLayout = useSettings((s) => s.homeLayout);
  const fx = useSettings((s) => s.visualFx.lighting);
  const { months, weekdays } = useDateNames();

  const today = useMemo(() => computeToday(data, new Date()), [data]);
  const now = new Date();

  // Chart widget data (last 7 days).
  const chartDays = useMemo(() => lastNDays(7, (d) => weekdays[d.getDay()]), [weekdays]);
  const moneyChart = useMemo(() => chartMoneySeries(data, chartDays), [data, chartDays]);
  const habitsChart = useMemo(() => chartHabitsSeries(data, chartDays), [data, chartDays]);
  const focusChart = useMemo(() => chartFocusSeries(data, chartDays), [data, chartDays]);
  const tasksChart = useMemo(() => chartTasksSeries(data, chartDays), [data, chartDays]);
  const balanceCents = useMemo(() => moneyBalanceCents(data), [data]);
  const topCat = useMemo(() => topSpending(data, 4), [data]);
  const chartHeight = (id: HomeSectionId) => (sectionSize(id) === 'small' ? 36 : sectionSize(id) === 'medium' ? 56 : 76);

  const focusTodayMin = useMemo(() => {
    const key = dateKey(now);
    return data.collections.focusSessions
      .filter((s) => !s.deletedAt && s.startedAt.startsWith(key))
      .reduce((a, s) => a + s.durationMin, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const focusTodayLabel = focusTodayMin >= 60 ? `${Math.floor(focusTodayMin / 60)}h ${focusTodayMin % 60}m` : `${focusTodayMin}m`;

  // Home layout config: which sections are shown, in which order and scale
  // (widget-like: small / medium / large).
  const shown = useMemo(() => homeLayout.filter((s) => s.enabled), [homeLayout]);
  const hasSection = (id: HomeSectionId) => shown.some((s) => s.id === id);
  const sectionSize = (id: HomeSectionId) => homeLayout.find((s) => s.id === id)?.size ?? 'large';
  const maxItems = (id: HomeSectionId) => (sectionSize(id) === 'small' ? 3 : sectionSize(id) === 'medium' ? 6 : 999);
  const isLarge = (id: HomeSectionId) => sectionSize(id) === 'large';
  const isMedium = (id: HomeSectionId) => sectionSize(id) === 'medium';

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
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <Reveal distance={18}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.date, !fx && { textShadowColor: 'transparent', textShadowRadius: 0 }]}>{weekdays[now.getDay()]}</Text>
            <Text style={styles.subdate}>{formatLongDate(now, weekdays, months)}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable onPress={() => setLayoutOpen(true)} style={styles.iconBtn} accessibilityLabel={t('homeLayout')}>
              <Ionicons name="grid-outline" size={20} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </Reveal>

      {/* Daily progress */}
      {hasSection('progress') && (
        <Card style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.section}>{t('dailyProgress')}</Text>
              <Text style={typography.caption}>
                {t('progressOf').replace('{done}', String(today.progress.done)).replace('{total}', String(today.progress.total))}
                {today.progress.total > 0 ? ` · ${today.progress.pct}%` : ''}
              </Text>
            </View>
            <View style={sectionSize('progress') === 'small' ? styles.ringSmall : sectionSize('progress') === 'medium' ? styles.ringMed : styles.ring}>
              <Text style={[styles.ringText, sectionSize('progress') !== 'large' && { fontSize: 13 }]}>{today.progress.pct}%</Text>
            </View>
          </View>
          {sectionSize('progress') !== 'small' && <ProgressBar pct={today.progress.pct} style={{ marginTop: spacing.sm }} />}
        </Card>
      )}

      {/* At-a-glance stats */}
      {hasSection('stats') && (
        <View style={[styles.statsRow, sectionSize('stats') === 'small' && styles.statsRowWrap]}>
          <StatTile icon="checkbox-outline" color={colors.accent} value={`${today.tasks.filter((t) => t.task.status === 'done').length}/${today.tasks.length}`} label={t('tasksToday')} small={sectionSize('stats') === 'small'} />
          <StatTile icon="repeat-outline" color={colors.success} value={`${today.habits.filter((h) => h.doneToday).length}/${today.habits.length}`} label={t('habits')} small={sectionSize('stats') === 'small'} />
          <StatTile icon="timer-outline" color={colors.warning} value={focusTodayLabel} label={t('focus')} small={sectionSize('stats') === 'small'} />
          <StatTile icon="wallet-outline" color={today.spending.netCents >= 0 ? colors.success : colors.danger} value={today.spending.label} label={t('netLabel')} small={sectionSize('stats') === 'small'} />
        </View>
      )}

      {/* Schedule */}
      {hasSection('schedule') && (
        <>
          <SectionHeader title={t('schedule')} />
          {today.schedule.length === 0 ? (
            <EmptyState icon="calendar-outline" title={t('nothingScheduledToday')} subtitle={t('addEventWithPlus')} />
          ) : (
            today.schedule.slice(0, maxItems('schedule')).map((item) => (
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
        </>
      )}

      {/* Tasks */}
      {hasSection('tasks') && (
        <>
          <SectionHeader title={`${t('tasks')} · ${today.tasks.filter((t) => t.task.status === 'done').length}/${today.tasks.length}`} />
          {today.tasks.length === 0 ? (
            <EmptyState icon="checkbox-outline" title={t('noTasksDueToday')} />
          ) : (
            today.tasks.slice(0, maxItems('tasks')).map(({ task, overdue }) => (
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
        </>
      )}

      {/* Habits */}
      {hasSection('habits') && today.habits.length > 0 && (
        <>
          <SectionHeader title={t('habits')} />
          {today.habits.slice(0, maxItems('habits')).map(({ habit, doneToday, streak }) => (
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
      {hasSection('routines') && today.routines.length > 0 && (
        <>
          <SectionHeader title={t('routines')} />
          {today.routines.slice(0, maxItems('routines')).map((r) => (
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
      {hasSection('reminders') && (
        <>
          <SectionHeader title={t('reminders')} />
          {today.reminders.length === 0 ? (
            <EmptyState icon="alarm-outline" title={t('noReminders')} subtitle={t('noRemindersHint')} />
          ) : (
            today.reminders.slice(0, maxItems('reminders')).map((r) => (
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
            ))
          )}
        </>
      )}

      {/* Spending */}
      {hasSection('money') && (
        <>
          <SectionHeader title={t('moneyToday')} />
          <Card>
            {sectionSize('money') === 'large' ? (
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
            ) : sectionSize('money') === 'medium' ? (
              <View style={styles.moneyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.caption}>{t('spentLabel')}</Text>
                  <Text style={[typography.body, { fontWeight: '700', color: colors.danger }]}>{formatMoney(today.spending.expenseCents)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.caption}>{t('earnedLabel')}</Text>
                  <Text style={[typography.body, { fontWeight: '700', color: colors.success }]}>{formatMoney(today.spending.incomeCents)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.moneyRow}>
                <Text style={[typography.caption, { flex: 1 }]}>{t('netLabel')}</Text>
                <Text style={[typography.body, { fontWeight: '700' }]}>{today.spending.label}</Text>
              </View>
            )}
          </Card>
        </>
      )}

      {/* Goals */}
      {hasSection('goals') && today.goals.length > 0 && (
        <>
          <SectionHeader title={t('goals')} />
          {today.goals.slice(0, maxItems('goals')).map((g) => (
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

      {/* Chart widgets (optional, added from the layout menu) */}
      {hasSection('chartMoney') && (
        <>
          <SectionHeader title={t('widgetChartMoney')} />
          <Card>
            <TrendChart
              values={moneyChart.points.map((p) => p.value)}
              labels={isLarge('chartMoney') ? moneyChart.points.map((p) => p.label) : undefined}
              max={moneyChart.max}
              color={colors.accent}
              height={chartHeight('chartMoney')}
              showLabels={isLarge('chartMoney')}
              signed
            />
          </Card>
        </>
      )}
      {hasSection('chartHabits') && (
        <>
          <SectionHeader title={t('widgetChartHabits')} />
          <Card>
            <MiniBarChart
              values={habitsChart.points.map((p) => p.value)}
              labels={isLarge('chartHabits') ? habitsChart.points.map((p) => p.label) : undefined}
              max={habitsChart.max}
              color={colors.accent}
              height={chartHeight('chartHabits')}
              showLabels={isLarge('chartHabits')}
            />
          </Card>
        </>
      )}
      {hasSection('chartFocus') && (
        <>
          <SectionHeader title={t('widgetChartFocus')} />
          <Card>
            <TrendChart
              values={focusChart.points.map((p) => p.value)}
              labels={isLarge('chartFocus') ? focusChart.points.map((p) => p.label) : undefined}
              max={focusChart.max}
              color={colors.accent}
              height={chartHeight('chartFocus')}
              showLabels={isLarge('chartFocus')}
            />
          </Card>
        </>
      )}
      {hasSection('chartTasks') && (
        <>
          <SectionHeader title={t('widgetChartTasks')} />
          <Card>
            <MiniBarChart
              values={tasksChart.points.map((p) => p.value)}
              labels={isLarge('chartTasks') ? tasksChart.points.map((p) => p.label) : undefined}
              max={tasksChart.max}
              color={colors.accent}
              height={chartHeight('chartTasks')}
              showLabels={isLarge('chartTasks')}
            />
          </Card>
        </>
      )}
      {hasSection('moneyBalance') && (
        <>
          <SectionHeader title={t('widgetMoneyBalance')} />
          <Card>
            <View style={styles.moneyRow}>
              <Text style={[typography.caption, { flex: 1 }]}>{t('netLabel')}</Text>
              <Text style={[typography.body, { fontWeight: '700', fontSize: 18, color: balanceCents >= 0 ? colors.success : colors.danger }]}>
                {formatMoney(balanceCents)}
              </Text>
            </View>
          </Card>
        </>
      )}
      {hasSection('spendCat') && topCat.length > 0 && (
        <>
          <SectionHeader title={t('widgetSpendCat')} />
          <Card>
            {topCat.slice(0, isLarge('spendCat') ? 4 : 2).map((c) => (
              <View key={c.name} style={{ marginBottom: spacing.sm }}>
                <View style={styles.goalRow}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <Text style={[typography.body, { flex: 1, fontSize: 13 }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={typography.caption}>{formatMoney(c.cents)}</Text>
                </View>
                <ProgressBar pct={Math.round(c.pct * 100)} color={c.color} style={{ marginTop: spacing.xs }} />
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Quick note */}
      {hasSection('quicknote') && (
        <>
          <SectionHeader title={t('quickNote')} />
          <Card>
            <TextBox
              value={quickNote}
              onChangeText={setQuickNote}
              placeholder={t('captureThought')}
              multiline={sectionSize('quicknote') !== 'small'}
              style={sectionSize('quicknote') !== 'small' ? { minHeight: 72, textAlignVertical: 'top' } : undefined}
            />
            <Button title={t('saveNote')} onPress={saveQuickNote} disabled={!quickNote.trim()} small style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
            {isLarge('quicknote') && recentQuickNotes.length > 0 && (
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
        </>
      )}
      </ScrollView>

      {/* Universal Quick Add — lives only on Home */}
      <Reveal delay={140} style={styles.fabWrap}>
        <Spotlight size={132} style={styles.fabGlow} />
        <Pressable onPress={() => setQuickAddOpen(true)} style={styles.fab} accessibilityLabel="Quick add">
          <GradientFill colors={accentGradient(colors.accent)} />
          <Ionicons name="add" size={30} color="#FFFFFF" />
        </Pressable>
      </Reveal>
      <QuickAddModal visible={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <HomeLayoutModal visible={layoutOpen} onClose={() => setLayoutOpen(false)} />
    </KeyboardAvoidingView>
  );
}

function formatLongDate(d: Date, weekdays: string[], months: string[]): string {
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function StatTile({ icon, color, value, label, small }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string; small?: boolean }) {
  styles = createStyles();
  return (
    <View style={[styles.statTile, small && styles.statTileSmall]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[typography.body, { fontWeight: '700', fontSize: small ? 13 : 15 }]} numberOfLines={1}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, fontSize: small ? 10 : undefined }]}>{label}</Text>
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
  date: { ...typography.title, fontSize: 28, textShadowColor: colors.accent + '44', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 14 },
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
  statsRowWrap: { flexWrap: 'wrap' },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  statTileSmall: { flex: undefined, width: '48%', marginBottom: spacing.sm },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMed: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  fabWrap: { position: 'absolute', right: 18, bottom: 16, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  fabGlow: { position: 'absolute', left: -38, top: -38 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.float,
  },
  });
}

