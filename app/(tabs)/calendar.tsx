/**
 * Calendar — day / week / month / year views.
 *   - Day:  a scrollable 24-hour timeline (all-day section + "now" line).
 *   - Week: 7 columns side by side, each showing that day's timeline items.
 *   - Month: normal month grid; tapping a day shows its timeline below.
 *   - Year: 12 mini-month overview; tapping a month opens it.
 * Events and tasks (deadlines) both appear. Tapping an item edits it,
 * long-pressing deletes it.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLifeOS } from '../../src/data/store';
import { CalendarItem, dayItems, dayItemsRange, monthGrid } from '../../src/features/calendar';
import { addDays, dateKey, formatDateKeyDDMM, startOfWeek, todayKey } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Chip, ChipRow, EmptyState, IconButton } from '../../src/components/ui';
import { EventEditorModal } from '../../src/components/eventEditor';
import { useT } from '../../src/i18n';

type ViewMode = 'day' | 'week' | 'month' | 'year';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarScreen() {
  styles = createStyles();
  const data = useLifeOS((s) => s.data);
  const remove = useLifeOS((s) => s.remove);
  const t = useT();
  const [mode, setMode] = useState<ViewMode>('month');
  const [selected, setSelected] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<string | null | undefined>(undefined);
  const [editorOpen, setEditorOpen] = useState(false);

  const monthDays = useMemo(() => monthGrid(selected.getFullYear(), selected.getMonth()), [selected]);
  const weekStart = startOfWeek(selected);
  const weekDays = useMemo(() => dayItemsRange(data, weekStart, addDays(weekStart, 6)), [data, weekStart]);
  const selectedDay = useMemo(() => dayItems(data, selected), [data, selected]);

  const openEvent = (entityId: string) => {
    setEditingEvent(entityId);
    setEditorOpen(true);
  };

  const deleteItem = (item: CalendarItem) => {
    Alert.alert(t('deleteQ'), item.title, [
      { text: 'Delete', style: 'destructive', onPress: () => remove(item.kind === 'event' ? 'events' : 'tasks', item.entityId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const shift = (delta: number) => {
    setSelected((d) => {
      switch (mode) {
        case 'day': return addDays(d, delta);
        case 'week': return addDays(d, delta * 7);
        case 'month': return new Date(d.getFullYear(), d.getMonth() + delta, 1);
        case 'year': return new Date(d.getFullYear() + delta, d.getMonth(), 1);
      }
    });
  };

  const label =
    mode === 'day'
      ? `${WEEKDAYS[(selected.getDay() + 6) % 7]} ${selected.getDate()} ${MONTH_NAMES[selected.getMonth()].slice(0, 3)} ${selected.getFullYear()}`
      : mode === 'week'
      ? `${weekStart.getDate()} – ${addDays(weekStart, 6).getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0, 3)} ${weekStart.getFullYear()}`
      : mode === 'month'
      ? `${MONTH_NAMES[selected.getMonth()]} ${selected.getFullYear()}`
      : `${selected.getFullYear()}`;

  const newEvent = () => {
    setEditingEvent(null);
    setEditorOpen(true);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <View style={styles.modeRow}>
          <ChipRow style={{ flex: 1 }}>
            {(['day', 'week', 'month', 'year'] as ViewMode[]).map((m) => (
              <Chip key={m} label={t(m)} selected={mode === m} onPress={() => setMode(m)} />
            ))}
          </ChipRow>
          <IconButton name="add-circle-outline" size={26} color={colors.accent} onPress={newEvent} />
        </View>
        <View style={styles.navRow}>
          <IconButton name="chevron-back" onPress={() => shift(-1)} />
          <Text style={styles.monthLabel}>{label}</Text>
          <IconButton name="chevron-forward" onPress={() => shift(1)} />
          <Pressable onPress={() => { setSelected(new Date()); setMode('day'); }} hitSlop={8}>
            <Text style={styles.todayLink}>{t('todayLabel')}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {mode === 'day' && <DayTimeline items={selectedDay.items} date={selected} onOpen={openEvent} onDelete={deleteItem} />}

        {mode === 'week' && (
          <View style={styles.weekRow}>
            {weekDays.map((d) => (
              <View key={dateKey(d.date)} style={styles.weekCol}>
                <Pressable onPress={() => setSelected(d.date)} style={[styles.weekHead, dateKey(d.date) === todayKey() && styles.weekHeadToday]}>
                  <Text style={[styles.weekDow, dateKey(d.date) === dateKey(selected) && { color: colors.accent, fontWeight: '700' }]}>
                    {WEEKDAYS[(d.date.getDay() + 6) % 7]}
                  </Text>
                  <Text style={[styles.weekDayNum, dateKey(d.date) === todayKey() && { color: colors.accent, fontWeight: '700' }]}>
                    {d.date.getDate()}
                  </Text>
                </Pressable>
                <View style={styles.weekItems}>
                  {d.items.map((it) => (
                    <Pressable
                      key={it.id}
                      onPress={() => openEvent(it.entityId)}
                      onLongPress={() => deleteItem(it)}
                      style={[styles.weekItem, { backgroundColor: (it.color || colors.accent) + '22' }]}
                    >
                      <View style={[styles.weekItemBar, { backgroundColor: it.color || (it.kind === 'task' ? colors.textMuted : colors.accent) }]} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {it.timeLabel || it.allDay ? <Text style={styles.weekItemTime}>{it.timeLabel || t('allDay')}</Text> : null}
                        <Text numberOfLines={1} style={styles.weekItemTitle}>{it.title}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {mode === 'month' && (
          <>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>{w}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {monthDays.map((day) => {
  styles = createStyles();
                const inMonth = day.getMonth() === selected.getMonth();
                const isToday = dateKey(day) === todayKey();
                const isSelected = dateKey(day) === dateKey(selected);
                const items = dayItems(data, day).items;
                const events = items.filter((i) => i.kind === 'event');
                const hasDeadline = items.some((i) => i.kind === 'task' && !i.done);
                return (
                  <Pressable
                    key={dateKey(day)}
                    onPress={() => setSelected(day)}
                    style={[styles.cell, isSelected ? styles.cellSelected : hasDeadline ? styles.cellDeadline : null]}
                  >
                    <Text style={[styles.cellDay, !inMonth && styles.cellDim, isToday && styles.cellToday]}>{day.getDate()}</Text>
                    <View style={styles.cellDots}>
                      {events.slice(0, 3).map((ev) =>
                        ev.spanning ? (
                          <View key={ev.id} style={[styles.cellLine, { backgroundColor: ev.color || colors.accent }]} />
                        ) : (
                          <View key={ev.id} style={[styles.cellDot, { backgroundColor: ev.color || colors.accent }]} />
                        )
                      )}
                      {events.length > 3 ? <Text style={styles.cellMore}>+{events.length - 3}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <SectionTitle text={formatDateKeyDDMM(dateKey(selected))} />
            <DayTimeline items={selectedDay.items} date={selected} onOpen={openEvent} onDelete={deleteItem} />
          </>
        )}

        {mode === 'year' && (
          <View style={styles.yearGrid}>
            {MONTH_NAMES.map((name, m) => (
              <Pressable
                key={name}
                style={styles.yearMonth}
                onPress={() => { setSelected(new Date(selected.getFullYear(), m, 1)); setMode('month'); }}
              >
                <Text style={styles.yearMonthTitle}>{name}</Text>
                <MiniMonth year={selected.getFullYear()} month={m} data={data} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <EventEditorModal eventId={editingEvent} visible={editorOpen} onClose={() => setEditorOpen(false)} initialDate={dateKey(selected)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Day timeline
// ---------------------------------------------------------------------------

function SectionTitle({ text }: { text: string }) {
  styles = createStyles();
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function DayTimeline({
  items,
  date,
  onOpen,
  onDelete,
}: {
  items: CalendarItem[];
  date: Date;
  onOpen: (entityId: string) => void;
  onDelete: (item: CalendarItem) => void;
}) {
  styles = createStyles();
  const t = useT();
  const allDay = items.filter((i) => i.allDay);
  const timed = items.filter((i) => !i.allDay);
  const byHour = new Map<number, CalendarItem[]>();
  for (const it of timed) {
    const h = it.timeLabel ? parseInt(it.timeLabel.slice(0, 2), 10) || 0 : 0;
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push(it);
  }
  const isToday = dateKey(date) === todayKey();
  const nowHour = new Date().getHours();

  if (items.length === 0) {
    return <EmptyState icon="calendar-clear-outline" title={t('nothingScheduled')} subtitle={t('nothingScheduledSub')} />;
  }

  return (
    <View>
      {allDay.length > 0 && (
        <View style={styles.allDaySection}>
          <Text style={styles.allDayLabel}>All day</Text>
          {allDay.map((it) => (
            <Pressable
              key={it.id}
              onPress={() => onOpen(it.entityId)}
              onLongPress={() => onDelete(it)}
              style={[styles.allDayChip, { backgroundColor: (it.color || colors.accent) + '22' }]}
            >
              <View style={[styles.weekItemBar, { backgroundColor: it.color || colors.accent }]} />
              <Text style={styles.allDayText} numberOfLines={1}>{it.title}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {Array.from({ length: 24 }, (_, h) => {
  styles = createStyles();
        const hourItems = byHour.get(h) || [];
        const isNow = isToday && h === nowHour;
        return (
          <View key={h} style={[styles.hourRow, isNow && styles.hourRowNow]}>
            <Text style={styles.hourLabel}>{String(h).padStart(2, '0')}:00</Text>
            <View style={styles.hourBody}>
              {isNow && <View style={styles.nowLine} />}
              {hourItems.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => onOpen(it.entityId)}
                  onLongPress={() => onDelete(it)}
                  style={[styles.timelineItem, { backgroundColor: (it.color || colors.accent) + '22' }]}
                >
                  <View style={[styles.weekItemBar, { backgroundColor: it.color || (it.kind === 'task' ? colors.textMuted : colors.accent) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timelineTitle, it.done && { textDecorationLine: 'line-through', color: colors.textMuted }]} numberOfLines={1}>
                      {it.title}
                    </Text>
                    <Text style={styles.timelineTime}>{it.timeLabel}{it.kind === 'task' ? ` · ${t('typeTask')}` : ''}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Year mini-months
// ---------------------------------------------------------------------------

function MiniMonth({ year, month, data }: { year: number; month: number; data: ReturnType<typeof useLifeOS.getState>['data'] }) {
  styles = createStyles();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const todayK = todayKey();

  return (
    <View style={styles.miniGrid}>
      {cells.map((d, i) => {
  styles = createStyles();
        if (d == null) return <View key={`e${i}`} style={styles.miniCell} />;
        const day = new Date(year, month, d);
        const items = dayItems(data, day).items;
        const events = items.filter((it) => it.kind === 'event');
        const hasDeadline = items.some((it) => it.kind === 'task' && !it.done);
        const isToday = dateKey(day) === todayK;
        return (
          <View key={i} style={[styles.miniCell, isToday ? styles.miniCellToday : hasDeadline ? styles.miniCellDeadline : null]}>
            <Text style={styles.miniDayNum}>{d}</Text>
            <View style={styles.cellDots}>
              {events.slice(0, 2).map((ev) =>
                ev.spanning ? (
                  <View key={ev.id} style={[styles.cellLine, { backgroundColor: ev.color || colors.accent }]} />
                ) : (
                  <View key={ev.id} style={[styles.cellDot, { backgroundColor: ev.color || colors.accent }]} />
                )
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  monthLabel: { ...typography.section, flex: 1, textAlign: 'center' },
  todayLink: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  content: { padding: spacing.lg, paddingBottom: 120 },

  // month grid
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
  cellDeadline: { backgroundColor: colors.danger + '1A' },
  cellDay: { fontSize: 14, color: colors.text },
  cellDim: { color: colors.textMuted },
  cellToday: { color: colors.accent, fontWeight: '700' },
  cellDots: { flexDirection: 'row', gap: 2, marginTop: 2, minHeight: 5, alignItems: 'center' },
  cellDot: { width: 5, height: 5, borderRadius: 2.5 },
  cellLine: { flex: 1, height: 3, borderRadius: 1.5, maxWidth: 18 },
  cellMore: { fontSize: 8, color: colors.textMuted, fontWeight: '700' },

  sectionTitle: { ...typography.label, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.xs },

  // timeline
  allDaySection: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  allDayLabel: { ...typography.caption, color: colors.textMuted, marginRight: spacing.xs },
  allDayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  allDayText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  hourRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    minHeight: 40,
  },
  hourRowNow: { borderTopColor: colors.danger },
  hourLabel: { width: 44, paddingTop: 4, fontSize: 11, color: colors.textMuted },
  hourBody: { flex: 1, paddingBottom: spacing.xs },
  nowLine: { height: 2, backgroundColor: colors.danger, marginVertical: 2 },
  timelineItem: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: 2,
  },
  timelineTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  timelineTime: { fontSize: 11, color: colors.textSecondary },

  // week
  weekRow: { flexDirection: 'row', gap: spacing.xs },
  weekCol: { flex: 1, minWidth: 0 },
  weekHead: { alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.sm },
  weekHeadToday: { backgroundColor: colors.accentSoft },
  weekDow: { fontSize: 10, color: colors.textSecondary },
  weekDayNum: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  weekItems: { gap: 2, marginTop: 2 },
  weekItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  weekItemBar: { width: 3, height: 26, borderRadius: 1.5, alignSelf: 'stretch' },
  weekItemTitle: { flex: 1, fontSize: 10, color: colors.text, fontWeight: '500' },
  weekItemTime: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

  // year
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  yearMonth: { width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  yearMonthTitle: { ...typography.label, marginBottom: 4 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  miniCell: { width: `${100 / 7}%`, aspectRatio: 1.6, alignItems: 'center', justifyContent: 'center' },
  miniCellToday: { backgroundColor: colors.accentSoft, borderRadius: 4 },
  miniCellDeadline: { backgroundColor: colors.danger + '1A', borderRadius: 4 },
  miniDayNum: { fontSize: 9, color: colors.textSecondary },
  });
}

