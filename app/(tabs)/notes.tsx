/**
 * Notes — quick notes, journal, project notes, global search, and links to
 * tasks, projects, goals and events.
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
import { useT } from '../../src/i18n';
import { Note, NoteKind } from '../../src/core/types';
import { dateKey } from '../../src/core/time';
import { colors, radius, spacing, typography } from '../../src/theme';
import { Badge, Button, Card, Chip, ChipRow, EmptyState, Field, SectionHeader, TextBox } from '../../src/components/ui';

type Filter = 'all' | NoteKind;

interface SearchHit {
  kindLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  noteId?: string;
}

export default function NotesScreen() {
  styles = createStyles();
  const t = useT();
  const data = useLifeOS((s) => s.data);
  const remove = useLifeOS((s) => s.remove);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const notes = useMemo(
    () =>
      data.collections.notes
        .filter((n) => !n.deletedAt)
        .filter((n) => filter === 'all' || n.kind2 === filter)
        .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)),
    [data, filter]
  );

  const searchHits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const n of notes) {
      if (n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.tags || []).some((t) => t.toLowerCase().includes(q))) {
        hits.push({ kindLabel: 'Note', icon: 'document-text-outline', color: colors.textSecondary, title: n.title || n.body.slice(0, 40), noteId: n.id });
      }
    }
    for (const t of data.collections.tasks) {
      if (!t.deletedAt && t.title.toLowerCase().includes(q)) hits.push({ kindLabel: 'Task', icon: 'checkbox-outline', color: colors.accent, title: t.title });
    }
    for (const e of data.collections.events) {
      if (!e.deletedAt && e.title.toLowerCase().includes(q)) hits.push({ kindLabel: 'Event', icon: 'calendar-outline', color: colors.info, title: e.title });
    }
    for (const g of data.collections.goals) {
      if (!g.deletedAt && g.title.toLowerCase().includes(q)) hits.push({ kindLabel: 'Goal', icon: 'flag-outline', color: colors.warning, title: g.title });
    }
    for (const p of data.collections.projects) {
      if (!p.deletedAt && p.name.toLowerCase().includes(q)) hits.push({ kindLabel: 'Project', icon: 'folder-open-outline', color: colors.success, title: p.name });
    }
    return hits.slice(0, 30);
  }, [query, notes, data]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={typography.title}>{t('notes')}</Text>
        <Button title={t('addNote')} small onPress={() => { setEditingId(null); setEditorOpen(true); }} />
      </View>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextBox value={query} onChangeText={setQuery} placeholder={t('searchPlaceholder')} style={styles.searchInput} />
      </View>
      <ChipRow style={styles.filters}>
        {(['all', 'note', 'journal', 'project'] as Filter[]).map((f) => {
          const label = f === 'all' ? t('all') : f === 'note' ? t('typeNote') : f === 'journal' ? t('journal') : t('project');
          return <Chip key={f} label={label} selected={filter === f} onPress={() => setFilter(f)} />;
        })}
      </ChipRow>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {query.trim() ? (
          searchHits.length === 0 ? (
            <EmptyState icon="search-outline" title={t('noMatches')} />
          ) : (
            searchHits.map((hit, i) => (
              <Card
                key={i}
                style={styles.noteCard}
                onPress={hit.noteId ? () => { setEditingId(hit.noteId!); setEditorOpen(true); } : undefined}
              >
                <Ionicons name={hit.icon} size={18} color={hit.color} />
                <View style={{ flex: 1 }}>
                  <Text style={typography.body} numberOfLines={1}>{hit.title}</Text>
                  <Text style={typography.caption}>{hit.kindLabel}</Text>
                </View>
              </Card>
            ))
          )
        ) : notes.length === 0 ? (
          <EmptyState icon="document-text-outline" title={t('noNotes')} subtitle={t('noNotesSub')} />
        ) : (
          notes.map((n) => (
            <Card
              key={n.id}
              style={styles.noteCard}
              onPress={() => { setEditingId(n.id); setEditorOpen(true); }}
              onLongPress={() =>
                Alert.alert(t('deleteNoteQ'), n.title || t('untitled'), [
                  { text: 'Delete', style: 'destructive', onPress: () => remove('notes', n.id) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <View style={{ flex: 1 }}>
                <View style={styles.noteTitleRow}>
                  <Text style={[typography.body, { fontWeight: '600', flex: 1 }]} numberOfLines={1}>{n.title || t('untitled')}</Text>
                  <Badge text={n.kind2} color={n.kind2 === 'journal' ? colors.warning : n.kind2 === 'project' ? colors.success : colors.textSecondary} bg={n.kind2 === 'journal' ? colors.warningSoft : n.kind2 === 'project' ? colors.successSoft : colors.surfaceAlt} />
                </View>
                {n.body ? <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={2}>{n.body}</Text> : null}
                <View style={styles.noteMeta}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>{dateKey(new Date(n.updatedAt))}</Text>
                  {(n.tags || []).slice(0, 3).map((t) => <Badge key={t} text={`#${t}`} color={colors.accent} bg={colors.accentSoft} />)}
                  {(() => {
                    const linked =
                      (n.taskId ? data.collections.tasks.find((x) => x.id === n.taskId && !x.deletedAt)?.title : '') ||
                      (n.projectId ? data.collections.projects.find((x) => x.id === n.projectId && !x.deletedAt)?.name : '') ||
                      (n.goalId ? data.collections.goals.find((x) => x.id === n.goalId && !x.deletedAt)?.title : '') ||
                      (n.eventId ? data.collections.events.find((x) => x.id === n.eventId && !x.deletedAt)?.title : '');
                    return linked ? <Badge text={`${t('linkedBadge')} · ${linked}`} color={colors.info} bg={colors.infoSoft} /> : null;
                  })()}
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <NoteEditorModal noteId={editingId} visible={editorOpen} onClose={() => setEditorOpen(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Note editor
// ---------------------------------------------------------------------------

function NoteEditorModal({ noteId, visible, onClose }: { noteId: string | null; visible: boolean; onClose: () => void }) {
  styles = createStyles();
  const t = useT();
  const data = useLifeOS((s) => s.data);
  const create = useLifeOS((s) => s.create);
  const update = useLifeOS((s) => s.update);
  const remove = useLifeOS((s) => s.remove);
  const editing = noteId ? data.collections.notes.find((n) => n.id === noteId && !n.deletedAt) : undefined;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind2, setKind2] = useState<NoteKind>('note');
  const [tags, setTags] = useState('');
  const [links, setLinks] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setTitle(editing.title);
      setBody(editing.body);
      setKind2(editing.kind2);
      setTags((editing.tags || []).join(', '));
      setLinks((editing.links || []).join('\n'));
      setTaskId(editing.taskId || null);
      setProjectId(editing.projectId || null);
      setGoalId(editing.goalId || null);
      setEventId(editing.eventId || null);
    } else {
      setTitle('');
      setBody('');
      setKind2('note');
      setTags('');
      setLinks('');
      setTaskId(null);
      setProjectId(null);
      setGoalId(null);
      setEventId(null);
    }
  }, [visible, editing]);

  const save = () => {
    const payload = {
      title: title.trim(),
      body: body.trim(),
      kind2,
      tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
      links: links.split('\n').map((s) => s.trim()).filter(Boolean),
      taskId: taskId || null,
      projectId: projectId || null,
      goalId: goalId || null,
      eventId: eventId || null,
    };
    if (editing) update('notes', editing.id, payload);
    else create('notes', payload);
    onClose();
  };

  const del = () => {
    if (editing) {
      remove('notes', editing.id);
      onClose();
    }
  };

  const tasks = data.collections.tasks.filter((t) => !t.deletedAt);
  const projects = data.collections.projects.filter((p) => !p.deletedAt);
  const goals = data.collections.goals.filter((g) => !g.deletedAt);
  const events = data.collections.events.filter((e) => !e.deletedAt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{editing ? t('editNote') : t('newNote')}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Field label={t('title')}>
              <TextBox value={title} onChangeText={setTitle} placeholder={t('title')} autoFocus={!editing} />
            </Field>
            <Field label={t('type')}>
              <ChipRow>
                {(['note', 'journal', 'project'] as NoteKind[]).map((k) => (
                  <Chip key={k} label={k === 'note' ? t('typeNote') : k === 'journal' ? t('journal') : t('project')} selected={kind2 === k} onPress={() => setKind2(k)} />
                ))}
              </ChipRow>
            </Field>
            <Field label={t('noteBody')}>
              <TextBox value={body} onChangeText={setBody} placeholder={t('writeEllipsis')} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} />
            </Field>
            <Field label={t('tagsComma')}>
              <TextBox value={tags} onChangeText={setTags} placeholder="ideas, work" />
            </Field>
            <Field label={t('links')}>
              <TextBox value={links} onChangeText={setLinks} placeholder="https://…" autoCapitalize="none" autoCorrect={false} multiline style={{ minHeight: 50, textAlignVertical: 'top' }} />
            </Field>

            <Field label={t('linkTo')}>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>{t('typeTask')}</Text>
              <ChipRow>
                <Chip label={t('none')} selected={!taskId} onPress={() => setTaskId(null)} />
                {tasks.slice(0, 6).map((t) => (
                  <Chip key={t.id} label={t.title.slice(0, 18)} selected={taskId === t.id} onPress={() => setTaskId(t.id)} />
                ))}
              </ChipRow>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4, marginTop: 6 }]}>{t('project')}</Text>
              <ChipRow>
                <Chip label={t('none')} selected={!projectId} onPress={() => setProjectId(null)} />
                {projects.slice(0, 6).map((p) => (
                  <Chip key={p.id} label={p.name.slice(0, 18)} selected={projectId === p.id} onPress={() => setProjectId(p.id)} />
                ))}
              </ChipRow>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4, marginTop: 6 }]}>{t('typeGoal')}</Text>
              <ChipRow>
                <Chip label={t('none')} selected={!goalId} onPress={() => setGoalId(null)} />
                {goals.slice(0, 6).map((g) => (
                  <Chip key={g.id} label={g.title.slice(0, 18)} selected={goalId === g.id} onPress={() => setGoalId(g.id)} />
                ))}
              </ChipRow>
              <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4, marginTop: 6 }]}>{t('eventLabel')}</Text>
              <ChipRow>
                <Chip label={t('none')} selected={!eventId} onPress={() => setEventId(null)} />
                {events.slice(0, 6).map((e) => (
                  <Chip key={e.id} label={e.title.slice(0, 18)} selected={eventId === e.id} onPress={() => setEventId(e.id)} />
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

let styles = createStyles();

function createStyles() {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md },
  searchIcon: { position: 'absolute', left: spacing.md, zIndex: 1 },
  searchInput: { flex: 1, paddingLeft: 38 },
  filters: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  content: { padding: spacing.lg, paddingBottom: 120 },
  noteCard: { marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  noteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noteMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '92%',
  },
  sheetTitle: { ...typography.title, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  });
}

