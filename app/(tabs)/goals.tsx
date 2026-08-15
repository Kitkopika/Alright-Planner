/**
 * Goals & Projects — long-term goals, projects, tasks under projects,
 * progress tracking and deadlines. Goal -> Project -> Task.
 */

import React, { useEffect, useState } from 'react';
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
import { useDateNames, useT } from '../../src/i18n';
import { Goal, Project } from '../../src/core/types';
import { goalProgress } from '../../src/features/today';
import { dateKey, tryParseISO } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, ProgressBar, SectionHeader, TextBox } from '../../src/components/ui';
import { DateField } from '../../src/components/form';

function fmtDue(iso: string | null | undefined, ws: string[], ms: string[]): string {
  const d = tryParseISO(iso);
  if (!d) return '';
  return `${ws[(d.getDay() + 6) % 7]} ${d.getDate()} ${ms[d.getMonth()]}`;
}

export default function GoalsScreen() {
  styles = createStyles();
  const t = useT();
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'done' | 'all'>('all');

  const goals = data.collections.goals
    .filter((g) => !g.deletedAt && g.status !== 'archived')
    .filter((g) => (statusFilter === 'all' ? true : g.status === statusFilter))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={typography.title}>{t('goals')}</Text>
        <Button title={t('addGoal')} small onPress={() => setEditorOpen(true)} />
      </View>
      <ChipRow style={styles.filters}>
        {(['all', 'active', 'done'] as const).map((s) => (
          <Chip key={s} label={s === 'all' ? t('all') : s === 'done' ? t('doneLabel') : t('active')} selected={statusFilter === s} onPress={() => setStatusFilter(s)} />
        ))}
      </ChipRow>
      <ScrollView contentContainerStyle={styles.content}>
        {goals.length === 0 ? (
          <EmptyState icon="flag-outline" title={t('noGoals')} subtitle={t('noGoalsSub')} />
        ) : (
          goals.map((g) => <GoalCard key={g.id} goal={g} onOpen={() => { setDetailId(g.id); setDetailOpen(true); }} />)
        )}
      </ScrollView>

      <GoalEditorModal goalId={null} visible={editorOpen} onClose={() => setEditorOpen(false)} />
      {detailId && <GoalDetailModal goalId={detailId} visible={detailOpen} onClose={() => setDetailOpen(false)} />}
    </View>
  );
}

