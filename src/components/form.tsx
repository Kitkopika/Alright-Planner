/**
 * Form primitives for dates, times, recurrence and money.
 *
 * Date/Time use real UI pickers (a month-grid date picker and a time grid),
 * rendered with pure React Native so they work identically on Android, iOS
 * and web — no native module, no raw text input.
 */

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Recurrence, RecurrenceFreq } from '../core/types';
import { addDays, dateKey, formatDateKeyDDMM, todayKey, tryParseISO, parseDateKey } from '../core/time';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Chip, ChipRow, Field, TextBox } from './ui';
import { TKey, useDateNames, useT } from '../i18n';

// ---------------------------------------------------------------------------
// Date (YYYY-MM-DD) — UI picker
// ---------------------------------------------------------------------------

/** Monday-based month grid (42 cells, leading/trailing nulls). */
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePickerModal({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (dk: string) => void;
  onClose: () => void;
}) {
  styles = createStyles();
  const initial = value && tryParseISO(value) ? parseDateKey(value) : new Date();
  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const cells = monthCells(view.getFullYear(), view.getMonth());
  const t = useT();
  const { months, weekdaysShortMon } = useDateNames();
  const pick = (dk: string) => {
    onSelect(dk);
    onClose();
  };
  const shift = (delta: number) => setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => shift(-1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.pickerTitle}>{months[view.getMonth()]} {view.getFullYear()}</Text>
            <Pressable onPress={() => shift(1)} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.pickerWeekRow}>
            {weekdaysShortMon.map((d) => (
              <Text key={d} style={styles.pickerWeek}>{d}</Text>
            ))}
          </View>
          <View style={styles.pickerGrid}>
            {cells.map((d, i) => {
  styles = createStyles();
              if (!d) return <View key={i} style={styles.pickerCell} />;
              const dk = dateKey(d);
              const selected = dk === value;
              const isToday = dk === todayKey();
              return (
                <Pressable key={i} onPress={() => pick(dk)} style={[styles.pickerCell, selected && styles.pickerCellSelected]}>
                  <Text style={[styles.pickerDay, selected && { color: '#FFFFFF' }, isToday && !selected && { color: colors.accent, fontWeight: '700' }]}>
                    {d.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.pickerFooter}>
            <Button title={t('todayLabel')} variant="ghost" small onPress={() => pick(todayKey())} />
            <Button title={t('cancel')} variant="ghost" small onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DateField({
  label = 'Date',
  value,
  onChange,
  allowClear = true,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
}) {
  styles = createStyles();
  const [open, setOpen] = useState(false);
  const t = useT();
  const quick = (d: Date) => onChange(dateKey(d));

  return (
    <Field label={label}>
      <Pressable style={styles.pickerInput} onPress={() => setOpen(true)}>
        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.pickerInputText, !value && { color: colors.textMuted }]}>{value ? formatDateKeyDDMM(value) : t('selectDate')}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      <ChipRow style={{ marginTop: 6 }}>
        <Chip label={t('todayLabel')} onPress={() => quick(new Date())} />
        <Chip label={t('tomorrow')} onPress={() => quick(addDays(new Date(), 1))} />
        <Chip label="+1w" onPress={() => quick(addDays(new Date(), 7))} />
        <Chip label="+1m" onPress={() => quick(addDays(new Date(), 30))} />
        {allowClear && <Chip label={t('clear')} onPress={() => onChange('')} />}
      </ChipRow>
      <DatePickerModal visible={open} value={value} onSelect={onChange} onClose={() => setOpen(false)} />
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Time (HH:mm) — UI picker
// ---------------------------------------------------------------------------

export function TimePickerModal({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: string;
  onSelect: (time: string) => void;
  onClose: () => void;
}) {
  styles = createStyles();
  const [hh, setHh] = useState(value ? parseInt(value.slice(0, 2), 10) || 0 : 9);
  const [mm, setMm] = useState(value ? parseInt(value.slice(3, 5), 10) || 0 : 0);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const t = useT();
  const ok = () => {
    onSelect(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerCard} onPress={() => {}}>
          <Text style={[styles.pickerTitle, { textAlign: 'center', marginBottom: spacing.md }]}>{t('selectTime')}</Text>
          <ScrollView style={{ maxHeight: 320 }}>
            <Text style={styles.pickerSectionLabel}>{t('hour')}</Text>
            <View style={styles.pickerSection}>
              {Array.from({ length: 24 }, (_, h) => (
                <Pressable key={h} onPress={() => setHh(h)} style={[styles.chipSmall, hh === h && styles.chipSmallOn]}>
                  <Text style={[styles.chipSmallText, hh === h && { color: '#FFFFFF' }]}>{String(h).padStart(2, '0')}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.pickerSectionLabel}>{t('minute')}</Text>
            <View style={styles.pickerSection}>
              {minutes.map((m) => (
                <Pressable key={m} onPress={() => setMm(m)} style={[styles.chipSmall, mm === m && styles.chipSmallOn]}>
                  <Text style={[styles.chipSmallText, mm === m && { color: '#FFFFFF' }]}>{String(m).padStart(2, '0')}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={styles.pickerFooter}>
            <Button title={t('cancel')} variant="ghost" small onPress={onClose} />
            <Button title={t('ok')} small onPress={ok} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function TimeField({
  label = 'Time',
  value,
  onChange,
  allowClear = true,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
}) {
  styles = createStyles();
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <Field label={label}>
      <Pressable style={styles.pickerInput} onPress={() => setOpen(true)}>
        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.pickerInputText, !value && { color: colors.textMuted }]}>{value || t('selectTime')}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      <ChipRow style={{ marginTop: 6 }}>
        <Chip label="9:00" onPress={() => onChange('09:00')} />
        <Chip label="12:00" onPress={() => onChange('12:00')} />
        <Chip label="18:00" onPress={() => onChange('18:00')} />
        {allowClear && <Chip label={t('clear')} onPress={() => onChange('')} />}
      </ChipRow>
      <TimePickerModal visible={open} value={value} onSelect={onChange} onClose={() => setOpen(false)} />
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

const FREQ_LABELS: { value: RecurrenceFreq | ''; tKey: TKey }[] = [
  { value: '', tKey: 'none' },
  { value: 'daily', tKey: 'daily' },
  { value: 'weekly', tKey: 'weekly' },
  { value: 'monthly', tKey: 'month' },
  { value: 'yearly', tKey: 'year' },
];

export function RecurrenceField({
  value,
  onChange,
}: {
  value: Recurrence | null | undefined;
  onChange: (value: Recurrence | null) => void;
}) {
  const set = (patch: Partial<Recurrence>, enabled = true) => {
    if (!enabled) {
      onChange(null);
      return;
    }
    const base: Recurrence = { freq: value?.freq || 'daily', interval: value?.interval || 1 };
    onChange({ ...base, ...value, ...patch });
  };

  const activeFreq = value?.freq || '';
  const t = useT();
  const { weekdaysShort } = useDateNames();

  return (
    <Field label={t('repeat')}>
      <ChipRow>
        {FREQ_LABELS.map((f) => (
          <Chip
            key={f.tKey}
            label={t(f.tKey)}
            selected={activeFreq === f.value}
            onPress={() => {
              if (f.value === '') onChange(null);
              else set({ freq: f.value, interval: value?.interval || 1 });
            }}
          />
        ))}
      </ChipRow>

      {value ? (
        <View style={{ marginTop: 6 }}>
          <ChipRow>
            {[1, 2, 3].map((n) => (
              <Chip key={n} label={`${t('every')} ${n}`} selected={(value.interval || 1) === n} onPress={() => set({ interval: n })} />
            ))}
          </ChipRow>
          {activeFreq === 'weekly' ? (
            <ChipRow style={{ marginTop: 6 }}>
              {weekdaysShort.map((label, i) => {
                const on = !!value.byWeekdays?.includes(i);
                return (
                  <Chip
                    key={label}
                    label={label}
                    selected={on}
                    onPress={() => {
                      const cur = value.byWeekdays || [];
                      const next = on ? cur.filter((x) => x !== i) : [...cur, i].sort();
                      set({ byWeekdays: next.length ? next : undefined }, next.length > 0);
                    }}
                  />
                );
              })}
            </ChipRow>
          ) : null}
          <DateField
            label={t('repeatUntil')}
            value={value.until || ''}
            onChange={(until) => set({ until: until || null })}
          />
        </View>
      ) : null}
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Money (integer cents)
// ---------------------------------------------------------------------------

export function MoneyField({
  label = 'Amount',
  cents,
  onChange,
}: {
  label?: string;
  cents: number;
  onChange: (cents: number) => void;
}) {
  const t = useT();
  const [text, setText] = useState(cents === 0 ? '' : (cents / 100).toFixed(2));
  const valid = text === '' || /^\d+(\.\d{1,2})?$/.test(text.trim());

  return (
    <Field label={label}>
      <TextBox
        value={text}
        onChangeText={(v) => {
          setText(v);
          const t = v.trim();
          if (t === '') {
            onChange(0);
            return;
          }
          if (/^\d+(\.\d{1,2})?$/.test(t)) {
            const [major = '0', minor = ''] = t.split('.');
            onChange(parseInt(major, 10) * 100 + parseInt(minor.padEnd(2, '0') || '0', 10));
          }
        }}
        placeholder="0.00"
        keyboardType="decimal-pad"
        style={[!valid && { borderColor: colors.danger }]}
      />
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Combined date+time helper
// ---------------------------------------------------------------------------

/** Builds "YYYY-MM-DDTHH:mm" from a date key and time, or a plain date key. */
export function combineDateTime(date: string, time: string): string {
  if (!date) return '';
  if (!time) return date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return date;
  return `${date}T${time}`;
}

export function todayDefaultTime(): string {
  return dateKey(new Date());
}

/** Parses "YYYY-MM-DDTHH:mm" back into {date, time}. */
export function splitDateTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(iso);
  if (!m) return { date: '', time: '' };
  return { date: m[1], time: m[2] || '' };
}

export { todayKey };

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  pickerCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  pickerTitle: { ...typography.section },
  pickerWeekRow: { flexDirection: 'row', marginBottom: 4 },
  pickerWeek: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  pickerCell: { width: `${100 / 7}%`, aspectRatio: 1.4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  pickerCellSelected: { backgroundColor: colors.accent },
  pickerDay: { fontSize: 14, color: colors.text },
  pickerFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  pickerSectionLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 4, marginTop: spacing.sm },
  pickerSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipSmallOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipSmallText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  pickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  },
  pickerInputText: { flex: 1, fontSize: 15, color: colors.text },
  });
}


