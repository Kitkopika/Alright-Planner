/**
 * Tasks — tasks/subtasks, priorities, due dates, recurring tasks, projects,
 * and calendar integration (due dates appear in the calendar). Tapping a
 * task opens the editor.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useLifeOS } from '../../src/data/store';
import { Task } from '../../src/core/types';
import { addDays, dateKey, dayDiff, startOfWeek, todayKey, tryParseISO } from '../../src/core/time';
import { colors, priorityColors, radius, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, SectionHeader, TextBox } from '../../src/components/ui';
import { DateField, RecurrenceField, TimeField, splitDateTime } from '../../src/components/form';
import { FocusTimerModal } from '../../src/components/focusTimer';

type Filter = 'all' | 'today' | 'overdue' | 'upcoming' | 'done' | 'projects';

/** Days from now until the task's due date, or null when it has none/invalid. */
function dueDiff(t: Task, now: Date): number | null {
  if (!t.dueAt) return null;
  const due = tryParseISO(t.dueAt);
  if (!due) return null;
  return dayDiff(now, due);
}

export default function TasksScreen() {
  const data = useLifeOS((s) => s.data);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);

  const now = new Date();
  const tasks = data.collections.tasks.filter((t) => !t.deletedAt && t.status !== 'cancelled');
  const projects = data.collections.projects.filter((p) => !p.deletedAt && p.status !== 'archived');

  const visible = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done');
    const todo = tasks.filter((t) => t.status !== 'done');
    const byBucket = (list: Task[]): { bucket: string; items: Task[] }[] => {
      const buckets = new Map<string, Task[]>();
      const push = (key: string, t: Task) => {
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(t);
      };
      for (const t of list) {
        const due = t.dueAt ? tryParseISO(t.dueAt) : null;
        if (!due || t.recurrence) push('No date / recurring', t);
        else {
          const diff = dayDiff(now, due);
          if (diff < 0) push('Overdue', t);
          else if (diff === 0) push('Today', t);
          else if (diff <= 7) push('This week', t);
          else push('Later', t);
        }
      }
      return [...buckets.entries()].map(([bucket, items]) => ({ bucket, items }));
    };
    switch (filter) {
      case 'today':
        return [{ bucket: 'Today', items: todo.filter((t) => dueDiff(t, now) === 0) }];
      case 'overdue':
        return [{ bucket: 'Overdue', items: todo.filter((t) => (dueDiff(t, now) ?? 0) < 0) }];
      case 'upcoming':
        return [{ bucket: 'Upcoming', items: todo.filter((t) => (dueDiff(t, now) ?? 0) > 0) }];
      case 'done':
        return [{ bucket: 'Done', items: done }];
      case 'projects':
        return projects
          .map((p) => ({ bucket: p.name, items: todo.filter((t) => t.projectId === p.id) }))
          .filter((g) => g.items.length > 0);
      default:
        return [...byBucket(todo), ...(done.length ? [{ bucket: 'Done', items: done }] : [])];
    }
  }, [tasks, filter, projects, now]);

  const toggle = (t: Task) => {
    const isDone = t.status === 'done';
    update('tasks', t.id, {
      status: isDone ? 'todo' : 'done',
      completedAt: isDone ? null : new Date().toISOString().slice(0, 16),
    });
  };

  const openEditor = (id: string) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const onTaskLongPress = (t: Task) => {
    Alert.alert(t.title, undefined, [
      { text: t.status === 'done' ? 'Mark as todo' : 'Mark done', onPress: () => toggle(t) },
      { text: 'Edit', onPress: () => openEditor(t.id) },
      { text: 'Delete', style: 'destructive', onPress: () => remove('tasks', t.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const counts = {
    overdue: tasks.filter((t) => t.status !== 'done' && (dueDiff(t, now) ?? 0) < 0).length,
    today: tasks.filter((t) => t.status !== 'done' && dueDiff(t, now) === 0).length,
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={typography.title}>Tasks</Text>
          <Text style={typography.caption}>
            {counts.overdue > 0 ? `${counts.overdue} overdue · ` : ''}
            {counts.today} due today
          </Text>
        </View>
        <Button title="Focus" small variant="ghost" onPress={() => setFocusOpen(true)} />
      </View>
      <ChipRow style={styles.filters}>
        {(['all', 'today', 'overdue', 'upcoming', 'done', 'projects'] as Filter[]).map((f) => (
          <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={styles.content}>
        {visible.every((g) => g.items.length === 0) ? (
          <EmptyState icon="checkbox-outline" title="No tasks here" subtitle="Use + → Task to add one" />
        ) : (
          visible.map((group) =>
            group.items.length === 0 ? null : (
              <View key={group.bucket}>
                <SectionHeader title={`${group.bucket} · ${group.items.length}`} />
                {group.items.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    projectName={projects.find((p) => p.id === t.projectId)?.name}
                    onToggle={() => toggle(t)}
                    onOpen={() => openEditor(t.id)}
                    onLongPress={() => onTaskLongPress(t)}
                  />
                ))}
              </View>
            )
          )
        )}
      </ScrollView>

      <TaskEditorModal taskId={editingId} visible={editorOpen} onClose={() => setEditorOpen(false)} />
      <FocusTimerModal visible={focusOpen} onClose={() => setFocusOpen(false)} />
    </View>
  );
}

function TaskRow({ task, projectName, onToggle, onOpen, onLongPress }: { task: Task; projectName?: string; onToggle: () => void; onOpen: () => void; onLongPress?: () => void }) {
  const tasks = useLifeOS((s) => s.data.collections.tasks); // stable reference
  const subtasks = tasks.filter((t) => !t.deletedAt && t.parentTaskId === task.id && t.status !== 'cancelled');
  const due = task.dueAt ? tryParseISO(task.dueAt) : null;
  const isOverdue = due && task.status !== 'done' && dayDiff(new Date(), due) < 0;
  const done = task.status === 'done';
  return (
    <Card style={styles.taskRow} onPress={onOpen} onLongPress={onLongPress}>
      <Pressable onPress={onToggle} hitSlop={10}>
        <Ionicons name={done ? 'checkbox' : 'square-outline'} size={24} color={done ? colors.success : colors.textMuted} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={styles.taskTitleRow}>
          <View style={[styles.prioDot, { backgroundColor: priorityColors[task.priority] || colors.textMuted }]} />
          <Text style={[typography.body, { flex: 1 }, done && { textDecorationLine: 'line-through', color: colors.textMuted }]} numberOfLines={2}>
            {task.title}
          </Text>
        </View>
        <View style={styles.taskMeta}>
          {task.dueAt ? <Badge text={dueLabel(task.dueAt)} color={isOverdue ? colors.danger : colors.textSecondary} bg={isOverdue ? colors.dangerSoft : colors.surfaceAlt} /> : null}
          {task.recurrence ? <Badge text="repeat" color={colors.info} bg={colors.infoSoft} /> : null}
          {projectName ? <Badge text={projectName} color={colors.accent} bg={colors.accentSoft} /> : null}
          {subtasks.length > 0 ? <Badge text={`${subtasks.length} subtask${subtasks.length > 1 ? 's' : ''}`} /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Card>
  );
}

function dueLabel(iso: string): string {
  const d = tryParseISO(iso);
  if (!d) return iso;
  const diff = dayDiff(new Date(), d);
  const base = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : `${dateKey(d)}`;
  return /T\d{2}:\d{2}/.test(iso) ? `${base} ${iso.slice(11, 16)}` : base;
}

// ---------------------------------------------------------------------------
// Task editor
// ---------------------------------------------------------------------------

export function TaskEditorModal({ taskId, visible, onClose }: { taskId: string | null; visible: boolean; onClose: () => void }) {
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);

  const editing = taskId ? data.collections.tasks.find((t) => t.id === taskId && !t.deletedAt) : undefined;
  const subtasks = data.collections.tasks.filter((t) => !t.deletedAt && t.parentTaskId === taskId && t.status !== 'cancelled');
  const projects = data.collections.projects.filter((p) => !p.deletedAt && p.status !== 'archived');

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [status, setStatus] = useState<Task['status']>('todo');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [recurrence, setRecurrence] = useState<Task['recurrence']>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tags, setTags] = useState('');
  const [minutes, setMinutes] = useState('');
  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title);
      setNotes(editing.notes || '');
      setPriority(editing.priority);
      setStatus(editing.status);
      const { date, time } = splitDateTime(editing.dueAt);
      setDueDate(date);
      setDueTime(time);
      setRecurrence(editing.recurrence || null);
      setProjectId(editing.projectId || null);
      setTags((editing.tags || []).join(', '));
      setMinutes(editing.estimatedMinutes != null ? String(editing.estimatedMinutes) : '');
      setNewSubtask('');
    } else {
      setTitle('');
      setNotes('');
      setPriority('medium');
      setStatus('todo');
      setDueDate(todayKey());
      setDueTime('');
      setRecurrence(null);
      setProjectId(null);
      setTags('');
      setMinutes('');
      setNewSubtask('');
    }
  }, [visible, editing]);

  const save = () => {
    if (!title.trim()) return;
    const dueAt = dueDate ? (dueTime ? `${dueDate}T${dueTime}` : dueDate) : null;
    const payload = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      priority,
      status,
      dueAt,
      recurrence,
      projectId: projectId || null,
      tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
      estimatedMinutes: minutes ? parseInt(minutes, 10) : undefined,
    };
    if (editing) update('tasks', editing.id, payload);
    else create('tasks', payload);
    onClose();
  };

  const addSubtask = () => {
    const label = newSubtask.trim();
    if (!label || !editing) return;
    create('tasks', { title: label, status: 'todo', priority: 'low', parentTaskId: editing.id, dueAt: editing.dueAt });
    setNewSubtask('');
  };

  const del = () => {
    if (editing) {
      remove('tasks', editing.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editing ? 'Edit task' : 'New task'}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label="Title">
              <TextBox value={title} onChangeText={setTitle} placeholder="What needs doing?" autoFocus={!editing} />
            </Field>
            <Field label="Notes">
              <TextBox value={notes} onChangeText={setNotes} placeholder="Optional details" multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
            </Field>
            <Field label="Priority">
              <ChipRow>
                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                  <Chip key={p} label={p} selected={priority === p} onPress={() => setPriority(p)} />
                ))}
              </ChipRow>
            </Field>
            <Field label="Status">
              <ChipRow>
                {(['todo', 'doing', 'done', 'cancelled'] as const).map((s) => (
                  <Chip key={s} label={s} selected={status === s} onPress={() => setStatus(s)} />
                ))}
              </ChipRow>
            </Field>
            <DateField label="Due date" value={dueDate} onChange={setDueDate} />
            <TimeField label="Due time (optional)" value={dueTime} onChange={setDueTime} />
            <RecurrenceField value={recurrence} onChange={setRecurrence} />
            <Field label="Project">
              <ChipRow>
                <Chip label="None" selected={!projectId} onPress={() => setProjectId(null)} />
                {projects.map((p) => (
                  <Chip key={p.id} label={p.name} selected={projectId === p.id} onPress={() => setProjectId(p.id)} />
                ))}
              </ChipRow>
            </Field>
            <Field label="Tags (comma separated)">
              <TextBox value={tags} onChangeText={setTags} placeholder="work, errand" />
            </Field>
            <Field label="Estimated minutes">
              <TextBox value={minutes} onChangeText={setMinutes} placeholder="e.g. 45" keyboardType="number-pad" />
            </Field>

            {editing && (
              <Field label={`Subtasks (${subtasks.length})`}>
                {subtasks.map((st) => (
                  <View key={st.id} style={styles.subtaskRow}>
                    <Pressable
                      onPress={() => update('tasks', st.id, { status: st.status === 'done' ? 'todo' : 'done' })}
                      hitSlop={8}
                    >
                      <Ionicons name={st.status === 'done' ? 'checkbox' : 'square-outline'} size={18} color={st.status === 'done' ? colors.success : colors.textMuted} />
                    </Pressable>
                    <Text style={[typography.body, { flex: 1 }, st.status === 'done' && { textDecorationLine: 'line-through', color: colors.textMuted }]}>{st.title}</Text>
                    <Pressable onPress={() => remove('tasks', st.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
                <View style={styles.subtaskAdd}>
                  <TextBox value={newSubtask} onChangeText={setNewSubtask} placeholder="Add subtask…" style={{ flex: 1 }} onSubmitEditing={addSubtask} returnKeyType="done" />
                  <Button title="Add" small onPress={addSubtask} />
                </View>
              </Field>
            )}

            <View style={styles.actions}>
              {editing && <Button title="Delete" variant="danger" onPress={del} style={{ flex: 1 }} />}
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title="Save" onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  filters: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 120 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, paddingVertical: spacing.md },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  prioDot: { width: 8, height: 8, borderRadius: 4 },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '90%',
  },
  sheetTitle: { ...typography.title, marginBottom: spacing.lg },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  subtaskAdd: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
