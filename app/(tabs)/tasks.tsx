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
import { useDataSlice, useLifeOS } from '../../src/data/store';
import { Task } from '../../src/core/types';
import { addDays, dateKey, dayDiff, isoDateTime, startOfWeek, todayKey, tryParseISO } from '../../src/core/time';
import { themedStyles, colors, priorityColors, radius, spacing, typography  } from '../../src/theme';
import { FadeEdge } from '../../src/components/motion';
import { AmbientBackground } from '../../src/components/ambient';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, SectionHeader, TextBox, Sheet } from '../../src/components/ui';
import { DateField, RecurrenceField, TimeField, splitDateTime } from '../../src/components/form';
import { ReminderPicker, ReminderOffset } from '../../src/components/reminderPicker';
import { FocusTimerModal } from '../../src/components/focusTimer';
import { TKey, useT } from '../../src/i18n';
import { modalAnimationType } from '../../src/data/settings';

type Filter = 'all' | 'today' | 'overdue' | 'upcoming' | 'done' | 'projects';

/** Days from now until the task's due date, or null when it has none/invalid. */
function dueDiff(t: Task, now: Date): number | null {
  if (!t.dueAt) return null;
  const due = tryParseISO(t.dueAt);
  if (!due) return null;
  return dayDiff(now, due);
}

