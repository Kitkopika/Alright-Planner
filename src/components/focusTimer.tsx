/**
 * Focus / Study — Pomodoro or custom timer, linked to a task or project.
 * Sessions are stored as `focusSession` entities and feed the Insights stats.
 *
 * While a session is running the sheet becomes a "focus lock": the form is
 * hidden, the backdrop darkens, Android back and close ask for confirmation,
 * and leaving the app pauses the timer (with a warning when you return).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLifeOS } from '../data/store';
import { isoDateTime } from '../core/time';
import { colors, radius, spacing, typography } from '../theme';
import { Button, Chip, ChipRow, Field, TextBox, Sheet } from './ui';
import { Spotlight } from './motion';
import { WheelPicker } from './wheel';
import { TKey, useT } from '../i18n';
import { useSettings } from '../data/settings';

const PRESETS = [25, 50, 90];
const HOURS = Array.from({ length: 100 }, (_, i) => i); // 0–99 hours
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0–59, 1-minute steps

/** "45s", "12m", or "1h 30m" — humanized remaining/duration time (locale-aware). */
function formatDuration(totalSeconds: number, tt: (k: TKey) => string): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}${tt('minShort')}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}${tt('hourShort')} ${rm}${tt('minShort')}` : `${h}${tt('hourShort')}`;
}

/** Humanized duration from integer minutes ("30m", "1h 30m") — locale-aware. */
function formatMinutes(min: number, tt: (k: TKey) => string): string {
  if (min < 60) return `${min}${tt('minShort')}`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  return rm > 0 ? `${h}${tt('hourShort')} ${rm}${tt('minShort')}` : `${h}${tt('hourShort')}`;
}


/** Scrollable hours + minutes duration picker (minimum 5 minutes). */
function DurationPicker({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <WheelPicker
      hourValues={HOURS}
      minuteValues={MINUTES}
      hour={h}
      minute={m}
      onChange={(hh, mm) => onChange(Math.max(5, hh * 60 + mm))}
    />
  );
}

export function FocusTimerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const remove = useLifeOS((s) => s.remove);

  const [minutes, setMinutes] = useState(25);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [taskId, setTaskId] = useState<string | null>(null);
  const fx = useSettings((s) => s.visualFx.lighting);
  const [subject, setSubject] = useState('');

  // Refs mirror the values used by long-lived listeners (AppState, intervals)
  // so they never read stale closures.
  const minutesRef = useRef(minutes);
  minutesRef.current = minutes;
  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  const runningRef = useRef(running);
  runningRef.current = running;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const pausedByBackgroundRef = useRef(false);

  // Wall-clock start of the whole session + active (non-paused) elapsed time.
  const startedAtRef = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const saveSession = useCallback(() => {
    const startedMs = startedAtRef.current;
    if (startedMs == null) return;
    let active = elapsedMsRef.current;
    if (segmentStartRef.current != null) active += Date.now() - segmentStartRef.current;
    segmentStartRef.current = null;
    const endedMs = Date.now();
    // Actual active minutes, minimum 1 (a few seconds still counts).
    const duration = Math.max(1, Math.round(active / 60000));
    create('focusSessions', {
      startedAt: isoDateTime(new Date(startedMs)),
      endedAt: isoDateTime(new Date(endedMs)),
      durationMin: duration,
      type: PRESETS.includes(minutesRef.current) ? 'pomodoro' : 'custom',
      taskId: taskIdRef.current || null,
      subject: subjectRef.current.trim() || null,
    });
    startedAtRef.current = null;
  }, [create]);

  const stopSession = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setRunning(false);
    setPaused(false);
    saveSession();
  }, [saveSession]);

  const pauseSession = useCallback(() => {
    if (segmentStartRef.current != null) {
      elapsedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setPaused(true);
  }, []);

  const resumeSession = useCallback(() => {
    setPaused(false);
    segmentStartRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
  }, []);

  // Reset the timer whenever the modal opens.
  useEffect(() => {
    if (visible) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      setRunning(false);
      setPaused(false);
      setDone(false);
      setSecondsLeft(minutes * 60);
      startedAtRef.current = null;
      elapsedMsRef.current = 0;
      segmentStartRef.current = null;
      pausedByBackgroundRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Leaving the app pauses the timer; returning warns the user.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (runningRef.current && !pausedRef.current) {
          pausedByBackgroundRef.current = true;
          pauseSession();
        }
      } else if (pausedByBackgroundRef.current) {
        pausedByBackgroundRef.current = false;
        Alert.alert(t('focusInProgress'), t('focusLeftWarn'), [
          { text: t('resume'), onPress: () => resumeSession() },
          { text: t('stopSave'), style: 'destructive', onPress: () => stopSession() },
        ]);
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save whatever elapsed if the component unmounts mid-session (e.g. tab switch).
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      saveSession();
    };
  }, [saveSession]);

  const requestClose = () => {
    if (runningRef.current && !pausedRef.current) {
      Alert.alert(t('focusInProgress'), t('stopFocusQ'), [
        { text: t('keepFocusing'), onPress: () => {} },
        {
          text: t('stopSave'),
          style: 'destructive',
          onPress: () => {
            stopSession();
            onClose();
          },
        },
      ]);
    } else {
      onClose();
    }
  };

  const changeDuration = (m: number) => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setMinutes(m);
    setSecondsLeft(m * 60);
    setRunning(false);
    setPaused(false);
    setDone(false);
  };

  const start = () => {
    const m = Math.max(5, minutes);
    setMinutes(m);
    setSecondsLeft(m * 60);
    setRunning(true);
    setPaused(false);
    setDone(false);
    startedAtRef.current = Date.now();
    elapsedMsRef.current = 0;
    segmentStartRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
  };

  // Natural completion (countdown reached 0).
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    setRunning(false);
    setPaused(false);
    setDone(true);
    saveSession();
  }, [running, secondsLeft, saveSession]);

  const locked = running || paused;
  const timeLabel = formatDuration(secondsLeft, t);
  const hint = done
    ? t('focusComplete')
    : paused
      ? t('pausedLabel')
      : running
        ? t('focusing')
        : minutes === 25
          ? t('daily')
          : `${minutes} ${t('minShort')}`;
  const sessions = data.collections.focusSessions.filter((s) => !s.deletedAt).sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1)).slice(0, 8);
  const tasks = data.collections.tasks.filter((task) => !task.deletedAt && task.status !== 'done').slice(0, 8);
  const lockLabel = subject.trim() || tasks.find((task) => task.id === taskId)?.title || '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={requestClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.backdrop, locked && styles.backdropLocked]}>
        <Sheet>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{t('focus')}</Text>

            <View style={styles.timerWrap}>
              <View style={styles.timerGlowWrap}>
                <Spotlight size={280} />
              </View>
              <Text style={[styles.timer, !fx && { textShadowColor: 'transparent', textShadowRadius: 0 }]}>{timeLabel}</Text>
              <Text style={styles.timerHint}>{hint}</Text>
            </View>

            {locked ? (
              <>
                {lockLabel ? <Text style={styles.lockSubject}>{lockLabel}</Text> : null}
                <View style={styles.actions}>
                  {paused ? (
                    <>
                      <Button title={t('resume')} onPress={resumeSession} style={{ flex: 1 }} />
                      <Button title={t('stopSave')} variant="danger" onPress={stopSession} style={{ flex: 1 }} />
                    </>
                  ) : (
                    <Button title={t('stopSave')} variant="danger" onPress={stopSession} style={{ flex: 1 }} />
                  )}
                </View>
                <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>
                  {t('focusLockedHint')}
                </Text>
              </>
            ) : (
              <>
                <ChipRow>
                  {PRESETS.map((m) => (
                    <Chip key={m} label={`${m} ${t('minShort')}`} selected={minutes === m} onPress={() => changeDuration(m)} />
                  ))}
                </ChipRow>

                <DurationPicker minutes={minutes} onChange={changeDuration} />

                <Field label={t('linkedTask')}>
                  <ChipRow>
                    <Chip label={t('none')} selected={!taskId} onPress={() => setTaskId(null)} />
                    {tasks.map((task) => (
                      <Chip key={task.id} label={task.title.slice(0, 20)} selected={taskId === task.id} onPress={() => setTaskId(task.id)} />
                    ))}
                  </ChipRow>
                </Field>
                <Field label={t('subject')}>
                  <TextBox value={subject} onChangeText={setSubject} placeholder="e.g. Math, reading…" />
                </Field>

                <View style={styles.actions}>
                  <Button title={t('startBtn')} onPress={start} style={{ flex: 1 }} />
                  <Button title={t('close')} variant="ghost" onPress={requestClose} style={{ flex: 1 }} />
                </View>

                {sessions.length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 4 }]}>{t('recentSessions')}</Text>
                    {sessions.map((s) => (
                      <View key={s.id} style={styles.sessionRow}>
                        <Text style={[typography.body, { flex: 1, fontSize: 14 }]} numberOfLines={1}>
                          {s.subject || tasks.find((task) => task.id === s.taskId)?.title || t('focus')}
                        </Text>
                        <Text style={typography.caption}>{formatMinutes(s.durationMin, t)}</Text>
                        <Pressable onPress={() => remove('focusSessions', s.id)} hitSlop={8}>
                          <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Sheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  backdropLocked: { backgroundColor: 'rgba(8,8,16,0.94)' },
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
  timerGlowWrap: { position: 'absolute', left: 0, right: 0, top: -30, alignItems: 'center' },
  timer: { fontSize: 56, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'], textShadowColor: colors.accent + '88', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 24 },
  timerHint: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  lockSubject: { ...typography.section, textAlign: 'center', marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  });
}
