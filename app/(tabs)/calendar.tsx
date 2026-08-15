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
import { Pressable, ScrollView, StyleSheet, Text, View, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLifeOS } from '../../src/data/store';
import { CalendarItem, dayItems, dayItemsRange, monthGrid } from '../../src/features/calendar';
import { addDays, dateKey, formatDateKeyDDMM, startOfWeek, todayKey } from '../../src/core/time';
import { AppData } from '../../src/core/types';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Chip, ChipRow, EmptyState, IconButton } from '../../src/components/ui';
import { EventEditorModal } from '../../src/components/eventEditor';
import { TKey, useDateNames, useT } from '../../src/i18n';

type ViewMode = 'day' | 'week' | 'month' | 'year';

const WEEK_TIME_COL = 46;

export default function CalendarScreen() {
  styles = createStyles();
  const { width: windowWidth } = useWindowDimensions();
  const data = useLifeOS((s) => s.data);
  const remove = useLifeOS((s) => s.remove);
  const t = useT();
  const { months, monthsShort, weekdaysShort } = useDateNames();
  const [mode, setMode] = useState<ViewMode>('month');
  const [selected, setSelected] = useState<Date>(new Date());
  const [editingEvent, setEditingEvent] = useState<string | null | undefined>(undefined);
  const [editorOpen, setEditorOpen] = useState(false);
  const [gridW, setGridW] = useState(0);

  const monthDays = useMemo(() => monthGrid(selected.getFullYear(), selected.getMonth()), [selected]);
  const weekStart = startOfWeek(selected);
  const weekDays = useMemo(() => dayItemsRange(data, weekStart, addDays(weekStart, 6)), [data, weekStart]);
  const selectedDay = useMemo(() => dayItems(data, selected), [data, selected]);
  const weekHasToday = weekDays.some((d) => dateKey(d.date) === todayKey());
  const nowHour = new Date().getHours();
  const WEEK_HEADER_H = 40;
  const colW = Math.max((windowWidth - spacing.lg * 2 - WEEK_TIME_COL) / 7, 40);

  // All-day row: single-day events fill their whole day column; multi-day
  // events become ONE connected bar across their day columns (stacked into
  // lanes when several overlap), like the timed span bars below.
  const allDaySingles: { it: CalendarItem; di: number }[] = [];
  const allDaySpanMap = new Map<string, { item: CalendarItem; first: number; last: number }>();
  weekDays.forEach((d, di) => {
    for (const it of d.items) {
      if (!it.allDay && it.timeLabel) continue; // timed items live in the hour rows
      if (it.spanning && !it.recurring) {
        const g = allDaySpanMap.get(it.entityId) || { item: it, first: di, last: di };
        g.first = Math.min(g.first, di);
        g.last = Math.max(g.last, di);
        allDaySpanMap.set(it.entityId, g);
      } else {
        allDaySingles.push({ it, di });
      }
    }
  });
  const allDayLaneEnds: number[] = [];
  const allDayLane = new Map<string, number>();
  for (const g of [...allDaySpanMap.values()].sort((a, b) => a.first - b.first)) {
    let lane = allDayLaneEnds.findIndex((end) => end < g.first);
    if (lane === -1) {
      lane = allDayLaneEnds.length;
      allDayLaneEnds.push(-1);
    }
    allDayLaneEnds[lane] = g.last;
    allDayLane.set(g.item.entityId, lane);
  }
  const singlesPerDay = new Map<number, number>();
  for (const s of allDaySingles) singlesPerDay.set(s.di, (singlesPerDay.get(s.di) || 0) + 1);
  const maxSingles = Math.max(0, ...singlesPerDay.values());
  const allDayRowH = Math.max(30, maxSingles * 22 + 6, allDayLaneEnds.length * 22 + 8);

  // Timed area: one hour row = ROW_H px; items are positioned by minutes and
  // sized by duration, arranged side by side (lanes) instead of stacked.
  const ROW_H = 54;
  const toMin = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
  };
  const timedDays = weekDays.map((d, di) => {
    const timed = d.items.filter((it) => !!it.timeLabel && !it.allDay && !(it.spanning && !it.recurring));
    const items = timed
      .map((it) => {
        const startMin = toMin(it.timeLabel);
        let endMin = it.endTimeLabel ? toMin(it.endTimeLabel) : startMin + 60;
        if (endMin <= startMin) endMin += 24 * 60; // crosses midnight
        if (endMin - startMin > 24 * 60) endMin = startMin + 24 * 60;
        return { it, startMin, endMin };
      })
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    // Greedy lane assignment: reuse a lane whose last item already ended.
    const laneEnds: number[] = [];
    const blocks = items.map((x) => {
      let lane = laneEnds.findIndex((end) => end <= x.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(-1);
      }
      laneEnds[lane] = x.endMin;
      return { ...x, lane, laneTotal: 0 };
    });
    const laneTotal = Math.max(laneEnds.length, 1);
    blocks.forEach((b) => {
      b.laneTotal = laneTotal;
    });
    return { di, blocks };
  });
  // Multi-day timed events: ONE connected bar across their day columns.
  const timedSpanMap = new Map<string, { item: CalendarItem; first: number; last: number }>();
  weekDays.forEach((d, di) => {
    for (const it of d.items) {
      if (!it.timeLabel || it.allDay || !(it.spanning && !it.recurring)) continue;
      const g = timedSpanMap.get(it.entityId) || { item: it, first: di, last: di };
      g.first = Math.min(g.first, di);
      g.last = Math.max(g.last, di);
      timedSpanMap.set(it.entityId, g);
    }
  });

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
      ? `${weekdaysShort[(selected.getDay() + 6) % 7]} ${selected.getDate()} ${monthsShort[selected.getMonth()]} ${selected.getFullYear()}`
      : mode === 'week'
      ? `${weekStart.getDate()} – ${addDays(weekStart, 6).getDate()} ${monthsShort[weekStart.getMonth()]} ${weekStart.getFullYear()}`
      : mode === 'month'
      ? `${months[selected.getMonth()]} ${selected.getFullYear()}`
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ width: WEEK_TIME_COL + colW * 7, position: 'relative' }}>
              {/* Day headers */}
              <View style={[styles.weekGridRow, { height: WEEK_HEADER_H }]}>
                <View style={{ width: WEEK_TIME_COL }} />
                {weekDays.map((d, di) => (
                  <Pressable
                    key={dateKey(d.date)}
                    onPress={() => setSelected(d.date)}
                    style={[
                      styles.weekDayHead,
                      { width: colW },
                      dateKey(d.date) === todayKey() && styles.weekHeadToday,
                    ]}
                  >
                    <Text style={[styles.weekDow, dateKey(d.date) === dateKey(selected) && { color: colors.accent, fontWeight: '700' }]}>
                      {weekdaysShort[(d.date.getDay() + 6) % 7]}
                    </Text>
                    <Text style={[styles.weekDayNum, dateKey(d.date) === todayKey() && { color: colors.accent, fontWeight: '700' }]}>
                      {d.date.getDate()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* All-day / no-time row */}
              <View style={[styles.weekGridRow, { height: allDayRowH }]}>
                <Text style={[styles.weekTimeCell, styles.weekTimeLabel]}>{t('allDay')}</Text>
                {weekDays.map((d, di) => (
                  <View key={dateKey(d.date)} style={[styles.weekDayCell, { width: colW }]}>
                    {allDaySingles.filter((x) => x.di === di).map((x) => (
                      <WeekBlock key={x.it.id} item={x.it} onOpen={openEvent} onDelete={deleteItem} fullWidth />
                    ))}
                  </View>
                ))}
                {[...allDaySpanMap.values()].map((g) => (
                  <Pressable
                    key={g.item.id}
                    onPress={() => openEvent(g.item.entityId)}
                    onLongPress={() => deleteItem(g.item)}
                    style={[
                      styles.weekSpanBar,
                      {
                        left: WEEK_TIME_COL + g.first * colW,
                        width: (g.last - g.first + 1) * colW,
                        top: 6 + (allDayLane.get(g.item.entityId) ?? 0) * 22,
                        backgroundColor: (g.item.color || colors.accent) + '22',
                        borderLeftColor: g.item.color || colors.accent,
                      },
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.weekSpanText}>
                      {g.item.title}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Hour rows (background gridlines only) */}
              {Array.from({ length: 24 }, (_, h) => {
                const isNow = weekHasToday && h === nowHour;
                return (
                  <View key={h} style={[styles.weekGridRow, { height: ROW_H }, isNow && styles.weekRowNow]}>
                    <Text style={[styles.weekTimeCell, styles.weekTimeLabel, isNow && { color: colors.danger }]}>
                      {String(h).padStart(2, '0')}:00
                    </Text>
                    {weekDays.map((d) => (
                      <View key={dateKey(d.date)} style={[styles.weekDayCell, { width: colW }]} />
                    ))}
                  </View>
                );
              })}

              {/* Timed overlay: duration-proportional blocks side by side
                  (lanes), plus connected bars for multi-day events. */}
              <View pointerEvents="box-none" style={[styles.timedOverlay, { top: WEEK_HEADER_H + allDayRowH, height: 24 * ROW_H }]}>
                {timedDays.map(({ di, blocks }) => {
                  const laneW = colW / Math.max(...blocks.map((b) => b.laneTotal), 1);
                  return blocks.map((b) => {
                    const top = (b.startMin / 60) * ROW_H;
                    const height = Math.max(((b.endMin - b.startMin) / 60) * ROW_H, 16);
                    return (
                      <Pressable
                        key={b.it.id}
                        onPress={() => openEvent(b.it.entityId)}
                        onLongPress={() => deleteItem(b.it)}
                        style={[
                          styles.weekBlockAbs,
                          {
                            left: di * colW + b.lane * laneW,
                            width: laneW - 1,
                            top,
                            height,
                            backgroundColor: (b.it.color || colors.accent) + '22',
                            borderLeftColor: b.it.color || (b.it.kind === 'task' ? colors.textMuted : colors.accent),
                          },
                        ]}
                      >
                        {b.it.timeLabel ? <Text style={styles.weekBlockTime}>{b.it.timeLabel}</Text> : null}
                        <Text numberOfLines={3} style={[styles.weekBlockTitle, b.it.done && { textDecorationLine: 'line-through', color: colors.textMuted }]}>
                          {b.it.title}
                        </Text>
                      </Pressable>
                    );
                  });
                })}
                {[...timedSpanMap.values()].map((g) => {
                  const startMin = toMin(g.item.timeLabel);
                  const endT = g.item.endTimeLabel ? toMin(g.item.endTimeLabel) : startMin + 60;
                  const daysSpan = g.last - g.first;
                  let durMin = endT - startMin + daysSpan * 24 * 60;
                  if (durMin <= 0) durMin = 60;
                  return (
                    <Pressable
                      key={g.item.id}
                      onPress={() => openEvent(g.item.entityId)}
                      onLongPress={() => deleteItem(g.item)}
                      style={[
                        styles.weekSpanBar,
                        {
                          left: g.first * colW,
                          width: (g.last - g.first + 1) * colW,
                          top: (startMin / 60) * ROW_H,
                          height: Math.max((durMin / 60) * ROW_H, 16),
                          backgroundColor: (g.item.color || colors.accent) + '22',
                          borderLeftColor: g.item.color || colors.accent,
                        },
                      ]}
                    >
                      <Text numberOfLines={1} style={styles.weekSpanText}>
                        {g.item.timeLabel} {g.item.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        )}

        {mode === 'month' && (
          <>
            <View style={styles.weekRow}>
              {weekdaysShort.map((w) => (
                <Text key={w} style={styles.weekday}>{w}</Text>
              ))}
            </View>
            <View style={styles.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
              {monthDays.map((day) => {
  styles = createStyles();
                const inMonth = day.getMonth() === selected.getMonth();
                const isToday = dateKey(day) === todayKey();
                const isSelected = dateKey(day) === dateKey(selected);
                const items = dayItems(data, day).items;
                // Multi-day events are drawn as spanning bars; everything else
                // (single-day events, recurring instances) gets a dot.
                const dotEvents = items.filter((i) => i.kind === 'event' && !(i.spanning && !i.recurring));
                const hasDeadline = items.some((i) => i.kind === 'task' && !i.done);
                return (
                  <Pressable
                    key={dateKey(day)}
                    onPress={() => setSelected(day)}
                    style={[styles.cell, isSelected ? styles.cellSelected : hasDeadline ? styles.cellDeadline : null]}
                  >
                    <Text style={[styles.cellDay, !inMonth && styles.cellDim, isToday && styles.cellToday]}>{day.getDate()}</Text>
                    <View style={styles.cellDots}>
                      {dotEvents.slice(0, 3).map((ev) => (
                        <View key={ev.id} style={[styles.cellDot, { backgroundColor: ev.color || colors.accent }]} />
                      ))}
                      {dotEvents.length > 3 ? <Text style={styles.cellMore}>+{dotEvents.length - 3}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
              {gridW > 0 && <MonthSpanBars monthDays={monthDays} data={data} gridW={gridW} />}
            </View>
            <SectionTitle text={formatDateKeyDDMM(dateKey(selected))} />
            <DayTimeline items={selectedDay.items} date={selected} onOpen={openEvent} onDelete={deleteItem} />
          </>
        )}

        {mode === 'year' && (
          <View style={styles.yearGrid}>
            {months.map((name, m) => (
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

function WeekBlock({
  item,
  onOpen,
  onDelete,
  fullWidth,
}: {
  item: CalendarItem;
  onOpen: (id: string) => void;
  onDelete: (it: CalendarItem) => void;
  /** Fill the whole day column (all-day row). */
  fullWidth?: boolean;
}) {
  styles = createStyles();
  return (
    <Pressable
      onPress={() => onOpen(item.entityId)}
      onLongPress={() => onDelete(item)}
      style={[
        styles.weekBlock,
        fullWidth && styles.weekBlockFull,
        { backgroundColor: (item.color || colors.accent) + '22', borderLeftColor: item.color || (item.kind === 'task' ? colors.textMuted : colors.accent) },
      ]}
    >
      {item.timeLabel ? <Text style={styles.weekBlockTime}>{item.timeLabel}</Text> : null}
      <Text numberOfLines={1} style={[styles.weekBlockTitle, item.done && { textDecorationLine: 'line-through', color: colors.textMuted }]}>
        {item.title}
      </Text>
    </Pressable>
  );
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
// Multi-day span bars (month grid)
// ---------------------------------------------------------------------------

/**
 * Multi-day events drawn as continuous bars along the bottom of the month-grid
 * cells they cover. A bar crossing a week boundary continues on the next row.
 * Single-day events are rendered as dots in the cell instead.
 */
function MonthSpanBars({ monthDays, data, gridW }: { monthDays: Date[]; data: AppData; gridW: number }) {
  styles = createStyles();
  type Seg = { row: number; c0: number; c1: number; color: string };
  const rows = new Map<number, Seg[]>();
  const pushSeg = (row: number, c0: number, c1: number, color: string) => {
    const arr = rows.get(row) || [];
    arr.push({ row, c0, c1, color });
    rows.set(row, arr);
  };

  // Collect the grid-cell index of every day each multi-day event covers.
  const map = new Map<string, { color?: string; indices: number[] }>();
  monthDays.forEach((day, idx) => {
    for (const it of dayItems(data, day).items) {
      if (it.kind === 'event' && it.spanning && !it.recurring) {
        let g = map.get(it.entityId);
        if (!g) {
          g = { color: it.color, indices: [] };
          map.set(it.entityId, g);
        }
        g.indices.push(idx);
      }
    }
  });

  // Split each event's (contiguous) indices into per-row column segments.
  for (const s of map.values()) {
    const color = s.color || colors.accent;
    let row = -1;
    let c0 = 0;
    let c1 = 0;
    for (const idx of s.indices) {
      const r = Math.floor(idx / 7);
      const c = idx % 7;
      if (r !== row) {
        if (row >= 0) pushSeg(row, c0, c1, color);
        row = r;
        c0 = c;
        c1 = c;
      } else {
        c1 = c;
      }
    }
    if (row >= 0) pushSeg(row, c0, c1, color);
  }

  const cell = gridW / 7;
  const barH = 3;
  const gap = 1;
  const bars: React.ReactNode[] = [];
  for (const [row, segs] of rows) {
    const sorted = [...segs].sort((a, b) => a.c0 - b.c0);
    // Stack overlapping segments into lanes so they don't hide each other.
    const laneEnds: number[] = [];
    sorted.forEach((seg, i) => {
      let lane = laneEnds.findIndex((end) => end < seg.c0);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(-1);
      }
      laneEnds[lane] = seg.c1;
      bars.push(
        <View
          key={`${row}-${seg.c0}-${i}`}
          pointerEvents="none"
          style={[
            styles.monthSpanBar,
            {
              left: seg.c0 * cell,
              top: (row + 1) * cell - barH - 7 - lane * (barH + gap),
              width: (seg.c1 - seg.c0 + 1) * cell,
              backgroundColor: seg.color,
            },
          ]}
        />
      );
    });
  }
  return <>{bars}</>;
}

// ---------------------------------------------------------------------------
// Year mini-months
// ---------------------------------------------------------------------------

function MiniMonth({ year, month, data }: { year: number; month: number; data: ReturnType<typeof useLifeOS.getState>['data'] }) {
  styles = createStyles();
  const { months } = useDateNames();
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
                  <View key={ev.id} style={[styles.cellLineShort, { backgroundColor: ev.color || colors.accent }]} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', position: 'relative' },
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
  cellLineShort: { width: 9, height: 3, borderRadius: 1.5 },
  cellLine: { flex: 1, height: 3, borderRadius: 1.5, maxWidth: 18 },
  cellMore: { fontSize: 8, color: colors.textMuted, fontWeight: '700' },
  monthSpanBar: { position: 'absolute', height: 3, borderRadius: 1.5 },

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

  // week (time table)
  weekRow: { flexDirection: 'row', gap: spacing.xs },
  weekGridRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, minHeight: 30, alignItems: 'stretch', position: 'relative' },
  weekTimeCell: { width: 46, justifyContent: 'center', paddingLeft: 4 },
  weekTimeLabel: { fontSize: 10, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  weekDayHead: { alignItems: 'center', paddingVertical: 4 },
  weekHeadToday: { backgroundColor: colors.accentSoft },
  weekDow: { fontSize: 10, color: colors.textSecondary },
  weekDayNum: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 2 },
  weekDayCell: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    padding: 1,
  },
  weekRowNow: { backgroundColor: colors.danger + '0D' },
  timedOverlay: { position: 'absolute', left: WEEK_TIME_COL, right: 0, overflow: 'hidden' },
  weekBlockAbs: {
    position: 'absolute',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: 'hidden',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  weekSpanBar: {
    position: 'absolute',
    top: 5,
    height: 20,
    borderRadius: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    overflow: 'hidden',
  },
  weekSpanText: { fontSize: 9, color: colors.text, fontWeight: '600' },
  weekBlock: {
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginBottom: 1,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  weekBlockFull: { width: '100%', alignSelf: 'stretch' },
  weekBlockTime: { fontSize: 9, color: colors.textSecondary, fontWeight: '700' },
  weekBlockTitle: { fontSize: 10, color: colors.text, fontWeight: '500' },
  weekItemBar: { width: 3, height: 24, borderRadius: 1.5, alignSelf: 'stretch' },

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