export default function TasksScreen() {
  styles = createStyles();
  const data = useDataSlice(['tasks', 'notes', 'projects']);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const [filter, setFilter] = useState<Filter>('all');
  const [priorityFilter, setPriorityFilter] = useState<Task['priority'] | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const t = useT();

  const now = new Date();
  const allTasks = data.collections.tasks.filter((t) => !t.deletedAt && t.status !== 'cancelled');
  // Subtasks live inside their parent's row — never as standalone main tasks.
  const mainTasks = allTasks.filter((t) => !t.parentTaskId);
  const tasks = priorityFilter === 'all' ? mainTasks : mainTasks.filter((t) => t.priority === priorityFilter);
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
      for (const tk of list) {
        const due = tk.dueAt ? tryParseISO(tk.dueAt) : null;
        if (!due || tk.recurrence) push(t('noDateRecurring'), tk);
        else {
          const diff = dayDiff(now, due);
          if (diff < 0) push(t('overdue'), tk);
          else if (diff === 0) push(t('today'), tk);
          else if (diff <= 7) push(t('thisWeek'), tk);
          else push(t('later'), tk);
        }
      }
      return [...buckets.entries()].map(([bucket, items]) => ({ bucket, items }));
    };
    switch (filter) {
      case 'today':
        return [{ bucket: t('today'), items: todo.filter((tt) => dueDiff(tt, now) === 0) }];
      case 'overdue':
        return [{ bucket: t('overdue'), items: todo.filter((tt) => (dueDiff(tt, now) ?? 0) < 0) }];
      case 'upcoming':
        return [{ bucket: 'Upcoming', items: todo.filter((tt) => (dueDiff(tt, now) ?? 0) > 0) }];
      case 'done':
        return [{ bucket: t('doneLabel'), items: done }];
      case 'projects':
        return projects
          .map((p) => ({ bucket: p.name, items: todo.filter((t) => t.projectId === p.id) }))
          .filter((g) => g.items.length > 0);
      default:
        return [...byBucket(todo), ...(done.length ? [{ bucket: 'Done', items: done }] : [])];
    }
  }, [tasks, filter, projects, now, t]);

  const toggle = (t: Task) => {
    const isDone = t.status === 'done';
    const next = isDone ? 'todo' : 'done';
    update('tasks', t.id, {
      status: next,
      completedAt: isDone ? null : isoDateTime(new Date()),
    });
    // Auto-tick / untick every subtask together with its parent task.
    for (const st of allTasks) {
      if (st.parentTaskId === t.id) {
        update('tasks', st.id, {
          status: next,
          completedAt: isDone ? null : isoDateTime(new Date()),
        });
      }
    }
  };

  const openEditor = (id: string) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const onTaskLongPress = (task: Task) => {
    Alert.alert(task.title, undefined, [
      { text: task.status === 'done' ? t('markTodo') : t('markDone'), onPress: () => toggle(task) },
      { text: t('edit'), onPress: () => openEditor(task.id) },
      { text: t('delete'), style: 'destructive', onPress: () => remove('tasks', task.id) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const counts = {
    overdue: tasks.filter((t) => t.status !== 'done' && (dueDiff(t, now) ?? 0) < 0).length,
    today: tasks.filter((t) => t.status !== 'done' && dueDiff(t, now) === 0).length,
  };

  return (
    <View style={styles.screen}>
      <AmbientBackground />
      <View style={styles.header}>
        <View>
          <Text style={typography.title}>{t('tasks')}</Text>
          <Text style={typography.caption}>
            {counts.overdue > 0 ? `${counts.overdue} ${t('overdue')} · ` : ''}
            {counts.today} {t('dueTodayCount')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Button title={t('focus')} small variant="ghost" onPress={() => setFocusOpen(true)} />
          <Button title={t('addTaskBtn')} small onPress={() => { setEditingId(null); setEditorOpen(true); }} />
        </View>
      </View>
      <ChipRow style={styles.filters}>
        {(['all', 'today', 'overdue', 'upcoming', 'done', 'projects'] as Filter[]).map((f) => {
          const labelMap: Record<Filter, TKey> = { all: 'all', today: 'today', overdue: 'overdue', upcoming: 'upcoming', done: 'doneLabel', projects: 'projectsLabel' };
          return <Chip key={f} label={t(labelMap[f])} selected={filter === f} onPress={() => setFilter(f)} />;
        })}
      </ChipRow>
      <ChipRow style={styles.filters}>
        {(['all', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
          <Chip key={p} label={p === 'all' ? t('allPriority') : t(p)} selected={priorityFilter === p} onPress={() => setPriorityFilter(p)} />
        ))}
      </ChipRow>
      <View style={{ flex: 1 }}>
        <FadeEdge color={colors.background} position="top" />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {visible.every((g) => g.items.length === 0) ? (
          <EmptyState icon="checkbox-outline" title={t('noTasksHere')} subtitle={t('usePlusTask')} />
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
      </View>

      <TaskEditorModal taskId={editingId} visible={editorOpen} onClose={() => setEditorOpen(false)} />
      <FocusTimerModal visible={focusOpen} onClose={() => setFocusOpen(false)} />
    </View>
  );
}

function TaskRow({ task, projectName, onToggle, onOpen, onLongPress }: { task: Task; projectName?: string; onToggle: () => void; onOpen: () => void; onLongPress?: () => void }) {
  styles = createStyles();
  const t = useT();
  const update = useLifeOS((s) => s.update);
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
          {task.dueAt ? <Badge text={dueLabel(task.dueAt, t)} color={isOverdue ? colors.danger : colors.textSecondary} bg={isOverdue ? colors.dangerSoft : colors.surfaceAlt} /> : null}
          {task.recurrence ? <Badge text="repeat" color={colors.info} bg={colors.infoSoft} /> : null}
          {projectName ? <Badge text={projectName} color={colors.accent} bg={colors.accentSoft} /> : null}
          {task.reminders && task.reminders.length > 0 ? <Badge text={t('reminders')} color={colors.warning} bg={colors.warningSoft} /> : null}
        </View>
        {subtasks.length > 0 && (
          <View style={styles.subtaskList}>
            {subtasks.map((st) => {
              const stDone = st.status === 'done';
              return (
                <Pressable
                  key={st.id}
                  style={styles.subtaskRowCompact}
                  onPress={() =>
                    update('tasks', st.id, {
                      status: stDone ? 'todo' : 'done',
                      completedAt: stDone ? null : isoDateTime(new Date()),
                    })
                  }
                >
                  <Ionicons name={stDone ? 'checkbox' : 'square-outline'} size={15} color={stDone ? colors.success : colors.textMuted} />
                  <Text style={[styles.subtaskTitle, stDone && { textDecorationLine: 'line-through', color: colors.textMuted }]} numberOfLines={1}>
                    {st.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Card>
  );
}

function dueLabel(iso: string, tt: (k: TKey) => string): string {
  const d = tryParseISO(iso);
  if (!d) return iso;
  const diff = dayDiff(new Date(), d);
  const base = diff === 0 ? tt('todayLabel') : diff === 1 ? tt('tomorrow') : diff === -1 ? tt('yesterday') : `${dateKey(d)}`;
  return /T\d{2}:\d{2}/.test(iso) ? `${base} ${iso.slice(11, 16)}` : base;
}

// ---------------------------------------------------------------------------
// Task editor
// ---------------------------------------------------------------------------

export function TaskEditorModal({ taskId, visible, onClose }: { taskId: string | null; visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  const data = useDataSlice(['tasks', 'notes', 'projects']);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);

  const editing = taskId ? data.collections.tasks.find((t) => t.id === taskId && !t.deletedAt) : undefined;
  const subtasks = data.collections.tasks.filter((t) => !t.deletedAt && t.parentTaskId === taskId && t.status !== 'cancelled');
  const linkedNotes = data.collections.notes.filter((n) => !n.deletedAt && n.taskId === taskId);
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
  const [reminders, setReminders] = useState<ReminderOffset[]>([]);
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
      setReminders(editing.reminders && editing.reminders.length > 0 ? editing.reminders : []);
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
      setReminders([]);
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
      reminders: reminders.length > 0 ? reminders : null,
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
    <Modal visible={visible} transparent animationType={modalAnimationType()} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <Sheet>
          <Text style={styles.sheetTitle}>{editing ? t('editTask') : t('newTask')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label={t('title')}>
              <TextBox value={title} onChangeText={setTitle} placeholder={t('whatNeedsDoing')} autoFocus={!editing} />
            </Field>
            <Field label={t('taskNotes')}>
              <TextBox value={notes} onChangeText={setNotes} placeholder={t('optionalDetails')} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
            </Field>
            <Field label={t('priority')}>
              <ChipRow>
                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                  <Chip key={p} label={t(p)} selected={priority === p} onPress={() => setPriority(p)} />
                ))}
              </ChipRow>
            </Field>
            <Field label={t('status')}>
              <ChipRow>
                {(['todo', 'doing', 'done', 'cancelled'] as const).map((s) => (
                  <Chip key={s} label={s === 'done' ? t('doneLabel') : t(s)} selected={status === s} onPress={() => setStatus(s)} />
                ))}
              </ChipRow>
            </Field>
            <DateField label={t('dueDate')} value={dueDate} onChange={setDueDate} />
            <TimeField label={t('dueTime')} value={dueTime} onChange={setDueTime} />
            <RecurrenceField value={recurrence} onChange={setRecurrence} />
            <Field label={t('project')}>
              <ChipRow>
                <Chip label={t('none')} selected={!projectId} onPress={() => setProjectId(null)} />
                {projects.map((p) => (
                  <Chip key={p.id} label={p.name} selected={projectId === p.id} onPress={() => setProjectId(p.id)} />
                ))}
              </ChipRow>
            </Field>
            <Field label={t('tagsComma')}>
              <TextBox value={tags} onChangeText={setTags} placeholder="work, errand" />
            </Field>
            <Field label={t('remindBefore')}>
              <ReminderPicker reminders={reminders} onChange={setReminders} />
            </Field>

            {editing && linkedNotes.length > 0 && (
              <Field label={t('linkedNotes')}>
                {linkedNotes.map((n) => (
                  <View key={n.id} style={styles.linkedNoteRow}>
                    <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                    <Text style={[typography.body, { flex: 1, fontSize: 13 }]} numberOfLines={1}>
                      {n.title || t('untitled')}
                    </Text>
                  </View>
                ))}
              </Field>
            )}

            {editing && (
              <Field label={`${t('subtasks')} (${subtasks.length})`}>
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
                  <TextBox value={newSubtask} onChangeText={setNewSubtask} placeholder={t('addSubtask')} style={{ flex: 1 }} onSubmitEditing={addSubtask} returnKeyType="done" />
                  <Button title={t('add')} small onPress={addSubtask} />
                </View>
              </Field>
            )}

            <View style={styles.actions}>
              {editing && <Button title={t('delete')} variant="danger" onPress={del} style={{ flex: 1 }} />}
              <Button title={t('cancel')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </Sheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}


const createStyles = themedStyles(() => {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  filters: { paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.md },
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
  subtaskList: { marginTop: spacing.xs, gap: 2 },
  subtaskRowCompact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  subtaskTitle: { flex: 1, fontSize: 12, color: colors.text },
  linkedNoteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  subtaskAdd: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  });
});

let styles = createStyles();