function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  styles = createStyles();
  const t = useT();
  const { monthsShort, weekdaysShort } = useDateNames();
  const data = useLifeOS((s) => s.data);
  const remove = useLifeOS((s) => s.remove);
  const progress = goalProgress(goal.id, data);
  const projects = data.collections.projects.filter((p) => !p.deletedAt && p.goalId === goal.id && p.status !== 'archived');
  const tasks = data.collections.tasks.filter((t) => !t.deletedAt && projects.some((p) => p.id === t.projectId));
  const habits = data.collections.habits.filter((h) => !h.deletedAt && h.goalId === goal.id);

  return (
    <Card
      style={{ marginBottom: spacing.md }}
      onPress={onOpen}
      onLongPress={() =>
        Alert.alert(t('deleteGoalQ'), goal.title, [
          { text: t('delete'), style: 'destructive', onPress: () => remove('goals', goal.id) },
          { text: t('cancel'), style: 'cancel' },
        ])
      }
    >
      <View style={styles.goalHeader}>
        <View style={{ flex: 1 }}>
          <Text style={typography.section}>{goal.title}</Text>
          {goal.deadline ? <Text style={typography.caption}>{t('due')} {fmtDue(goal.deadline, weekdaysShort, monthsShort)}</Text> : null}
        </View>
        <View style={styles.goalRight}>
          <Text style={[typography.body, { fontWeight: '700' }]}>{progress}%</Text>
          {goal.status === 'done' && <Badge text={t('doneLabel')} color={colors.success} bg={colors.successSoft} />}
        </View>
      </View>
      <ProgressBar pct={progress} color={goal.color || colors.accent} style={{ marginTop: spacing.sm }} />
      <View style={styles.goalMeta}>
        {projects.length > 0 && <Badge text={`${projects.length} ${t('projectsLabel')}`} />}
        {tasks.length > 0 && <Badge text={`${tasks.length} ${t('tasks')}`} />}
        {habits.length > 0 && <Badge text={`${habits.length} ${t('habits')}`} />}
        {progress === 100 && projects.length === 0 && tasks.length === 0 && <Badge text={t('noProjectsYetAdd')} />}
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Goal editor
// ---------------------------------------------------------------------------

function GoalEditorModal({ goalId, visible, onClose }: { goalId: string | null; visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const editing = goalId ? data.collections.goals.find((g) => g.id === goalId && !g.deletedAt) : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<Goal['status']>('active');
  const [color, setColor] = useState('#4F46E5');

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description || '');
      setDeadline(editing.deadline || '');
      setStatus(editing.status);
      setColor(editing.color || '#4F46E5');
    } else {
      setTitle('');
      setDescription('');
      setDeadline('');
      setStatus('active');
      setColor('#4F46E5');
    }
  }, [visible, editing]);

  const save = () => {
    if (!title.trim()) return;
    const payload = { title: title.trim(), description: description.trim() || undefined, deadline: deadline || null, status, color };
    if (editing) update('goals', editing.id, payload);
    else create('goals', payload);
    onClose();
  };

  const del = () => {
    if (editing) {
      remove('goals', editing.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editing ? t('editGoal') : t('newGoal')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label={t('title')}>
              <TextBox value={title} onChangeText={setTitle} placeholder={t('goalExample')} autoFocus={!editing} />
            </Field>
            <Field label={t('goalDesc')}>
              <TextBox value={description} onChangeText={setDescription} placeholder={t('whyMatters')} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
            </Field>
            <DateField label={t('deadline')} value={deadline} onChange={setDeadline} />
            <Field label={t('status')}>
              <ChipRow>
                {(['active', 'done', 'archived'] as const).map((s) => (
                  <Chip key={s} label={s === 'active' ? t('active') : s === 'done' ? t('doneLabel') : t('archived')} selected={status === s} onPress={() => setStatus(s)} />
                ))}
              </ChipRow>
            </Field>
            <View style={styles.actions}>
              {editing && <Button title={t('delete')} variant="danger" onPress={del} style={{ flex: 1 }} />}
              <Button title={t('cancel')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title={t('save')} onPress={save} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Goal detail: projects + tasks + habits
// ---------------------------------------------------------------------------

function GoalDetailModal({ goalId, visible, onClose }: { goalId: string; visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  const { monthsShort, weekdaysShort } = useDateNames();
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const goal = data.collections.goals.find((g) => g.id === goalId && !g.deletedAt);
  const projects = data.collections.projects.filter((p) => !p.deletedAt && p.goalId === goalId && p.status !== 'archived');
  const habits = data.collections.habits.filter((h) => !h.deletedAt && h.goalId === goalId);

  const [newProject, setNewProject] = useState('');
  const [newTask, setNewTask] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);

  if (!goal) return null;

  const addProject = () => {
    const name = newProject.trim();
    if (!name) return;
    create('projects', { name, goalId, status: 'active', color: '#4F46E5' });
    setNewProject('');
  };

  const addTask = (projectId: string) => {
    const title = newTask.trim();
    if (!title) return;
    create('tasks', { title, status: 'todo', priority: 'medium', projectId });
    setNewTask('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <View style={[styles.sheet, { maxHeight: '90%' }]}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={typography.title}>{goal.title}</Text>
              {goal.deadline ? <Text style={typography.caption}>{t('due')} {fmtDue(goal.deadline, weekdaysShort, monthsShort)}</Text> : null}
            </View>
            <Pressable onPress={() => setEditingGoal(true)} hitSlop={8}>
              <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ProgressBar pct={goalProgress(goal.id, data)} color={goal.color || colors.accent} style={{ marginTop: spacing.sm }} />

            {habits.length > 0 && (
              <>
                <SectionHeader title={t('linkedHabits')} />
                {habits.map((h) => (
                  <Card key={h.id} style={styles.projectCard}>
                    <Ionicons name="repeat-outline" size={18} color={colors.accent} />
                    <Text style={[typography.body, { flex: 1 }]}>{h.name}</Text>
                    <Badge text={`${h.completions.length} ${t('doneLabel')}`} />
                  </Card>
                ))}
              </>
            )}

            <SectionHeader title={t('projectsLabel')} />
            {projects.length === 0 && <EmptyState icon="folder-open-outline" title={t('noProjects')} />}
            {projects.map((p) => (
              <ProjectBlock key={p.id} project={p} newTask={newTask} setNewTask={setNewTask} addTask={addTask} onEdit={() => undefined} />
            ))}
            <View style={styles.addRow}>
              <TextBox value={newProject} onChangeText={setNewProject} placeholder={t('newProject')} style={{ flex: 1 }} onSubmitEditing={addProject} returnKeyType="done" />
              <Button title={t('add')} small onPress={addProject} />
            </View>

            <View style={styles.actions}>
              <Button title={t('close')} variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <Button title={t('deleteGoal')} variant="danger" onPress={() => { remove('goals', goal.id); onClose(); }} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <GoalEditorModal goalId={goalId} visible={editingGoal} onClose={() => setEditingGoal(false)} />
    </Modal>
  );
}

function ProjectBlock({
  project,
  newTask,
  setNewTask,
  addTask,
  onEdit,
}: {
  project: Project;
  newTask: string;
  setNewTask: (s: string) => void;
  addTask: (projectId: string) => void;
  onEdit: () => void;
}) {
  styles = createStyles();
  const t = useT();
  const { monthsShort, weekdaysShort } = useDateNames();
  const data = useLifeOS((s) => s.data);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const tasks = data.collections.tasks.filter((t) => !t.deletedAt && t.projectId === project.id && t.status !== 'cancelled');
  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <Card style={{ marginBottom: spacing.sm }} onPress={onEdit}>
      <View style={styles.projectHeader}>
        <View style={{ flex: 1 }}>
          <Text style={typography.body}>{project.name}</Text>
          <Text style={typography.caption}>
            {tasks.length === 0 ? t('noTasks') : `${done}/${tasks.length} ${t('doneLabel')}`}
            {project.deadline ? ` · ${t('due')} ${fmtDue(project.deadline, weekdaysShort, monthsShort)}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => remove('projects', project.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
      {tasks.map((t) => (
        <View key={t.id} style={styles.projectTask}>
          <Pressable onPress={() => update('tasks', t.id, { status: t.status === 'done' ? 'todo' : 'done' })} hitSlop={8}>
            <Ionicons name={t.status === 'done' ? 'checkbox' : 'square-outline'} size={18} color={t.status === 'done' ? colors.success : colors.textMuted} />
          </Pressable>
          <Text style={[typography.body, { flex: 1, fontSize: 14 }, t.status === 'done' && { textDecorationLine: 'line-through', color: colors.textMuted }]}>
            {t.title}
          </Text>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextBox value={newTask} onChangeText={setNewTask} placeholder={`${t('addTaskTo')} ${project.name}…`} style={{ flex: 1 }} onSubmitEditing={() => addTask(project.id)} returnKeyType="done" />
        <Button title={t('add')} small onPress={() => addTask(project.id)} />
      </View>
    </Card>
  );
}

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filters: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 120 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '85%',
  },
  sheetTitle: { ...typography.title, marginBottom: spacing.lg },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  projectCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, marginBottom: spacing.sm },
  projectHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  projectTask: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  });
}

