/**
 * Focus / Study — Pomodoro or custom timer, linked to a task or project.
 * Sessions are stored as `focusSession` entities and feed the Insights stats.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLifeOS } from '../data/store';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Chip, ChipRow, Field, TextBox } from './ui';

const PRESETS = [25, 50, 90];

export function FocusTimerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);

  const [minutes, setMinutes] = useState(25);
  const [customMin, setCustomMin] = useState('');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setRunning(false);
      setSecondsLeft(minutes * 60);
      setStartedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const start = () => {
    setRunning(true);
    setStartedAt(new Date().toISOString().slice(0, 16));
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          setRunning(false);
          saveSession(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const saveSession = (completed: boolean) => {
    if (!startedAt) return;
    const started = new Date(startedAt);
    const ended = new Date();
    const duration = Math.max(1, Math.round((ended.getTime() - started.getTime()) / 60000));
    if (!completed && duration < 1) return;
    create('focusSessions', {
      startedAt: started.toISOString().slice(0, 16),
      endedAt: ended.toISOString().slice(0, 16),
      durationMin: duration,
      type: PRESETS.includes(minutes) ? 'pomodoro' : 'custom',
      taskId: taskId || null,
      subject: subject.trim() || null,
    });
    setStartedAt(null);
  };

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

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const sessions = data.collections.focusSessions.filter((s) => !s.deletedAt).sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1)).slice(0, 8);
  const tasks = data.collections.tasks.filter((t) => !t.deletedAt && t.status !== 'done').slice(0, 8);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Focus</Text>

          <View style={styles.timerWrap}>
            <Text style={styles.timer}>{mm}:{ss}</Text>
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
                  <Text style={typography.caption}>{s.durationMin} min</Text>
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
