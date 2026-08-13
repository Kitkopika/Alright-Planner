/**
 * Calendar — day / week / month / agenda views for events, deadlines and
 * tasks, with recurrence support and an event editor.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLifeOS } from '../../src/data/store';
import { CalendarItem, dayItems, dayItemsRange, monthGrid } from '../../src/features/calendar';
import { addDays, dateKey, startOfWeek, todayKey } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Card, Chip, ChipRow, EmptyState, IconButton, SectionHeader } from '../../src/components/ui';
import { EventEditorModal } from '../../src/components/eventEditor';

type ViewMode = 'day' | 'week' | 'month' | 'agenda';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  const data = useLifeOS((s) => s.data);
  const [mode, setMode] = useState<ViewMode>('month');
  const [selected, setSelected] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<string | null | undefined>(undefined);
  const [editorOpen, setEditorOpen] = useState(false);

  const today = new Date();

  const monthDays = useMemo(() => {
    const d = selected;
    return monthGrid(d.getFullYear(), d.getMonth());
  }, [selected]);

  const weekStart = startOfWeek(selected);
  const weekDays = useMemo(() => dayItemsRange(data, weekStart, addDays(weekStart, 6)), [data, weekStart]);

  const selectedDay = useMemo(() => dayItems(data, selected), [data, selected]);

  const agenda = useMemo(() => dayItemsRange(data, today, addDays(today, 30)), [data]);

  const openEvent = (entityId: string) => {
    setEditingEvent(entityId);
    setEditorOpen(true);
  };

  const newEvent = () => {
    setEditingEvent(null);
    setEditorOpen(true);
  };

  const monthLabel = `${['January','February','March','April','May','June','July','August','September','October','November','December'][selected.getMonth()]} ${selected.getFullYear()}`;

  return (
    <View style={styles.screen}>
      {/* Controls */}
      <View style={styles.controls}>
        <ChipRow>
          {(['day', 'week', 'month', 'agenda'] as ViewMode[]).map((m) => (
            <Chip key={m} label={m[0].toUpperCase() + m.slice(1)} selected={mode === m} onPress={() => setMode(m)} />
          ))}
        </ChipRow>
        <View style={styles.navRow}>
          <IconButton name="chevron-back" onPress={() => setSelected((d) => (mode === 'month' ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : addDays(d, -1)))} />
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <IconButton name="chevron-forward" onPress={() => setSelected((d) => (mode === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : addDays(d, 1)))} />
          <Pressable onPress={() => setSelected(new Date())} hitSlop={8}>
            <Text style={styles.todayLink}>Today</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {mode === 'month' && (
          <>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>{w}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {monthDays.map((day) => {
                const inMonth = day.getMonth() === selected.getMonth();
                const isToday = dateKey(day) === todayKey();
                const isSelected = dateKey(day) === dateKey(selected);
                const hasItems = dayItems(data, day).items.length > 0;
                return (
                  <Pressable
                    key={dateKey(day)}
                    onPress={() => setSelected(day)}
                    style={[styles.cell, isSelected && styles.cellSelected]}
                  >
                    <Text style={[styles.cellDay, !inMonth && styles.cellDim, isToday && styles.cellToday]}>
                      {day.getDate()}
                    </Text>
                    {hasItems && <View style={[styles.cellDot, isToday && { backgroundColor: colors.accent }]} />}
                  </Pressable>
                );
              })}
            </View>
            <DayList day={selectedDay} onOpen={openEvent} />
          </>
        )}

        {mode === 'day' && <DayList day={selectedDay} onOpen={openEvent} />}

        {mode === 'week' && (
          <>
            <View style={styles.weekStrip}>
              {weekDays.map((d) => {
                const isToday = dateKey(d.date) === todayKey();
                const isSelected = dateKey(d.date) === dateKey(selected);
                return (
                  <Pressable
                    key={dateKey(d.date)}
                    onPress={() => setSelected(d.date)}
                    style={[styles.stripCell, isSelected && styles.stripCellSelected]}
                  >
                    <Text style={[styles.stripDow, isToday && { color: colors.accent }]}>{WEEKDAYS[(d.date.getDay() + 6) % 7]}</Text>
                    <Text style={[styles.stripDay, isToday && { color: colors.accent, fontWeight: '700' }]}>{d.date.getDate()}</Text>
                    <View style={styles.stripDots}>
                      {d.items.slice(0, 3).map((it) => (
                        <View key={it.id} style={[styles.miniDot, { backgroundColor: it.color || (it.kind === 'task' ? colors.textMuted : colors.accent) }]} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {weekDays.map((d) => (
              <DayList key={dateKey(d.date)} day={d} onOpen={openEvent} showHeader />
            ))}
          </>
        )}

        {mode === 'agenda' && (
          <>
            <SectionHeader title="Upcoming 30 days" />
            {agenda.filter((d) => d.items.length > 0).length === 0 ? (
              <EmptyState icon="calendar-outline" title="Nothing upcoming" />
            ) : (
              agenda
                .filter((d) => d.items.length > 0)
                .map((d) => (
                  <View key={dateKey(d.date)}>
                    <Text style={styles.agendaDate}>{dateKey(d.date) === todayKey() ? 'Today' : dateKey(d.date)}</Text>
                    <DayList day={d} onOpen={openEvent} />
                  </View>
                ))
            )}
          </>
        )}
      </ScrollView>

      {/* New event FAB-ish button */}
      <Pressable style={styles.addBtn} onPress={newEvent}>
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      <EventEditorModal eventId={editingEvent} visible={editorOpen} onClose={() => setEditorOpen(false)} />
    </View>
  );
}

function DayList({
  day,
  onOpen,
  showHeader,
}: {
  day: { date: Date; items: CalendarItem[] };
  onOpen: (entityId: string) => void;
  showHeader?: boolean;
}) {
  return (
    <View style={{ marginTop: showHeader ? spacing.lg : spacing.md }}>
      {day.items.length === 0 ? (
        <EmptyState icon="calendar-clear-outline" title="Nothing on this day" />
      ) : (
        day.items.map((item) => (
          <Card key={item.id} style={styles.item} onPress={() => onOpen(item.entityId)}>
            <View style={[styles.itemBar, { backgroundColor: item.color || (item.kind === 'event' ? colors.accent : colors.textMuted) }]} />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.body,
                  item.done && { textDecorationLine: 'line-through', color: colors.textMuted },
                ]}
              >
                {item.title}
              </Text>
              <Text style={typography.caption}>
                {item.kind === 'event' ? 'Event' : item.overdue ? 'Task · overdue' : 'Task'} {item.timeLabel ? `· ${item.timeLabel}` : ''}
              </Text>
            </View>
            <Ionicons name={item.kind === 'event' ? 'calendar-outline' : 'checkbox-outline'} size={18} color={colors.textMuted} />
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  monthLabel: { ...typography.section, flex: 1, textAlign: 'center' },
  todayLink: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekday: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  cellSelected: { backgroundColor: colors.accentSoft },
  cellDay: { fontSize: 14, color: colors.text },
  cellDim: { color: colors.textMuted },
  cellToday: { color: colors.accent, fontWeight: '700' },
  cellDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
  },
  itemBar: { width: 4, height: '100%', borderRadius: 2 },
  weekStrip: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  stripCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stripCellSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  stripDow: { fontSize: 11, color: colors.textSecondary },
  stripDay: { fontSize: 16, fontWeight: '600', color: colors.text, marginVertical: 2 },
  stripDots: { flexDirection: 'row', gap: 2, marginTop: 2, height: 6 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  agendaDate: { ...typography.label, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  addBtn: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 90,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
