/**
 * Focus / Study — Pomodoro or custom timer, linked to a task or project.
 * Sessions are stored as `focusSession` entities and feed the Insights stats.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLifeOS } from '../data/store';
import { isoDateTime } from '../core/time';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Chip, ChipRow, Field, TextBox } from './ui';

const PRESETS = [25, 50, 90];

/** "45s", "12m", or "1h 30m" — humanized remaining/duration time. */
function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

/** Humanized duration from integer minutes ("30m", "1h 30m"). */
function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export function FocusTimerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const remove = useLifeOS((s) => s.remove);

  const [minutes, setMinutes] = useState(25);
  const [customMin, setCustomMin] = useState('');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');

  // Epoch-ms of when the current session started (ref, not state, so the
  // interval/stop handlers always read the real start time — no stale closure
  // and no timezone reinterpretation).
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setRunning(false);
      setSecondsLeft(minutes * 60);
      startedAtRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const saveSession = (completed: boolean) => {
    const startedMs = startedAtRef.current;
    if (startedMs == null) return;
    const endedMs = Date.now();
    // Actual elapsed minutes, minimum 1 (a few seconds still counts).
    const duration = Math.max(1, Math.round((endedMs - startedMs) / 60000));
    void completed;
    create('focusSessions', {
      startedAt: isoDateTime(new Date(startedMs)),
      endedAt: isoDateTime(new Date(endedMs)),
      durationMin: duration,
      type: PRESETS.includes(minutes) ? 'pomodoro' : 'custom',
      taskId: taskId || null,
      subject: subject.trim() || null,
    });
    startedAtRef.current = null;
  };

  const start = () => {
    startedAtRef.current = Date.now();
    setRunning(true);
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
  };

  // Natural completion (countdown reached 0).
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    if (tickRef.current) clearInterval(tickRef.current);
    setRunning(false);
    saveSession(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, secondsLeft]);

  const stop = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRunning(false);
    saveSession(false);
  };

  const choosePreset = (m: number) => {
    setMinutes(m);
    setSecondsLeft(m * 60);
    setRunning(false);
  };

  const applyCustom = () => {
    const m = parseInt(customMin, 10);
    if (!Number.isFinite(m) || m < 1 || m > 240) return;
    setMinutes(m);
    setSecondsLeft(m * 60);
    setRunning(false);
  };

  const timeLabel = formatDuration(secondsLeft);
  const sessions = data.collections.focusSessions.filter((s) => !s.deletedAt).sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1)).slice(0, 8);
  const tasks = data.collections.tasks.filter((t) => !t.deletedAt && t.status !== 'done').slice(0, 8);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Focus</Text>

          <View style={styles.timerWrap}>
            <Text style={styles.timer}>{timeLabel}</Text>
            <Text style={styles.timerHint}>{running ? 'Focusing…' : minutes === 25 ? 'Pomodoro' : `${minutes} min`}</Text>
          </View>

          <ChipRow>
            {PRESETS.map((m) => (
              <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => choosePreset(m)} />
            ))}
          </ChipRow>
          <View style={styles.customRow}>
            <TextBox value={customMin} onChangeText={setCustomMin} placeholder="Custom min" keyboardType="number-pad" style={{ flex: 1 }} />
            <Button title="Set" small onPress={applyCustom} />
          </View>

          <Field label="Linked task (optional)">
            <ChipRow>
              <Chip label="None" selected={!taskId} onPress={() => setTaskId(null)} />
              {tasks.map((t) => (
                <Chip key={t.id} label={t.title.slice(0, 20)} selected={taskId === t.id} onPress={() => setTaskId(t.id)} />
              ))}
            </ChipRow>
          </Field>
          <Field label="Subject (optional)">
            <TextBox value={subject} onChangeText={setSubject} placeholder="e.g. Math, reading…" />
          </Field>

          <View style={styles.actions}>
            {running ? (
              <Button title="Stop & save" variant="danger" onPress={stop} style={{ flex: 1 }} />
            ) : (
              <Button title="Start" onPress={start} style={{ flex: 1 }} />
            )}
            <Button title="Close" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          </View>

          {sessions.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 4 }]}>Recent sessions</Text>
              {sessions.map((s) => (
                <View key={s.id} style={styles.sessionRow}>
                  <Text style={[typography.body, { flex: 1, fontSize: 14 }]} numberOfLines={1}>
                    {s.subject || tasks.find((t) => t.id === s.taskId)?.title || 'Focus'}
                  </Text>
                  <Text style={typography.caption}>{formatMinutes(s.durationMin)}</Text>
                  <Pressable onPress={() => remove('focusSessions', s.id)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '88%',
  },
  title: { ...typography.title, marginBottom: spacing.md },
  timerWrap: { alignItems: 'center', paddingVertical: spacing.lg },
  timer: { fontSize: 56, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },
  timerHint: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  customRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
