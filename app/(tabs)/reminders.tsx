/**
 * Reminders page — every active reminder (from events/tasks remind-before
 * offsets and quick-add), grouped by day, with dismiss / snooze actions.
 */

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDataSlice, useLifeOS } from '../../src/data/store';
import { Reminder } from '../../src/core/types';
import { dateKey, timeHM, tryParseISO } from '../../src/core/time';
import { themedStyles, colors, radius, spacing, typography  } from '../../src/theme';
import { FadeEdge } from '../../src/components/motion';
import { AmbientBackground } from '../../src/components/ambient';
import { Badge, Button, Card, EmptyState } from '../../src/components/ui';
import { ReminderEditorModal } from '../../src/components/reminderEditor';
import { TKey, useT } from '../../src/i18n';

export default function RemindersScreen() {
  styles = createStyles();
  const t = useT();
  const data = useDataSlice(['reminders', 'events', 'tasks']);
  const update = useLifeOS((s) => s.update);
  const now = new Date();
  const [addOpen, setAddOpen] = useState(false);

  const tasksById = useMemo(() => new Map(data.collections.tasks.filter((x) => !x.deletedAt).map((x) => [x.id, x])), [data]);
  const eventsById = useMemo(() => new Map(data.collections.events.filter((x) => !x.deletedAt).map((x) => [x.id, x])), [data]);

  /** Active reminders (not dismissed/deleted), newest scheduled first. */
  const active = useMemo(() => {
    return data.collections.reminders
      .filter((r) => !r.deletedAt && r.status !== 'dismissed')
      .sort((a, b) => (tryParseISO(a.remindAt)?.getTime() ?? 0) - (tryParseISO(b.remindAt)?.getTime() ?? 0));
  }, [data]);

  const sourceTitle = (r: Reminder): string | null => {
    if (r.eventId) return eventsById.get(r.eventId)?.title ?? null;
    if (r.taskId) return tasksById.get(r.taskId)?.title ?? null;
    return null;
  };

  const dismiss = (r: Reminder) => {
    const key = dateKey(now);
    if (r.recurrence) {
      update('reminders', r.id, { triggeredDates: [...(r.triggeredDates || []), key] });
    } else {
      update('reminders', r.id, { status: 'dismissed' });
    }
  };

  const snooze = (r: Reminder) => {
    const base = tryParseISO(r.remindAt) || now;
    const snoozed = new Date(base.getTime() + 60 * 60 * 1000);
    const iso = `${dateKey(snoozed)}T${String(snoozed.getHours()).padStart(2, '0')}:${String(snoozed.getMinutes()).padStart(2, '0')}`;
    update('reminders', r.id, { remindAt: iso, status: 'snoozed' });
  };

  const confirmDismiss = (r: Reminder) => {
    Alert.alert(r.title, t('reminders'), [
      { text: t('dismiss'), onPress: () => dismiss(r) },
      { text: t('snooze1h'), onPress: () => snooze(r) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  /** Group active reminders by day label. */
  const groups = useMemo(() => {
    const byKey = new Map<string, { label: string; items: Reminder[] }>();
    for (const r of active) {
      const when = tryParseISO(r.remindAt);
      if (!when) continue;
      const key = dateKey(when);
      if (!byKey.has(key)) {
        byKey.set(key, { label: dayLabel(when, now, t), items: [] });
      }
      byKey.get(key)!.items.push(r);
    }
    return [...byKey.entries()];
  }, [active, now, t]);

  return (
    <View style={styles.screen}>
      <AmbientBackground />
      <View style={styles.header}>
        <Text style={typography.title}>{t('reminders')}</Text>
        <View style={styles.headerActions}>
          <Button title={`+ ${t('addReminder')}`} small onPress={() => setAddOpen(true)} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <FadeEdge color={colors.background} position="top" />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {active.length === 0 ? (
          <EmptyState icon="alarm-outline" title={t('noReminders')} subtitle={t('noRemindersHint')} />
        ) : (
          groups.map(([key, group]) => (
            <View key={key} style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.caption, styles.groupLabel]}>{group.label}</Text>
              {group.items.map((r) => {
                const when = tryParseISO(r.remindAt);
                const linked = sourceTitle(r);
                const isDue = when && when.getTime() <= now.getTime();
                return (
                  <Card key={r.id} style={styles.card} onPress={() => confirmDismiss(r)}>
                    <Ionicons name={r.recurrence ? 'repeat' : 'alarm-outline'} size={18} color={isDue ? colors.danger : colors.warning} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                        <Text style={[typography.body, { flexShrink: 1 }]} numberOfLines={1}>
                          {r.title}
                        </Text>
                        {isDue && <Badge text={t('overdueBadge')} color={colors.danger} bg={colors.dangerSoft} />}
                      </View>
                      <Text style={typography.caption}>
                        {when ? timeHM(when) : r.remindAt}
                        {linked && linked !== r.title ? ` · ${linked}` : ''}
                      </Text>
                    </View>
                    <Button title={t('dismiss')} small variant="ghost" onPress={() => dismiss(r)} />
                    <Button title={t('snooze1h')} small variant="ghost" onPress={() => snooze(r)} />
                  </Card>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
      </View>
      <ReminderEditorModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

function dayLabel(d: Date, now: Date, t: (k: TKey) => string): string {
  const today = dateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey(d) === today) return t('today');
  if (dateKey(d) === dateKey(tomorrow)) return t('tomorrow');
  return d.toLocaleDateString();
}


const createStyles = themedStyles(() => {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, marginBottom: spacing.sm },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
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
  groupLabel: { color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, paddingVertical: spacing.md },
  });
});

let styles = createStyles();
