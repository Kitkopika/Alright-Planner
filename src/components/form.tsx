/**
 * Form primitives for dates, times, recurrence and money.
 * Deliberately dependency-free: plain text inputs + quick-pick chips, so the
 * exact same code runs on Android, iOS and web (no native date picker).
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { Recurrence, RecurrenceFreq } from '../core/types';
import { addDays, dateKey, todayKey, tryParseISO } from '../core/time';
import { colors } from '../theme';
import { Chip, ChipRow, Field, TextBox } from './ui';

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Date (YYYY-MM-DD)
// ---------------------------------------------------------------------------

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
  const [text, setText] = useState(value);

  const commit = (v: string) => {
    setText(v);
    onChange(v.trim());
  };

  const quick = (d: Date) => {
    const key = dateKey(d);
    setText(key);
    onChange(key);
  };

  const valid = value === '' || tryParseISO(value) != null;

  return (
    <Field label={label}>
      <TextBox
        value={text}
        onChangeText={commit}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        style={[!valid && { borderColor: colors.danger }]}
      />
      <ChipRow style={{ marginTop: 6 }}>
        <Chip label="Today" onPress={() => quick(new Date())} />
        <Chip label="Tomorrow" onPress={() => quick(addDays(new Date(), 1))} />
        <Chip label="+1w" onPress={() => quick(addDays(new Date(), 7))} />
        <Chip label="+1m" onPress={() => quick(addDays(new Date(), 30))} />
        {allowClear && <Chip label="Clear" onPress={() => commit('')} />}
      </ChipRow>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Time (HH:mm)
// ---------------------------------------------------------------------------

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
  const [text, setText] = useState(value);
  const valid = value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

  return (
    <Field label={label}>
      <TextBox
        value={text}
        onChangeText={(v) => {
          setText(v);
          onChange(v.trim());
        }}
        placeholder="HH:mm (e.g. 18:30)"
        autoCapitalize="none"
        autoCorrect={false}
        style={[!valid && { borderColor: colors.danger }]}
      />
      <ChipRow style={{ marginTop: 6 }}>
        <Chip label="9:00" onPress={() => { setText('09:00'); onChange('09:00'); }} />
        <Chip label="12:00" onPress={() => { setText('12:00'); onChange('12:00'); }} />
        <Chip label="18:00" onPress={() => { setText('18:00'); onChange('18:00'); }} />
        {allowClear && <Chip label="Clear" onPress={() => { setText(''); onChange(''); }} />}
      </ChipRow>
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

const FREQ_LABELS: { value: RecurrenceFreq | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
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

  return (
    <Field label="Repeat">
      <ChipRow>
        {FREQ_LABELS.map((f) => (
          <Chip
            key={f.label}
            label={f.label}
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
              <Chip key={n} label={n === 1 ? 'every 1' : `every ${n}`} selected={(value.interval || 1) === n} onPress={() => set({ interval: n })} />
            ))}
          </ChipRow>
          {activeFreq === 'weekly' ? (
            <ChipRow style={{ marginTop: 6 }}>
              {WEEKDAY_LABELS.map((label, i) => {
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
            label="Repeat until (optional)"
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
